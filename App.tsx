import React, { useState, useEffect, useCallback } from 'react';
import { searchAndAnalyzeJobs } from './services/geminiService';
import { syncToGoogleSheet } from './services/sheetService';
import { Job, MatchLabel } from './types';
import JobCard from './components/JobCard';
import DailyReport from './components/DailyReport';
import SettingsModal from './components/SettingsModal';

const STORAGE_KEY = 'hiring_intel_jobs_v1';
const LAST_SCAN_KEY = 'hiring_intel_last_scan_v1';
const SHEET_URL_KEY = 'hiring_intel_sheet_url_v1';
const SHEET_ID_KEY = 'hiring_intel_sheet_id_v1';
const LAST_SYNC_KEY = 'hiring_intel_last_sync_v1';

const App: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  
  const [showReport, setShowReport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [sheetScriptUrl, setSheetScriptUrl] = useState<string>('');
  const [sheetId, setSheetId] = useState<string>('');
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);

  // Load data on mount
  useEffect(() => {
    const savedJobs = localStorage.getItem(STORAGE_KEY);
    const savedScanTime = localStorage.getItem(LAST_SCAN_KEY);
    const savedSheetUrl = localStorage.getItem(SHEET_URL_KEY);
    const savedSheetId = localStorage.getItem(SHEET_ID_KEY);
    const savedSyncTime = localStorage.getItem(LAST_SYNC_KEY);
    
    if (savedJobs) setJobs(JSON.parse(savedJobs));
    if (savedScanTime) setLastScan(savedScanTime);
    if (savedSheetUrl) setSheetScriptUrl(savedSheetUrl);
    if (savedSheetId) setSheetId(savedSheetId);
    if (savedSyncTime) setLastSync(savedSyncTime);
  }, []);

  // Persist jobs
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  }, [jobs]);

  // Persist settings
  const handleSaveSettings = (url: string, id: string) => {
    setSheetScriptUrl(url);
    setSheetId(id);
    localStorage.setItem(SHEET_URL_KEY, url);
    localStorage.setItem(SHEET_ID_KEY, id);
  };

  const handleToggleSave = (jobId: string) => {
    setJobs(prevJobs => prevJobs.map(job => 
        job.id === jobId ? { ...job, saved: !job.saved } : job
    ));
  };

  const runSync = async (jobsToSync: Job[]) => {
      if (!sheetScriptUrl || !sheetId) {
          setError("Configure Google Sheet URL and ID in settings to sync.");
          setShowSettings(true);
          return;
      }
      
      setIsSyncing(true);
      setSyncMessage("Syncing to Google Sheet...");
      try {
          const result = await syncToGoogleSheet(jobsToSync, sheetScriptUrl, sheetId);
          if (result.success) {
              setSyncMessage(`Synced! ${result.newJobsAdded} new jobs added.`);
              const now = new Date().toISOString();
              setLastSync(now);
              localStorage.setItem(LAST_SYNC_KEY, now);
          } else {
              setSyncMessage(`Sync Failed: ${result.message}`);
          }
      } catch (e) {
          setSyncMessage("Sync Failed: Network error");
      } finally {
          setIsSyncing(false);
          // Clear message after 5 seconds
          setTimeout(() => setSyncMessage(null), 5000);
      }
  };

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    setError(null);
    setSyncMessage(null);

    try {
      const newJobs = await searchAndAnalyzeJobs();
      
      let updatedJobs: Job[] = [];
      
      setJobs(prevJobs => {
        const existingIds = new Set(prevJobs.map(j => j.url !== '#' ? j.url : j.company + j.title));
        const uniqueNewJobs = newJobs.filter(j => {
             const id = j.url !== '#' ? j.url : j.company + j.title;
             return !existingIds.has(id);
        });
        
        // Sort by relevance score desc, preserve saved status if merging (though unique check prevents direct merge, logic holds for ID stability)
        updatedJobs = [...uniqueNewJobs, ...prevJobs].sort((a, b) => b.relevanceScore - a.relevanceScore);
        // Keep only last 100 locally
        return updatedJobs.slice(0, 100);
      });

      const now = new Date().toISOString();
      setLastScan(now);
      localStorage.setItem(LAST_SCAN_KEY, now);

      if (sheetScriptUrl && sheetId) {
          await runSync(updatedJobs.slice(0, 50));
      }

    } catch (err: any) {
      setError(err.message || "An error occurred while scanning.");
    } finally {
      setIsScanning(false);
    }
  }, [sheetScriptUrl, sheetId]);

  // Auto-scan timer
  useEffect(() => {
      let interval: any;
      if (autoScanEnabled) {
          const checkAndRun = () => {
             const now = Date.now();
             const last = lastScan ? new Date(lastScan).getTime() : 0;
             const hoursSince = (now - last) / (1000 * 60 * 60);
             if (hoursSince >= 2 && !isScanning) {
                 handleScan();
             }
          };
          checkAndRun();
          interval = setInterval(checkAndRun, 60000);
      }
      return () => clearInterval(interval);
  }, [autoScanEnabled, lastScan, isScanning, handleScan]);

  const handleExport = () => {
    if (jobs.length === 0) return;
    const dataStr = JSON.stringify(jobs, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hiring-intel-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const strongCount = jobs.filter(j => j.relevanceLabel === MatchLabel.STRONG).length;
  const newTodayCount = jobs.filter(j => {
      const jobDate = new Date(j.dateFound);
      const today = new Date();
      return jobDate.getDate() === today.getDate() && jobDate.getMonth() === today.getMonth();
  }).length;
  const savedCount = jobs.filter(j => j.saved).length;

  // Filter jobs for display
  const displayedJobs = showSavedOnly ? jobs.filter(j => j.saved) : jobs;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              H
            </div>
            <h1 className="text-xl font-bold text-slate-800">Hiring Intel</h1>
          </div>
          
          <div className="flex items-center space-x-4">
             {/* Auto Scan Toggle */}
             <div className="flex items-center space-x-2 text-sm text-slate-600 hidden md:flex">
                <span className={`w-2 h-2 rounded-full ${autoScanEnabled ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></span>
                <span className="">Auto-scan (2h)</span>
                <button 
                  onClick={() => setAutoScanEnabled(!autoScanEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoScanEnabled ? 'bg-brand-600' : 'bg-slate-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${autoScanEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
             </div>

             {/* Settings Button */}
             <button 
                onClick={() => setShowSettings(true)}
                className={`p-2 rounded-full transition-colors ${!sheetId ? 'text-red-500 bg-red-50 hover:bg-red-100 animate-pulse' : 'text-slate-500 hover:text-brand-600 hover:bg-slate-100'}`}
                title="Settings & Sheet Integration"
             >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
             </button>

             {/* Sync Button */}
             <button
               onClick={() => runSync(jobs.slice(0, 100))}
               disabled={isSyncing || jobs.length === 0}
               className={`hidden sm:flex items-center px-3 py-2 rounded-lg font-medium text-sm transition-all border ${
                 isSyncing || jobs.length === 0
                   ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                   : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-brand-600 hover:border-brand-300 shadow-sm'
               }`}
               title="Sync current jobs to Google Sheet"
             >
               <svg className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
               </svg>
               {isSyncing ? 'Syncing...' : 'Sync to Sheet'}
             </button>

             {/* Scan Button */}
             <button 
               onClick={handleScan}
               disabled={isScanning}
               className={`flex items-center px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                 isScanning 
                 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                 : 'bg-slate-900 text-white hover:bg-slate-800 shadow-md hover:shadow-lg'
               }`}
             >
               {isScanning ? (
                 <>
                   <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                   Scanning...
                 </>
               ) : (
                 <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    Scan Now
                 </>
               )}
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <div className="text-sm font-medium text-slate-500 mb-1">Jobs Found Today</div>
             <div className="text-3xl font-bold text-slate-900">{newTodayCount}</div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <div className="text-sm font-medium text-slate-500 mb-1">Strong Matches</div>
             <div className="text-3xl font-bold text-brand-600">{strongCount}</div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-start">
             <div className="text-sm font-medium text-slate-500 mb-2">Cloud Sync Status</div>
             
             {sheetScriptUrl && sheetId ? (
                <div className="flex items-center space-x-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${isSyncing ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}></div>
                    <span className="text-sm font-medium text-slate-800">
                        {isSyncing ? "Syncing..." : lastSync ? `Synced ${new Date(lastSync).toLocaleTimeString()}` : "Ready to sync"}
                    </span>
                </div>
             ) : (
                 <div className="flex items-center space-x-2 text-red-500">
                     <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                     <span className="text-sm font-medium">Missing Setup</span>
                 </div>
             )}

             <div className="mt-3 flex flex-wrap gap-3">
               <button 
                 onClick={() => setShowReport(true)}
                 className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center"
               >
                 Daily Report 
                 <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
               </button>
               
               <button 
                 onClick={handleExport}
                 disabled={jobs.length === 0}
                 className={`text-xs font-semibold flex items-center ${jobs.length === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-slate-800'}`}
               >
                 Export JSON
               </button>
             </div>
          </div>
        </div>

        {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center">
                 <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                 {error}
            </div>
        )}

        {syncMessage && (
            <div className={`mb-6 p-3 text-sm rounded-lg flex items-center transition-opacity duration-500 ${syncMessage.includes("Failed") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                 {syncMessage.includes("Failed") ? (
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                 ) : (
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                 )}
                 {syncMessage}
            </div>
        )}

        {/* Content Area */}
        <div className="flex flex-col space-y-6">
           <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                  <h2 className="text-lg font-bold text-slate-800">
                    {showSavedOnly ? 'Saved Jobs' : 'Recent Opportunities'}
                  </h2>
                  <button 
                    onClick={() => setShowSavedOnly(!showSavedOnly)}
                    className={`text-sm px-3 py-1 rounded-full border transition-colors flex items-center ${showSavedOnly ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    <svg className={`w-4 h-4 mr-1.5 ${showSavedOnly ? 'fill-current' : 'fill-none'}`} viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    Saved Only ({savedCount})
                  </button>
              </div>
              <span className="text-sm text-slate-500">{displayedJobs.length} visible</span>
           </div>

           {displayedJobs.length === 0 ? (
               <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                   <div className="mx-auto h-12 w-12 text-slate-300">
                     {showSavedOnly ? (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                     ) : (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                     )}
                   </div>
                   <h3 className="mt-2 text-sm font-medium text-slate-900">
                     {showSavedOnly ? "No saved jobs" : "No jobs found yet"}
                   </h3>
                   <p className="mt-1 text-sm text-slate-500">
                     {showSavedOnly ? "Bookmark jobs to see them here." : "Click \"Scan Now\" to search for new opportunities."}
                   </p>
               </div>
           ) : (
               <div className="grid grid-cols-1 gap-6">
                 {displayedJobs.map((job) => (
                    <JobCard 
                        key={job.id} 
                        job={job} 
                        onToggleSave={handleToggleSave}
                    />
                 ))}
               </div>
           )}
        </div>

      </main>

      {showReport && (
        <DailyReport jobs={jobs} onClose={() => setShowReport(false)} />
      )}

      {showSettings && (
        <SettingsModal 
          currentUrl={sheetScriptUrl} 
          currentSheetId={sheetId}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)} 
        />
      )}

    </div>
  );
};

export default App;
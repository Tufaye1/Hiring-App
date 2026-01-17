import React, { useMemo, useState } from 'react';
import { Job, MatchLabel } from '../types';

interface DailyReportProps {
  jobs: Job[];
  onClose: () => void;
}

const DailyReport: React.FC<DailyReportProps> = ({ jobs, onClose }) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  // Filter jobs found today (mocking today as any job in list for this demo, 
  // but in production would check dateFound)
  const todayJobs = jobs; 

  const strongMatches = todayJobs.filter(j => j.relevanceLabel === MatchLabel.STRONG);
  const mediumMatches = todayJobs.filter(j => j.relevanceLabel === MatchLabel.MEDIUM);
  const exploratoryMatches = todayJobs.filter(j => j.relevanceLabel === MatchLabel.EXPLORATORY);

  const totalFound = todayJobs.length;
  
  // Simple logic to find top hiring company
  const companyCounts = todayJobs.reduce((acc, job) => {
      acc[job.company] = (acc[job.company] || 0) + 1;
      return acc;
  }, {} as Record<string, number>);
  
  const topCompany = Object.entries(companyCounts).sort((a,b) => (b[1] as number) - (a[1] as number))[0]?.[0] || "Various";

  const generateEmailText = () => {
    let text = `Subject: Daily Hiring Intel Report - ${new Date().toLocaleDateString()}\n\n`;
    
    text += `TOTAL JOBS FOUND: ${totalFound}\n`;
    text += `TOP HIRING COMPANY: ${topCompany}\n\n`;

    const appendSection = (title: string, items: Job[]) => {
      if (items.length === 0) return;
      text += `=== ${title.toUpperCase()} (${items.length}) ===\n\n`;
      items.forEach(job => {
        text += `• ${job.title} @ ${job.company}\n`;
        text += `  Location: ${job.location}\n`;
        text += `  Why: ${job.reason}\n`;
        text += `  Link: ${job.url}\n\n`;
      });
    };

    appendSection("Strong Matches", strongMatches);
    appendSection("Medium Matches", mediumMatches);
    appendSection("Exploratory Roles", exploratoryMatches);

    text += `--- End of Report ---`;
    return text;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateEmailText());
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
             <h2 className="text-2xl font-bold text-slate-800">Daily Summary</h2>
             <p className="text-slate-500 text-sm">Ready for email distribution</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <div className="bg-white border border-slate-200 rounded p-4 font-mono text-sm text-slate-700 whitespace-pre-wrap shadow-inner">
            {generateEmailText()}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close
          </button>
          <button 
            onClick={handleCopy}
            className="flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors shadow-sm"
          >
            {copyStatus === 'copied' ? (
                 <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    Copied!
                 </>
            ) : (
                <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                    Copy to Clipboard
                </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyReport;
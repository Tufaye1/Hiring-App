import React, { useState } from 'react';

interface SettingsModalProps {
  currentUrl: string;
  currentSheetId: string;
  onSave: (url: string, sheetId: string) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ currentUrl, currentSheetId, onSave, onClose }) => {
  const [url, setUrl] = useState(currentUrl);
  const [sheetId, setSheetId] = useState(currentSheetId);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  const scriptCode = `
/* 
   COPY THIS CODE INTO A NEW GOOGLE APPS SCRIPT PROJECT 
   1. Go to script.google.com -> New Project
   2. Paste this code
   3. Click "Deploy" -> "New Deployment" (CRITICAL: Do this every time you change code)
   4. Select type: "Web App"
   5. Execute as: "Me"
   6. Who has access: "Anyone"
   7. Copy the Web App URL and paste it below
*/

function doPost(e) {
  try {
    // 1. Parse Data
    var postData;
    try {
        postData = JSON.parse(e.postData.contents);
    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({ 
        success: false, 
        message: "Invalid JSON payload",
        newJobsAdded: 0
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var jobs = postData.jobs;
    var SHEET_ID = postData.sheetId; 
    var SHEET_NAME = "Jobs";

    if (!SHEET_ID) {
      return ContentService.createTextOutput(JSON.stringify({ 
        success: false, 
        message: "Sheet ID is missing in request",
        newJobsAdded: 0
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. Open Sheet
    var ss;
    try {
      ss = SpreadsheetApp.openById(SHEET_ID);
    } catch(err) {
       return ContentService.createTextOutput(JSON.stringify({ 
        success: false, 
        message: "Could not open Sheet. Check ID and permissions.",
        newJobsAdded: 0
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = ss.getSheetByName(SHEET_NAME);
    
    // Create sheet if not exists
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      // Add Headers
      sheet.appendRow(["Date Found", "Company", "Title", "Location", "Score", "Label", "Reason", "URL", "Posted", "Saved"]);
      sheet.setFrozenRows(1);
    }
    
    // 3. Read existing URLs to prevent duplicates
    var lastRow = sheet.getLastRow();
    var existingUrls = [];
    if (lastRow > 1) {
      // Assuming URL is column 8 (Index 7)
      var urlData = sheet.getRange(2, 8, lastRow - 1, 1).getValues();
      existingUrls = urlData.map(function(r) { return r[0]; });
    }
    
    var newJobsCount = 0;
    var newJobsList = [];
    
    // 4. Append Unique Jobs
    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      // Check if URL exists
      var isDuplicate = false;
      
      if (job.url && job.url !== "#") {
        if (existingUrls.indexOf(job.url) > -1) isDuplicate = true;
      }
      
      if (!isDuplicate && job.relevanceScore >= 0.2) {
        sheet.appendRow([
          new Date(),
          job.company,
          job.title,
          job.location,
          job.relevanceScore,
          job.relevanceLabel,
          job.reason,
          job.url,
          job.postedDate,
          job.saved ? "Yes" : "No"
        ]);
        newJobsCount++;
        newJobsList.push(job);
        if (job.url) existingUrls.push(job.url); 
      }
    }
    
    // 5. Send Email Notification
    if (newJobsCount > 0) {
      var recipient = Session.getEffectiveUser().getEmail();
      var strongMatches = newJobsList.filter(function(j) { return j.relevanceLabel === "Strong Match"; });
      
      var subject;
      if (strongMatches.length > 0) {
         // Immediate notification style for Strong Matches
         subject = "🔥 FOUND: " + (strongMatches.length === 1 ? strongMatches[0].title + " @ " + strongMatches[0].company : strongMatches.length + " Strong Matches");
      } else {
         // Standard summary for others
         subject = "Hiring Intel: " + newJobsCount + " New Jobs Found";
      }

      var body = "Hiring Intel Update\n\n";
      
      if (strongMatches.length > 0) {
        body += "=== 🚀 STRONG MATCHES ===\n\n";
        for (var k = 0; k < strongMatches.length; k++) {
          var sm = strongMatches[k];
          body += "Title: " + sm.title + "\n";
          body += "Company: " + sm.company + "\n";
          body += "Location: " + sm.location + "\n";
          body += "Why: " + sm.reason + "\n";
          body += "Link: " + sm.url + "\n\n";
        }
        body += "=========================\n\n";
      }
      
      body += "All New Jobs (" + newJobsCount + " total):\n";
      for (var j = 0; j < newJobsList.length; j++) {
        var job = newJobsList[j];
        body += "• [" + job.relevanceLabel + "] " + job.title + " @ " + job.company + "\n";
        body += "  Link: " + job.url + "\n";
      }
      
      body += "\nView Sheet: https://docs.google.com/spreadsheets/d/" + SHEET_ID;
      
      MailApp.sendEmail(recipient, subject, body);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      newJobsAdded: newJobsCount,
      message: "Synced successfully" 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      message: "Script Error: " + err.toString(),
      newJobsAdded: 0
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
  `;

  const handleSave = () => {
    const cleanUrl = url.trim();
    const cleanId = sheetId.trim();

    if (!cleanUrl.includes("script.google.com")) {
        setValidationWarning("That doesn't look like a Google Script URL.");
        return;
    }
    if (!cleanUrl.endsWith("/exec")) {
        setValidationWarning("Script URL must end in '/exec'. Did you copy the browser URL instead of the deployment URL?");
        return;
    }
    
    setValidationWarning(null);
    onSave(cleanUrl, cleanId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
            
            {/* Sheet ID Input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Google Sheet ID
              </label>
              <input
                type="text"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE..."
                className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">
                The long string in your Google Sheet URL: <code>docs.google.com/spreadsheets/d/<strong>[ID_IS_HERE]</strong>/edit</code>
              </p>
            </div>

            {/* Script URL Input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Apps Script Web App URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono"
              />
              {validationWarning && (
                <p className="text-xs text-red-600 mt-1 font-semibold">{validationWarning}</p>
              )}
            </div>

            {/* Code Section */}
            <div className="border-t border-slate-100 pt-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Backend Script Code (v3.0 - Strong Match Alerts)
              </label>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3">
                  <p className="text-xs text-yellow-800 font-semibold">
                    ⚠️ TROUBLESHOOTING TIP: If sync fails, you likely didn't deploy the new version.
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    In Apps Script, clicking "Save" is NOT enough. You must click <strong>Deploy &gt; New Deployment</strong> every time you paste new code.
                  </p>
              </div>
              <div className="relative">
                <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto h-48 font-mono">
                  {scriptCode}
                </pre>
                <button 
                  onClick={() => navigator.clipboard.writeText(scriptCode)}
                  className="absolute top-2 right-2 px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded transition-colors"
                >
                  Copy Code
                </button>
              </div>
            </div>

        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
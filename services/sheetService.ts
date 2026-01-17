import { Job, SyncResult } from '../types';

export const syncToGoogleSheet = async (jobs: Job[], scriptUrl: string, sheetId: string): Promise<SyncResult> => {
  try {
    if (!sheetId) throw new Error("Sheet ID is missing");
    if (!scriptUrl) throw new Error("Script URL is missing");

    // We send data as plain text to avoid complex CORS preflights
    const payload = JSON.stringify({
      jobs: jobs,
      sheetId: sheetId,
      timestamp: new Date().toISOString()
    });

    const response = await fetch(scriptUrl, {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', 
      },
    });

    const text = await response.text();
    
    // Attempt to parse JSON, but handle HTML error pages from Google gracefully
    let result: any;
    try {
        result = JSON.parse(text);
    } catch (e) {
        // Strip HTML tags to get a cleaner error message if it's an HTML error page
        const cleanText = text.replace(/<[^>]*>?/gm, '').substring(0, 200);
        throw new Error(`Google Script Error: "${cleanText}..." (Check if Deployment is 'Web App' and Access is 'Anyone')`);
    }

    if (!response.ok || (result && result.success === false)) {
      throw new Error(result.message || `Sync failed: ${response.status}`);
    }

    return result as SyncResult;

  } catch (error: any) {
    console.error("Sheet Sync Error:", error);
    return {
      success: false,
      message: error.message || "Failed to connect to Google Sheet Script",
      newJobsAdded: 0
    };
  }
};
export async function getGoogleAuthToken(interactive: boolean = false): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || 'Failed to get auth token'));
      } else {
        resolve(token);
      }
    });
  });
}

export interface SpreadsheetSheetTab {
  id: number;
  title: string;
}

export async function listSharedSpreadsheets() {
  const token = await getGoogleAuthToken(true);
  const res = await fetch("https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)", {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = errData.error?.message || `Google Drive API responded with status ${res.status}`;
    console.error("Google Drive API Error:", errData);
    throw new Error(message);
  }
  const data = await res.json();
  return data.files || [];
}

export async function listSpreadsheetSheets(spreadsheetId: string): Promise<SpreadsheetSheetTab[]> {
  const cleanId = spreadsheetId.trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || spreadsheetId.trim();
  if (!cleanId) return [];

  let token: string;
  try {
    token = await getGoogleAuthToken(false);
  } catch {
    token = await getGoogleAuthToken(true);
  }

  let res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=sheets.properties`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  // If token is invalid or expired (401), remove cached token and retry with interactive=true
  if (res.status === 401 && typeof chrome !== 'undefined' && chrome?.identity?.removeCachedAuthToken) {
    await new Promise<void>((resolve) => {
      chrome.identity.removeCachedAuthToken({ token }, () => resolve());
    });
    token = await getGoogleAuthToken(true);
    res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=sheets.properties`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = errData.error?.message || `Google Sheets API responded with status ${res.status}`;
    console.error("Google Sheets API Error fetching sheets:", errData);
    throw new Error(message);
  }

  const data = await res.json();
  const sheets: SpreadsheetSheetTab[] = (data.sheets || [])
    .map((s: any) => ({
      id: s.properties?.sheetId ?? 0,
      title: s.properties?.title || ''
    }))
    .filter((s: SpreadsheetSheetTab) => s.title.trim().length > 0);

  return sheets;
}

const initializedSheets = new Set<string>();

export async function ensureSheetHeaders(
  spreadsheetId: string,
  sheetName: string,
  headers: string[]
): Promise<void> {
  const cleanId = spreadsheetId.trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || spreadsheetId.trim();
  if (!cleanId || !sheetName || !headers || headers.length === 0) return;

  const cacheKey = `${cleanId}:${sheetName}`;
  if (initializedSheets.has(cacheKey)) return;

  let token: string;
  try {
    token = await getGoogleAuthToken(false);
  } catch {
    token = await getGoogleAuthToken(true);
  }

  try {
    const encodedSheet = encodeURIComponent(sheetName);
    let checkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodedSheet}!A1:Z1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (checkRes.status === 401 && typeof chrome !== 'undefined' && chrome?.identity?.removeCachedAuthToken) {
      await new Promise<void>((resolve) => {
        chrome.identity.removeCachedAuthToken({ token }, () => resolve());
      });
      token = await getGoogleAuthToken(true);
      checkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodedSheet}!A1:Z1`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }

    if (checkRes.ok) {
      const data = await checkRes.json();
      if (data.values && data.values.length > 0 && data.values[0].length > 0) {
        // Headers already exist
        initializedSheets.add(cacheKey);
        return;
      }
    }

    // Sheet row 1 is empty — initialize headers
    const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodedSheet}!A1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: `${sheetName}!A1`,
        majorDimension: 'ROWS',
        values: [headers]
      })
    });

    if (writeRes.ok) {
      console.log(`[RecruitScout] 📋 Sheet headers initialized on "${sheetName}" in ${cleanId}`);
    }
    initializedSheets.add(cacheKey);
  } catch (err) {
    console.warn(`[RecruitScout] ensureSheetHeaders error for ${sheetName}:`, err);
    initializedSheets.add(cacheKey);
  }
}

export async function appendToGoogleSheet(spreadsheetId: string, sheetName: string, rows: any[][]) {
  if (!rows || rows.length === 0) return { updates: { updatedRows: 0 } };
  const cleanId = spreadsheetId.trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || spreadsheetId.trim();
  if (!cleanId) throw new Error('Missing spreadsheet ID for Google Sheets append');

  let token: string;
  try {
    token = await getGoogleAuthToken(false);
  } catch {
    token = await getGoogleAuthToken(true);
  }

  const encodedSheet = encodeURIComponent(sheetName);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodedSheet}:append?valueInputOption=USER_ENTERED`;
  
  let res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range: sheetName,
      majorDimension: 'ROWS',
      values: rows
    })
  });

  // Handle 401 token refresh
  if (res.status === 401 && typeof chrome !== 'undefined' && chrome?.identity?.removeCachedAuthToken) {
    await new Promise<void>((resolve) => {
      chrome.identity.removeCachedAuthToken({ token }, () => resolve());
    });
    token = await getGoogleAuthToken(true);
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: sheetName,
        majorDimension: 'ROWS',
        values: rows
      })
    });
  }
  
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Google Sheets API Error: ${errData.error?.message || res.statusText}`);
  }
  
  return await res.json();
}

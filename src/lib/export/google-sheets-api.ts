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

export async function listSharedSpreadsheets() {
  const token = await getGoogleAuthToken(true);
  const res = await fetch("https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)", {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch spreadsheets');
  const data = await res.json();
  return data.files || [];
}

export async function appendToGoogleSheet(spreadsheetId: string, sheetName: string, rows: any[][]) {
  const token = await getGoogleAuthToken(true);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}:append?valueInputOption=USER_ENTERED`;
  
  const res = await fetch(url, {
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
  
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Google Sheets API Error: ${errData.error?.message || res.statusText}`);
  }
  
  return await res.json();
}

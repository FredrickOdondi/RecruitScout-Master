function base64url(str: string | Uint8Array): string {
  let b64 = typeof str === 'string' ? btoa(str) : btoa(String.fromCharCode(...str));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string) {
  const b64 = pem.replace(/(-----(BEGIN|END) PRIVATE KEY-----|\n)/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function getGoogleAuthToken(): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  
  const clientEmail = import.meta.env.VITE_GOOGLE_SA_EMAIL;
  const privateKey = import.meta.env.VITE_GOOGLE_SA_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('Google Service Account credentials missing in environment.');
  }

  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp,
    iat
  };

  const headerB64 = base64url(JSON.stringify(header));
  const claimB64 = base64url(JSON.stringify(claim));
  const unsignedJwt = `${headerB64}.${claimB64}`;

  const privateKeyBuffer = pemToArrayBuffer(privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedJwt)
  );

  const signatureB64 = base64url(new Uint8Array(signatureBuffer));
  const signedJwt = `${unsignedJwt}.${signatureB64}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt
    })
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Failed to get Google Access Token: ' + JSON.stringify(data));
  }
  return data.access_token;
}

export async function listSharedSpreadsheets() {
  const token = await getGoogleAuthToken();
  const res = await fetch("https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)", {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch spreadsheets');
  const data = await res.json();
  return data.files || [];
}

export async function appendToGoogleSheet(spreadsheetId: string, sheetName: string, rows: any[][]) {
  const token = await getGoogleAuthToken();
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

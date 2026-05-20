import fs from 'fs';
const content = fs.readFileSync('src/shared/supabase.ts', 'utf8');
const urlMatch = content.match(/SUPABASE_URL = '([^']+)'/);
const keyMatch = content.match(/SUPABASE_ANON_KEY = '([^']+)'/);
if (urlMatch && keyMatch) {
  const url = urlMatch[1];
  const key = keyMatch[1];
  
  Promise.all([
    fetch(`${url}/rest/v1/clients?select=*&limit=1`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    }).then(res => res.status),
    fetch(`${url}/rest/v1/Clients?select=*&limit=1`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    }).then(res => res.status)
  ])
  .then(([clientsStatus, ClientsStatus]) => {
    console.log('clients endpoint status:', clientsStatus);
    console.log('Clients endpoint status:', ClientsStatus);
  })
  .catch(console.error);
}


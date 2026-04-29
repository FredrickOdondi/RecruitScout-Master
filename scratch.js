const fs = require('fs');
const content = fs.readFileSync('src/shared/supabase.ts', 'utf8');
const urlMatch = content.match(/SUPABASE_URL = '([^']+)'/);
const keyMatch = content.match(/SUPABASE_ANON_KEY = '([^']+)'/);
if (urlMatch && keyMatch) {
  const url = urlMatch[1];
  const key = keyMatch[1];
  fetch(`${url}/rest/v1/ActiveAgents?select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  })
  .then(res => res.text())
  .then(txt => console.log('ActiveAgents DB:', txt))
  .catch(console.error);
}

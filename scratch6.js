const SUPABASE_URL = 'http://72.60.215.34:8000';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

async function queryDbase(filterValue) {
  const url = `${SUPABASE_URL}/rest/v1/Dbase%20-%2024%2F6%2F26?select=Company%20Name,Company%20Website&Company%20Name=ilike.*Hosco*`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Accept': 'application/json',
    }
  });
  const data = await res.json();
  data.forEach(d => {
    console.log(`'${d['Company Name']}' -> length: ${d['Company Name'].length}, char codes:`, [...d['Company Name']].map(c => c.charCodeAt(0)));
  });
}
queryDbase();

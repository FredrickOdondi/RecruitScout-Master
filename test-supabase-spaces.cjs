const url = 'http://72.60.215.34:8000/rest/v1/Recruiters?limit=10&Country=ilike.*United%20States*';
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

fetch(url, { headers: { 'apikey': apikey, 'Authorization': 'Bearer ' + apikey } })
  .then(r => r.json())
  .then(d => console.log('Without quotes, with spaces:', d.length))
  .catch(console.error);

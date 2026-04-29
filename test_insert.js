const SUPABASE_URL = 'https://qyceqgttvvairnaxwicm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5Y2VxZ3R0dnZhaXJuYXh3aWNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDM4MTQsImV4cCI6MjA4ODMxOTgxNH0.cm8dVGQtAZoLwuhbpsD6uZeFXWPp25LOMCZlyR3aRf0';

async function test() {
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/jobs`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify([{
      id: "dummy_test_123",
      title: "Test Job",
      company: "Test Co",
      url: "https://test.com",
      source: "indeed",
      extractedat: new Date().toISOString(),
      worker_id: "test_worker" // try adding a new column!
    }])
  });
  
  if (!insertRes.ok) {
     console.log("FAILED to insert:", await insertRes.text());
  } else {
     console.log("SUCCESS:", await insertRes.json());
  }
}

test();

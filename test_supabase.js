const SUPABASE_URL = 'https://qyceqgttvvairnaxwicm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5Y2VxZ3R0dnZhaXJuYXh3aWNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDM4MTQsImV4cCI6MjA4ODMxOTgxNH0.cm8dVGQtAZoLwuhbpsD6uZeFXWPp25LOMCZlyR3aRf0';

async function test() {
  const getRes = await fetch(`${SUPABASE_URL}/rest/v1/BulkQueue?select=*&limit=1`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  const tasks = await getRes.json();
  console.log("Tasks found:", tasks);

  if (tasks && tasks.length > 0) {
     const taskId = tasks[0].id;
     console.log("Attempting to PATCH", taskId);
     const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/BulkQueue?id=eq.${taskId}`, {
       method: 'PATCH',
       headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
       },
       body: JSON.stringify({
         status: 'completed',
         completed_at: new Date().toISOString()
       })
     });
     
     const result = await patchRes.json();
     console.log("PATCH Result:", result);
  }
}

test();

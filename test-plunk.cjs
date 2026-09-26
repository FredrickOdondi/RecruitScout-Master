require('dotenv').config({ path: '.env' });

async function testPlunk(name, from, extraArgs = {}) {
  const plunkSecretKey = process.env.VITE_PLUNK_SECRET_KEY || 'sk_test_fake'; 
  
  const payload = {
    to: 'test@example.com',
    subject: 'Test',
    body: 'Hello',
    ...extraArgs
  };
  
  if (from !== undefined) {
    payload.from = from;
  }
  
  if (name !== undefined) {
    payload.name = name;
  }

  const response = await fetch('https://next-api.useplunk.com/v1/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${plunkSecretKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  const data = await response.json().catch(() => ({}));
  console.log('---');
  console.log('from payload:', JSON.stringify(payload.from));
  console.log('name payload:', JSON.stringify(payload.name));
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data));
}

async function run() {
  await testPlunk(undefined, { email: 'diana@recruitscout.tech', name: 'Diana' }); // Object from
  await testPlunk('Diana', 'diana@recruitscout.tech'); // String from + name
  await testPlunk(undefined, 'diana@recruitscout.tech'); // String from
  await testPlunk(undefined, undefined); // No from
}
run();

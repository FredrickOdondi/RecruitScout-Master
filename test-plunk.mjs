import fs from 'fs';
const envContent = fs.readFileSync('.env', 'utf-8');
const match = envContent.match(/VITE_PLUNK_SECRET_KEY=([^\n]+)/);
const plunkSecretKey = match ? match[1].trim() : 'fake_key';

async function testPlunk(from) {
  const payload = {
    to: 'test@example.com',
    from: from,
    subject: 'Test',
    body: 'Hello',
    subscribed: true
  };

  const response = await fetch('https://next-api.useplunk.com/v1/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${plunkSecretKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  const data = await response.json().catch(() => ({}));
  console.log('from payload:', JSON.stringify(from));
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data));
}
await testPlunk({ email: 'hi@www.recruitscout.tech', name: 'RecruitScout' });
await testPlunk('hi@www.recruitscout.tech');
await testPlunk({ email: 'diana@www.recruitscout.tech', name: 'Diana' });

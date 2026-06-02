const https = require('https');

const tokenId = '528092fdf8224cb0a698cea75bb6e497';
const secretId = 'pat_0fb33b68afa7455ca69f4ac8c3429b9f';

const query = `
  query IntrospectRoot {
    __schema {
      queryType {
        name
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
    }
  }
`;

const data = JSON.stringify({ query });

const options = {
  hostname: 'api.blue.cc',
  path: '/graphql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Bloo-Token-ID': tokenId,
    'X-Bloo-Token-Secret': secretId,
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      const fields = parsed.data.__schema.queryType.fields;
      // Filter for fields that return User or might be related to user
      const userFields = fields.filter(f => 
        f.name.toLowerCase().includes('user') || 
        f.name === 'me' || 
        f.name === 'viewer' ||
        f.name === 'profile' ||
        f.name === 'account'
      );
      console.log("Potential User Fields:");
      console.log(JSON.stringify(userFields, null, 2));
      
      // Also print all root field names just in case
      console.log("\\nAll Root Fields:");
      console.log(fields.map(f => f.name).join(', '));
    } catch (e) {
      console.log(body);
    }
  });
});

req.on('error', e => console.error(e));
req.write(data);
req.end();

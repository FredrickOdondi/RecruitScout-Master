const https = require('https');

const tokenId = '528092fdf8224cb0a698cea75bb6e497';
const secretId = 'pat_0fb33b68afa7455ca69f4ac8c3429b9f';

const query = `
  query IntrospectImage {
    __type(name: "Image") {
      fields {
        name
        type {
          name
          kind
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
    console.log(JSON.stringify(JSON.parse(body), null, 2));
  });
});

req.on('error', e => console.error(e));
req.write(data);
req.end();

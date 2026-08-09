import https from 'https';

https.get({
  hostname: 'en.wikipedia.org',
  path: '/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=Cattle',
  headers: { 'User-Agent': 'Node.js' }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(data);
  });
});


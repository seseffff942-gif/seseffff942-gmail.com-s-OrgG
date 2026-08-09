import https from 'https';
import fs from 'fs';

const url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Cow_female_black_white.jpg/1280px-Cow_female_black_white.jpg';

https.get(url, (res) => {
  const file = fs.createWriteStream('public/cows.jpg');
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Download completed');
  });
});

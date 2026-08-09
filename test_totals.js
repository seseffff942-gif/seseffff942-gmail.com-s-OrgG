const fs = require('fs');
fetch('http://localhost:3000/api/products', { headers: { 'Authorization': 'Bearer 000000000000000000000000000000000000000' } }) // we need an auth token or just read db
  .then(res => res.json())
  .then(data => {
    // wait we don't have token... we can read from sqlite db directly?
  })

import http from 'http';
const options = { hostname: 'localhost', port: 3000, path: '/api/offers', method: 'GET' };
// Wait, the API root is process.env.VITE_SUPABASE_URL
const code = `
import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
fetch(supabaseUrl + '/rest/v1/', { headers: { apikey: anonKey } })
  .then(res => res.json())
  .then(data => {
    console.log(data.definitions.offers);
  });
`;
const fs = require('fs');
fs.writeFileSync('openapi-test.js', code);

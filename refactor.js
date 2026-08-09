import fs from 'fs';

const serverTs = fs.readFileSync('server.ts', 'utf-8');

// The goal: Extract the api routes into a separate file `api/index.ts`
// or modify `server.ts` to export the app synchronously.

const lines = serverTs.split('\n');

const importsAndConstants = lines.slice(0, 198);
const startServerHeader = lines.slice(198, 209); 
// lines 205 is app.use(express.json());

// Find where VITE MIDDLEWARE starts
const viteIdx = lines.findIndex(l => l.includes('// ======== VITE MIDDLEWARE / SPA ========'));

const apiRoutes = lines.slice(209, viteIdx);
const theRest = lines.slice(viteIdx);

const newServerTs = [
  ...importsAndConstants,
  "export const app = express();",
  "app.use(express.json());",
  "",
  "// Trigger DB seeding in the background so we don't delay startup",
  "if (!process.env.VERCEL) {",
  '  seedDatabase().catch(err => console.error("Seeding DB failed", err));',
  "}",
  ...apiRoutes,
  "// Global Error Handler for API routes",
  "app.use((err: any, req: any, res: any, next: any) => {",
  '  console.error("Global API Error:", err);',
  '  res.status(500).json({ error: err.message || "Internal Server Error" });',
  "});",
  "",
  "export default app;",
  "",
  "async function startServer() {",
  '  console.log("Starting server script...");',
  '  const PORT = Number(process.env.PORT) || process.env.PORT || 3000;',
  '  console.log("Configured PORT is:", PORT, "from env:", process.env.PORT);',
  ...theRest.filter(l => !l.includes('Global API Error') && !l.includes('Internal Server Error') && !l.includes('app.use((err: any, req: any, res: any, next: any)') && !l.includes('});'))
].join('\n');

fs.writeFileSync('server.ts', newServerTs);
console.log('Refactored server.ts');

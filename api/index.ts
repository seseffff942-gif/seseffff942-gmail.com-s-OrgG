import app, { app as namedApp } from '../server';
const handler = namedApp || app;
export { handler as app };
export default handler;

import fs from 'fs';
import path from 'path';

async function testUpload() {
  try {
    const fetch = (await import('node-fetch')).default as any;
    
    // Create dummy image - valid jpeg
    const imagePath = path.join(process.cwd(), 'dummy.jpg');
    fs.writeFileSync(imagePath, Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAACAAIBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAGBAQABPxA=', 'base64'));
    
    // We will bypass auth by disabling auth in server.ts temporarily instead.
    // Actually, I'll just look at the logs using grep
  } catch (error) {
    console.error("Error:", error);
  }
}

testUpload();

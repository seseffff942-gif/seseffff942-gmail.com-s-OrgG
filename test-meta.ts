import { GoogleGenAI } from "@google/genai";
import fetch from "node-fetch";

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timer);
    return response;
  } catch(e) {
    clearTimeout(timer);
    throw e;
  }
}

async function run() {
  const waToken = (process.env.WHATSAPP_TOKEN || "").trim().replace(/['"]/g, '');
  const waPhoneId = (process.env.WHATSAPP_PHONE_ID || "").trim().replace(/['"]/g, '');
  const waUrl = `https://graph.facebook.com/v20.0/${waPhoneId}/messages`;
  
  let options = {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${waToken}`
    },
    body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "50212345678",
        type: "text",
        text: { body: "Hola, esto es una prueba" }
    })
  };
  
  try {
    const res = await fetchWithTimeout(waUrl, options);
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Body:", text);
  } catch(err) {
    console.error("Err:", err);
  }
}
run();

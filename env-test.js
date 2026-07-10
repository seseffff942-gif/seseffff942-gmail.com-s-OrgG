console.log({
  TOKEN: !!process.env.WHATSAPP_TOKEN,
  URL: !!process.env.WHATSAPP_API_URL,
  PHONE_ID: !!process.env.WHATSAPP_PHONE_ID
});

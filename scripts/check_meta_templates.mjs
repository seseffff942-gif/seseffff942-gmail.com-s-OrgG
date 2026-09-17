const token = 'EAGJ7fnVAP5UBSX6ZC3wVhmT0wEZCBvA5yiE0jzXQMOB91QPBCG0mDBI4UqApzYxjMm4GiPhmHsjLJReYhpa0f8RI6DEqz4v1SZBbQdlR6EAB0qPL2NoPI6VQXTOnt4yIB4DvragKj8IaWXElMyWxvygDYZCZB9VeXPov5nYxx3HgfpCBbzFufCzB2GIcGkgZDZD';

async function checkMeta() {
  const meRes = await fetch(`https://graph.facebook.com/v20.0/debug_token?input_token=${token}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await meRes.json();
  console.log(JSON.stringify(data.data?.granular_scopes, null, 2));

  // Find target_ids
  const wabaScope = data.data?.granular_scopes?.find(s => s.scope === 'whatsapp_business_management' || s.scope === 'whatsapp_business_messaging');
  const wabaId = wabaScope?.target_ids?.[0];
  console.log('WABA ID:', wabaId);

  if (wabaId) {
    const tmplRes = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/message_templates?limit=100`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const tmplData = await tmplRes.json();
    console.log('Total templates:', tmplData.data?.length);
    for (const t of tmplData.data || []) {
      console.log(`\nName: "${t.name}" | Status: ${t.status} | Lang: ${t.language} | Category: ${t.category}`);
      for (const c of t.components || []) {
        console.log(`  [${c.type}] text: ${c.text || ''}`);
        if (c.example) console.log(`  example:`, JSON.stringify(c.example));
      }
    }
  }
}

checkMeta();

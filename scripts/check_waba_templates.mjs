const token = 'EAGJ7fnVAP5UBSX6ZC3wVhmT0wEZCBvA5yiE0jzXQMOB91QPBCG0mDBI4UqApzYxjMm4GiPhmHsjLJReYhpa0f8RI6DEqz4v1SZBbQdlR6EAB0qPL2NoPI6VQXTOnt4yIB4DvragKj8IaWXElMyWxvygDYZCZB9VeXPov5nYxx3HgfpCBbzFufCzB2GIcGkgZDZD';
const wabaId = '1943024916383368';

async function checkWabaTemplates() {
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/message_templates?limit=100`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(`Total templates in WABA ${wabaId}:`, data.data?.length);
    for (const t of data.data || []) {
      console.log(`\n========================================`);
      console.log(`Name: "${t.name}" | Status: ${t.status} | Lang: ${t.language} | Category: ${t.category}`);
      if (t.rejected_reason) console.log(`REJECTED REASON: ${t.rejected_reason}`);
      for (const c of t.components || []) {
        console.log(`  Component [${c.type}]: ${c.text || ''}`);
        if (c.example) console.log(`  Example:`, JSON.stringify(c.example));
      }
    }
  } catch (e) {
    console.error(e);
  }
}

checkWabaTemplates();

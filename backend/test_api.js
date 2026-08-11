async function testApi() {
  try {
    const res = await fetch('https://rendicion-online.onrender.com/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: "Prueba Node Fetch" })
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log("Success:", data);
    } else {
      const text = await res.text();
      console.error("API Error Status:", res.status);
      console.error("API Error Data:", text);
    }
  } catch (error) {
    console.error("Network Error:", error.message);
  }
}
testApi();

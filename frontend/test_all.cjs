const axios = require('axios');

async function testBoth() {
  console.log("Testing LOCAL...");
  try {
    const resLocal = await axios.post('http://localhost:3000/api/reports', { name: 'Test Local' });
    console.log("LOCAL SUCCESS:", resLocal.data);
  } catch (err) {
    console.error("LOCAL FAIL:", err.response ? err.response.data : err.message);
  }

  console.log("\nTesting CLOUD...");
  try {
    const resCloud = await axios.post('https://rendicion-online.onrender.com/api/reports', { name: 'Test Cloud' });
    console.log("CLOUD SUCCESS:", resCloud.data);
  } catch (err) {
    console.error("CLOUD FAIL:", err.response ? err.response.data : err.message);
  }
}
testBoth();

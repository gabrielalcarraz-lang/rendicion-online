const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('https://rendicion-online.vercel.app/api/reports', {
      name: 'Prueba desde la IA'
    });
    console.log("SUCCESS:");
    console.log(res.data);
  } catch (err) {
    console.log("ERROR:");
    if (err.response) {
      console.log(err.response.status, err.response.data);
    } else {
      console.log(err.message);
    }
  }
}

test();

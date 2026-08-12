const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('https://rendicion-online.onrender.com/api/reports', {
      name: 'Prueba desde IA (Render + Supabase)'
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

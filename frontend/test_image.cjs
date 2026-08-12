const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function test() {
  const formData = new FormData();
  formData.append('name', 'Boleta Real');
  formData.append('paid_by', 'Gabriel');
  formData.append('receiptImage', fs.createReadStream('dummy.jpg'));

  try {
    const res = await axios.post('https://rendicion-online.onrender.com/api/reports/6/receipts', formData, {
      headers: formData.getHeaders()
    });
    console.log("SUCCESS:", res.data);
  } catch (err) {
    if (err.response) console.error("ERROR:", err.response.data);
    else console.error("ERROR:", err);
  }
}
test();

const axios = require('axios');
const FormData = require('form-data');

const baseURL = 'https://rendicion-online.onrender.com/api';

async function testBackend() {
  try {
    console.log("Creando reporte...");
    const reportRes = await axios.post(`${baseURL}/reports`, { name: 'Test Error 500' });
    const reportId = reportRes.data.id;
    console.log(`Reporte creado: ${reportId}`);

    console.log("Subiendo boleta (sin archivo)...");
    const formData = new FormData();
    formData.append('name', 'Boleta Prueba');
    formData.append('paid_by', 'Gabriel');
    formData.append('hasLocalImage', 'true');

    const res = await axios.post(`${baseURL}/reports/${reportId}/receipts`, formData, {
      headers: formData.getHeaders()
    });
    
    console.log("ÉXITO:", res.data);
  } catch (error) {
    console.error("ERROR 500:");
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testBackend();

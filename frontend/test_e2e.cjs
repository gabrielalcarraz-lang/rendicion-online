const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testEndToEnd() {
  try {
    console.log("1. Creando rendición...");
    const reportRes = await axios.post('https://rendicion-online.onrender.com/api/reports', {
      name: 'Rendición de Prueba Manual'
    });
    console.log("Rendición creada:", reportRes.data);
    const reportId = reportRes.data.id;

    console.log(`2. Subiendo boleta a rendición ${reportId}...`);
    const formData = new FormData();
    formData.append('name', 'Boleta de Prueba');
    formData.append('paid_by', 'Gabriel');
    
    formData.append('manualAmount', '1000');
    formData.append('manualDetail', 'Cena');

    const receiptRes = await axios.post(`https://rendicion-online.onrender.com/api/reports/${reportId}/receipts`, formData, {
      headers: formData.getHeaders()
    });
    
    console.log("Boleta procesada (OCR desactivado):", receiptRes.data);
    fs.unlinkSync(dummyPath);
    
    console.log("TEST EXITOSO. Flujo manual completado.");
  } catch (err) {
    console.error("ERROR:");
    if (err.response) {
      console.error(err.response.status, err.response.data);
    } else {
      console.error(err.message);
    }
  }
}

testEndToEnd();

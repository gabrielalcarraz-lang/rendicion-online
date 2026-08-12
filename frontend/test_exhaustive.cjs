const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const baseURL = 'https://rendicion-online.onrender.com/api';

async function runE2ETest() {
  try {
    console.log("=== INICIANDO PRUEBA E2E ===");
    
    // 1. Crear Reporte
    console.log("1. Creando reporte...");
    const reportRes = await axios.post(`${baseURL}/reports`, { name: 'Prueba E2E Exhaustiva' });
    const reportId = reportRes.data.id;
    console.log(`   Reporte creado con ID: ${reportId}`);

    // 2. Subir Boleta con Imagen
    console.log("2. Subiendo boleta con imagen...");
    const form1 = new FormData();
    form1.append('name', 'Boleta Foto');
    form1.append('paid_by', 'Gabriel');
    
    // Crear imagen dummy
    const dummyPath = path.join(__dirname, 'dummy.jpg');
    fs.writeFileSync(dummyPath, "fake image data");
    form1.append('receiptImage', fs.createReadStream(dummyPath));

    const rec1Res = await axios.post(`${baseURL}/reports/${reportId}/receipts`, form1, { headers: form1.getHeaders() });
    const rec1 = rec1Res.data;
    console.log(`   Boleta foto creada con ID: ${rec1.id}, image_path: ${rec1.image_path}`);

    // 3. Subir Boleta Manual
    console.log("3. Subiendo boleta manual...");
    const form2 = new FormData();
    form2.append('name', '');
    form2.append('paid_by', 'Marjorie');
    form2.append('manualDetail', 'Boleta Manual');
    form2.append('manualAmount', '15000');
    
    const rec2Res = await axios.post(`${baseURL}/reports/${reportId}/receipts`, form2, { headers: form2.getHeaders() });
    const rec2 = rec2Res.data;
    console.log(`   Boleta manual creada con ID: ${rec2.id}, total: ${rec2.total_amount}`);

    // 4. Actualizar monto de la boleta foto (Simulando la etapa de verificación)
    console.log("4. Confirmando monto de la boleta foto...");
    await axios.put(`${baseURL}/receipts/${rec1.id}`, { total_amount: 5000 });
    console.log("   Monto actualizado a 5000.");

    // 5. Asignar items a la boleta foto
    console.log("5. Asignando items...");
    await axios.post(`${baseURL}/receipts/${rec1.id}/save`, {
      items: [
        { description: 'Hamburguesa', quantity: 1, unit_price: 5000, amount: 5000, assignments: ['Gabriel', 'Marjorie'] }
      ]
    });
    console.log("   Items guardados.");

    // 6. Obtener cuadratura
    console.log("6. Calculando cuadratura...");
    const setRes = await axios.get(`${baseURL}/reports/${reportId}/settlement`);
    console.log("   Cuadratura:", setRes.data);

    // 7. Cerrar reporte
    console.log("7. Cerrando reporte...");
    await axios.post(`${baseURL}/reports/${reportId}/close`);
    console.log("   Reporte cerrado.");

    console.log("=== PRUEBA E2E EXITOSA ===");
  } catch (err) {
    console.error("=== ERROR EN PRUEBA E2E ===");
    if (err.response) {
      console.error(`Status: ${err.response.status}`);
      console.error(err.response.data);
    } else {
      console.error(err.message);
    }
  }
}

runE2ETest();

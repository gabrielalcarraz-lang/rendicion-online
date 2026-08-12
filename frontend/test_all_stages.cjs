const axios = require('axios');
const FormData = require('form-data');

const baseURL = 'https://rendicion-online.onrender.com/api';

async function runTests() {
  console.log("=== INICIANDO PRUEBAS DE ETAPAS ===");
  try {
    // ETAPA 1: Crear Rendición
    console.log("\n[ETAPA 1] Crear Rendición...");
    const reportRes = await axios.post(`${baseURL}/reports`, { name: 'Rendición de Prueba E2E' });
    const reportId = reportRes.data.id;
    console.log(`✅ Rendición creada con éxito. ID: ${reportId}`);

    // ETAPA 2: Subir Boleta (Simulando que se guarda en el celular)
    console.log("\n[ETAPA 2] Subir fotografía de la boleta...");
    const formData = new FormData();
    formData.append('name', 'Almuerzo de trabajo');
    formData.append('paid_by', 'Gabriel');
    formData.append('hasLocalImage', 'true');

    const uploadRes = await axios.post(`${baseURL}/reports/${reportId}/receipts`, formData, {
      headers: formData.getHeaders()
    });
    const receiptId = uploadRes.data.id;
    console.log(`✅ Boleta subida con éxito (sin enviar imagen a la nube). ID: ${receiptId}`);

    // ETAPA 3: Ingresar el monto manual (Rectificar monto)
    console.log("\n[ETAPA 3] Confirmar monto de la boleta...");
    const updateRes = await axios.put(`${baseURL}/receipts/${receiptId}`, { total_amount: 15000 });
    console.log(`✅ Monto ingresado con éxito. Total: $${updateRes.data.total_amount}`);

    // ETAPA 4: Ver detalles de la rendición
    console.log("\n[ETAPA 4] Ver resumen de la rendición...");
    const detailsRes = await axios.get(`${baseURL}/reports/${reportId}`);
    const receiptDetails = detailsRes.data.receipts[0];
    console.log(`✅ Detalles cargados: Boleta "${receiptDetails.name}", Monto: $${receiptDetails.total_amount}, Imagen: ${receiptDetails.image_path}`);

    // ETAPA 5: Cuadrar y cerrar
    console.log("\n[ETAPA 5] Cuadrar y cerrar rendición...");
    const closeRes = await axios.post(`${baseURL}/reports/${reportId}/close`);
    console.log(`✅ Rendición cerrada correctamente. Mensaje: ${closeRes.data.message}`);

    console.log("\n🎉 TODAS LAS ETAPAS SUPERADAS CON ÉXITO.");
  } catch (error) {
    console.error("\n❌ ERROR EN LAS PRUEBAS:");
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

runTests();

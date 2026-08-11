import axios from 'axios';

const backendHost = window.location.hostname || 'localhost';
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `http://${backendHost}:3000/api`,
});

export const getReports = () => api.get('/reports');
export const createReport = (name) => api.post('/reports', { name });
export const getReport = (id) => api.get(`/reports/${id}`);
export const uploadReceipt = (reportId, formData) => api.post(`/reports/${reportId}/receipts`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const getReceiptNames = () => api.get(`/receipt-names`);
export const updateReceipt = (receiptId, total_amount) => api.put(`/receipts/${receiptId}`, { total_amount });
export const deleteReceipt = (receiptId) => api.delete(`/receipts/${receiptId}`);
export const saveReceiptItems = (receiptId, items) => api.post(`/receipts/${receiptId}/save`, { items });
export const closeReport = (id) => api.post(`/reports/${id}/close`);
export const getSettlement = (id) => api.get(`/reports/${id}/settlement`);
export const extractRawText = (receiptId) => api.get(`/receipts/${receiptId}/extract`);
export const deleteReport = (id) => api.delete(`/reports/${id}`);

export default api;

import axios from 'axios';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('26.');
const baseURL = isLocal 
  ? `http://${window.location.hostname}:3000/api` 
  : 'https://rendicion-online.onrender.com/api';

const api = axios.create({ baseURL });

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

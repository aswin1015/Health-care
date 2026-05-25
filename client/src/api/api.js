import axios from 'axios';

// All API calls are relative — Vite proxy (dev) and nginx (prod) forward /api → api-gateway:5000
const API_URL = '';

// ─── Medical History ──────────────────────────────────────────────────────────

export const getHistory = () =>
  axios.get(`${API_URL}/api/history`).then((r) => r.data);

export const addHistory = (payload) =>
  axios.post(`${API_URL}/api/history`, payload).then((r) => r.data);

// ─── Appointments ─────────────────────────────────────────────────────────────

export const getAppointments = () =>
  axios.get(`${API_URL}/api/appointments`).then((r) => r.data);

export const addAppointment = (payload) =>
  axios.post(`${API_URL}/api/appointments`, payload).then((r) => r.data);

// ─── Medications ──────────────────────────────────────────────────────────────

export const getMedications = () =>
  axios.get(`${API_URL}/api/medications`).then((r) => r.data);

export const addMedication = (payload) =>
  axios.post(`${API_URL}/api/medications`, payload).then((r) => r.data);

export const takeMedication = (medId, time) =>
  axios.post(`${API_URL}/api/medications/${medId}/take`, { time }).then((r) => r.data);

export const missMedication = (medId, time) =>
  axios.post(`${API_URL}/api/medications/${medId}/miss`, { time }).then((r) => r.data);

export const resetMedications = () =>
  axios.post(`${API_URL}/api/medications/reset-all`).then((r) => r.data);

// ─── Caregiver ────────────────────────────────────────────────────────────────

export const getCaregiver = () =>
  axios.get(`${API_URL}/api/caregiver`).then((r) => r.data);

export const updateCaregiver = (payload) =>
  axios.post(`${API_URL}/api/caregiver`, payload).then((r) => r.data);

// ─── System Status ────────────────────────────────────────────────────────────

export const getStatus = () =>
  axios.get(`${API_URL}/api/status`).then((r) => r.data);

export const resetStatus = () =>
  axios.post(`${API_URL}/api/status/reset`).then((r) => r.data);

// ─── AI Chat ──────────────────────────────────────────────────────────────────

export const sendChatMessage = (message) =>
  axios.post(`${API_URL}/api/ai/chat`, { message }).then((r) => r.data);

// ─── Batch fetch all dashboard data ──────────────────────────────────────────

export const fetchAllDashboardData = async () => {
  const [history, appointments, medications, caregiver, systemStatus] = await Promise.all([
    getHistory(),
    getAppointments(),
    getMedications(),
    getCaregiver(),
    getStatus(),
  ]);
  return { history, appointments, medications, caregiver, systemStatus };
};

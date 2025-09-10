import axios from 'axios';
const API_BASE = import.meta.env.VITE_API_BASE || '/api';
export const api = axios.create({
  baseURL: API_BASE,
});

export default api;

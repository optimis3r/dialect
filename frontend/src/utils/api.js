import axios from 'axios';
import { API_URL, clearStoredToken, getStoredToken } from '../config';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      clearStoredToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

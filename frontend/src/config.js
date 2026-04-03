export const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

export function getStoredToken() {
  return localStorage.getItem('dialect_token') || sessionStorage.getItem('dialect_token');
}

export function storeToken(token, rememberMe = true) {
  if (rememberMe) {
    localStorage.setItem('dialect_token', token);
    sessionStorage.removeItem('dialect_token');
  } else {
    sessionStorage.setItem('dialect_token', token);
    localStorage.removeItem('dialect_token');
  }
}

export function clearStoredToken() {
  localStorage.removeItem('dialect_token');
  sessionStorage.removeItem('dialect_token');
}

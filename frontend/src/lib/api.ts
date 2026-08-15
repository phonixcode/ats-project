import axios from 'axios';

function resolveApiBase() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:3000';
  if (window.mgAts?.apiBase) return window.mgAts.apiBase;
  if (window.location.port === '5173' || window.location.port === '5174') {
    return 'http://127.0.0.1:3000';
  }
  return window.location.origin;
}

export const api = axios.create({
  baseURL: resolveApiBase(),
});

import axios from 'axios';

// PHASE 1 §4 — send the httpOnly cookie with every request.
const API = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL,
    
  withCredentials: true,
});

// PHASE 1 §4 — drop the localStorage token interceptor. The cookie is sent
// automatically. Kept empty for now so future interceptors can be added here.

// PHASE 1 §4.6 / §6.2 — handle auth failures uniformly.
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Clear in-memory user so AuthContext logout() rerenders cleanly.
      // We don't redirect here — the page-level components decide where to go.
      window.dispatchEvent(new CustomEvent('crypnight:auth-expired'));
    }
    if (err.response?.status === 403) {
      const msg = err.response?.data?.error || '';
      if (msg.toLowerCase().includes('verify your email')) {
        window.dispatchEvent(new CustomEvent('crypnight:needs-verification'));
      }
    }
    return Promise.reject(err);
  }
);

export default API;

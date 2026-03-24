const API_URL = "http://vaibhly-backend1.onrender.com/api";
const API_BASE = 'http://vaibhly-backend1.onrender.com/api';

async function apiRequest(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  return res.json();
}

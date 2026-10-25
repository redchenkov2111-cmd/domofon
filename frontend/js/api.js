const API_BASE = "/api";

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    if (!location.pathname.endsWith("index.html") && location.pathname !== "/") {
      location.href = "index.html";
    }
    throw new Error("Требуется авторизация");
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {}
    throw new Error(detail);
  }

  if (res.status === 204) return null;
  return res.json();
}

const api = {
  login: (phone, password) =>
    apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ phone, password }) }),

  listUsers: () => apiFetch("/users"),
  createUser: (data) => apiFetch("/users", { method: "POST", body: JSON.stringify(data) }),
  deleteUser: (id) => apiFetch(`/users/${id}`, { method: "DELETE" }),

  makeCall: (callee_id) =>
    apiFetch("/calls", { method: "POST", body: JSON.stringify({ callee_id }) }),
  answerCall: (call_id, accepted) =>
    apiFetch(`/calls/${call_id}/answer`, { method: "POST", body: JSON.stringify({ accepted }) }),
  history: () => apiFetch("/calls/history"),
};

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}
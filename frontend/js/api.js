const API_BASE = "https://api-gateway-me3u.onrender.com/api";

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    // Читаем как текст, чтобы не падать на пустом ответе
    const text = await res.text();
    let data = null;
    
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = text;
      }
    }

    if (res.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (!location.pathname.endsWith("index.html") && location.pathname !== "/" && location.pathname !== "") {
        location.href = "index.html";
      }
      throw new Error("Требуется авторизация");
    }

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      if (data) {
        if (typeof data === "string") {
          const clean = data.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          detail = clean.length < 200 ? (clean || detail) : detail;
        } else {
          detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail ?? data);
        }
      }
      throw new Error(detail);
    }

    if (res.status === 204) return null;
    return data;
  } catch (e) {
    if (e.name === "TypeError" || e.message === "Failed to fetch") {
      throw new Error("Сервер недоступен или просыпается (это занимает до 60 секунд).");
    }
    throw e;
  }
}

const api = {
  login: (phone, password) =>
    apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ phone, password }) }),

  listUsers: () => apiFetch("/users"),
  createUser: (data) => apiFetch("/users", { method: "POST", body: JSON.stringify(data) }),
  deleteUser: (id) => apiFetch(`/users/${id}`, { method: "DELETE" }),
  updateUser: (id, data) => apiFetch(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  makeCall: (callee_id) =>
    apiFetch("/calls", { method: "POST", body: JSON.stringify({ callee_id }) }),
  answerCall: (call_id, accepted) =>
    apiFetch(`/calls/${call_id}/answer`, { method: "POST", body: JSON.stringify({ accepted }) }),
  endCall: (call_id) => 
    apiFetch(`/calls/${call_id}/end`, { method: "POST" }),

  history: () => apiFetch("/calls/history"),
};

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}

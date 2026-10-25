requireAuth();
fillHeader();

const me = getUser();
let usersCache = [];

async function loadUsers() {
  usersCache = await api.listUsers();
  const select = document.getElementById("callee");
  select.innerHTML = '<option value="">— выберите абонента —</option>' +
    usersCache
      .filter((u) => u.id !== me.id)
      .map((u) => `<option value="${u.id}">${escapeHtml(u.name)} — кв. ${escapeHtml(u.apartment_number)}</option>`)
      .join("");
}

function userName(id) {
  const u = usersCache.find((x) => x.id === id);
  return u ? u.name : "#" + id;
}

function statusBadge(status) {
  const cls = status === "accepted" ? "ok" : status === "rejected" ? "err" : "warn";
  return `<span class="badge ${cls}">${status}</span>`;
}

async function loadHistory() {
  const tbody = document.querySelector("#history-table tbody");
  try {
    const calls = await api.history();
    if (!calls.length) {
      tbody.innerHTML = "<tr><td colspan='6' class='muted'>Звонков пока нет</td></tr>";
      return;
    }
    tbody.innerHTML = calls.map((c) => {
      const canAnswer = c.status === "ringing" && c.callee_id === me.id;
      const actions = canAnswer
        ? `<button class="ok" data-id="${c.id}" data-accepted="true">Принять</button>
           <button class="danger" data-id="${c.id}" data-accepted="false">Отклонить</button>`
        : "";
      return `<tr>
        <td>${c.id}</td>
        <td>${escapeHtml(userName(c.caller_id))}</td>
        <td>${escapeHtml(userName(c.callee_id))}</td>
        <td>${statusBadge(c.status)}</td>
        <td>${new Date(c.created_at).toLocaleString()}</td>
        <td>${actions}</td>
      </tr>`;
    }).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan='6' class='error'>${escapeHtml(e.message)}</td></tr>`;
  }
}

document.getElementById("call-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("call-error");
  errEl.textContent = "";
  const calleeId = Number(document.getElementById("callee").value);
  if (!calleeId) { errEl.textContent = "Выберите абонента"; return; }
  try {
    await api.makeCall(calleeId);
    await loadHistory();
  } catch (e) {
    errEl.textContent = e.message;
  }
});

document.querySelector("#history-table").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-id]");
  if (!btn) return;
  const callId = Number(btn.dataset.id);
  const accepted = btn.dataset.accepted === "true";
  try {
    await api.answerCall(callId, accepted);
    await loadHistory();
  } catch (e) {
    alert(e.message);
  }
});

(async () => {
  try { await loadUsers(); } catch (e) { console.error(e); }
  await loadHistory();
  setInterval(loadHistory, 5000);
})();
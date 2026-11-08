requireAuth();
fillHeader();

const me = getUser();
let usersCache = [];
let currentCalls = [];

async function loadUsers() {
  usersCache = await api.listUsers();
  const select = document.getElementById("callee");
  if (!select) return;
  select.innerHTML = '<option value="">— выберите абонента —</option>' +
  usersCache
    .filter((u) => u.id !== me.id && (me.role === "admin" || u.role !== "admin"))
    .map((u) => `<option value="${u.id}">${escapeHtml(u.name)} — кв. ${escapeHtml(u.apartment_number)}</option>`)
    .join("");
}

function userName(id) {
  const u = usersCache.find((x) => x.id === id);
  return u ? u.name : "#" + id;
}

function statusBadge(status) {
  const cls = status === "accepted" ? "ok"
            : status === "rejected" ? "err"
            : status === "ended"    ? "ended"
            : "warn";
  return `<span class="badge ${cls}">${status}</span>`;
}

function formatDuration(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function renderHistory() {
  const tbody = document.querySelector("#history-table tbody");
  if (!currentCalls.length) {
    tbody.innerHTML = "<tr><td colspan='7' class='muted'>Звонков пока нет</td></tr>";
    return;
  }
  tbody.innerHTML = currentCalls.map((c) => {
    let actions = "";
    if (c.status === "ringing" && c.callee_id === me.id) {
      actions = `<button class="ok" data-id="${c.id}" data-accepted="true">Принять</button>
                 <button class="danger" data-id="${c.id}" data-accepted="false">Отклонить</button>`;
    } else if (c.status === "accepted" || (c.status === "ringing" && c.caller_id === me.id)) {
      actions = `<button class="danger" data-end-id="${c.id}">Завершить</button>`;
    }

    let durationText = "-";
    if (c.status === "accepted" && c.answered_at) {
      durationText = formatDuration(Date.now() - new Date(c.answered_at).getTime()) + " (идет)";
    } else if (c.ended_at && c.answered_at) {
      durationText = formatDuration(new Date(c.ended_at).getTime() - new Date(c.answered_at).getTime());
    }

    return `<tr>
      <td>${c.id}</td>
      <td>${escapeHtml(userName(c.caller_id))}</td>
      <td>${escapeHtml(userName(c.callee_id))}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${new Date(c.created_at).toLocaleString()}</td>
      <td data-duration-id="${c.id}">${durationText}</td>
      <td>${actions}</td>
    </tr>`;
  }).join("");
}

async function loadHistory() {
  try {
    currentCalls = await api.history();
    renderHistory();
  } catch (e) {
    document.querySelector("#history-table tbody").innerHTML =
      `<tr><td colspan='7' class='error'>${escapeHtml(e.message)}</td></tr>`;
  }
}

// Таймер — обновляем только ячейки длительности, раз в секунду
setInterval(() => {
  document.querySelectorAll("[data-duration-id]").forEach((td) => {
    const callId = Number(td.dataset.durationId);
    const call = currentCalls.find((c) => c.id === callId);
    if (call && call.status === "accepted" && call.answered_at) {
      td.textContent = formatDuration(Date.now() - new Date(call.answered_at).getTime()) + " (идет)";
    }
  });
}, 1000);

// Форма звонка
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

// Кнопки в таблице
document.querySelector("#history-table").addEventListener("click", async (e) => {
  const ansBtn = e.target.closest("button[data-id]");
  const endBtn = e.target.closest("button[data-end-id]");
  if (ansBtn) {
    try {
      await api.answerCall(Number(ansBtn.dataset.id), ansBtn.dataset.accepted === "true");
      await loadHistory();
    } catch (e) { alert(e.message); }
  }
  if (endBtn) {
    try {
      await api.endCall(Number(endBtn.dataset.endId));
      await loadHistory();
    } catch (e) { alert(e.message); }
  }
});

// --- WebSocket ---
function connectWebSocket() {
  const token = localStorage.getItem("token");
  if (!token) return;
  
  const ws = new WebSocket(`wss://api-gateway-me3u.onrender.com/ws?token=${token}`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.event === "incoming_call") {
      if (data.from !== me.id) {
        playRing();
        showIncomingModal(data.call_id, data.from);
      }
    } else if (data.event === "call_answered" || data.event === "call_ended") {
      document.getElementById("incoming-modal")?.remove();
      loadHistory();
    }
  };

  ws.onclose = (event) => {
    if (event.code === 1008) return;
    setTimeout(connectWebSocket, 3000);
  };
}

// Короткий звук через Web Audio API (без файлов)
function playRing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.1;
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, 400);
  } catch {}
}

// Модалка входящего звонка
function showIncomingModal(callId, fromId) {
  if (document.getElementById("incoming-modal")) return;
  const modal = document.createElement("div");
  modal.id = "incoming-modal";
  modal.style = `position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center; z-index: 999;`;
  modal.innerHTML = `
    <div style="background: white; padding: 24px; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
      <h2 style="margin-top: 0;">Входящий звонок!</h2>
      <p>Звонит: <b>${escapeHtml(userName(fromId))}</b></p>
      <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
        <button class="ok" onclick="answerIncoming(${callId}, true)">Принять</button>
        <button class="danger" onclick="answerIncoming(${callId}, false)">Отклонить</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

window.answerIncoming = async (callId, accepted) => {
  document.getElementById("incoming-modal")?.remove();
  try {
    await api.answerCall(callId, accepted);
    loadHistory();
  } catch (e) { alert(e.message); }
};

// Запуск
(async () => {
  try { await loadUsers(); } catch (e) { console.error(e); }
  await loadHistory();
  connectWebSocket();
})();
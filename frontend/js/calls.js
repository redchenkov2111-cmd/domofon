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
  const cls = status === "accepted" ? "ok" : status === "rejected" ? "err" : status === "ended" ? "muted" : "warn";
  return `<span class="badge ${cls}">${status}</span>`;
}

// Функция для красивого вывода времени (MM:SS)
function formatDuration(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

async function loadHistory() {
  const tbody = document.querySelector("#history-table tbody");
  try {
    const calls = await api.history();
    if (!calls.length) {
      tbody.innerHTML = "<tr><td colspan='7' class='muted'>Звонков пока нет</td></tr>";
      return;
    }
    
    const now = new Date().getTime();

    tbody.innerHTML = calls.map((c) => {
      let actions = "";
      
      if (c.status === "ringing" && c.callee_id === me.id) {
        // У вызываемого: принять или отклонить
        actions = `<button class="ok" data-id="${c.id}" data-accepted="true">Принять</button>
                   <button class="danger" data-id="${c.id}" data-accepted="false">Отклонить</button>`;
      } else if (c.status === "accepted" || (c.status === "ringing" && c.caller_id === me.id)) {
        // У вызывающего (или если уже принят): кнопка сбросить
        actions = `<button class="danger" data-end-id="${c.id}">Завершить</button>`;
      }

      // Считаем время
      let duration = "-";
      if (c.status === "accepted") {
        duration = formatDuration(now - new Date(c.answered_at).getTime()) + " (идет)";
      } else if (c.ended_at && c.answered_at) {
        duration = formatDuration(new Date(c.ended_at).getTime() - new Date(c.answered_at).getTime());
      }

      return `<tr>
        <td>${c.id}</td>
        <td>${escapeHtml(userName(c.caller_id))}</td>
        <td>${escapeHtml(userName(c.callee_id))}</td>
        <td>${statusBadge(c.status)}</td>
        <td>${new Date(c.created_at).toLocaleString()}</td>
        <td>${duration}</td>
        <td>${actions}</td>
      </tr>`;
    }).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan='7' class='error'>${escapeHtml(e.message)}</td></tr>`;
  }
}

// Обработка нажатий (Принять/Отклонить/Завершить)
document.querySelector("#history-table").addEventListener("click", async (e) => {
  const ansBtn = e.target.closest("button[data-id]");
  const endBtn = e.target.closest("button[data-end-id]");
  
  if (ansBtn) {
    const callId = Number(ansBtn.dataset.id);
    const accepted = ansBtn.dataset.accepted === "true";
    try {
      await api.answerCall(callId, accepted);
      await loadHistory();
    } catch (e) { alert(e.message); }
  }
  
  if (endBtn) {
    const callId = Number(endBtn.dataset.endId);
    try {
      await api.endCall(callId);
      await loadHistory();
    } catch (e) { alert(e.message); }
  }
});

// --- WebSocket ---
function connectWebSocket() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws?token=${token}`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    // Сервер прислал событие!
    if (data.event === "incoming_call") {
      // Показываем модальное окно, если звонят НАМ
      if (data.from !== me.id) {
        showIncomingModal(data.call_id, data.from);
      }
    } else if (data.event === "call_answered") {
      // Звонок приняли/отклонили — убираем модалку и обновляем таблицу
      document.getElementById("incoming-modal")?.remove();
      loadHistory();
    } else if (data.event === "call_ended") {
      // Звонок завершен — убираем модалку и обновляем таблицу
      document.getElementById("incoming-modal")?.remove();
      loadHistory();
    }
  }; // <-- Здесь была твоя ошибка (лишние скобки)

  ws.onclose = (event) => {
    // Если токен невалидный (1008), не пытаемся переподключиться
    if (event.code === 1008) return; 
    // Иначе переподключаемся через 3 секунды
    setTimeout(connectWebSocket, 3000);
  };
} // <-- Здесь тоже не хватало скобки, закрывающей функцию connectWebSocket

// Простая модалка для входящего звонка
function showIncomingModal(callId, fromId) {
  if (document.getElementById("incoming-modal")) return; // уже открыта
  
  const modal = document.createElement("div");
  modal.id = "incoming-modal";
  modal.style = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center; z-index: 999;
  `;
  
  modal.innerHTML = `
    <div style="background: white; padding: 24px; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
      <h2 style="margin-top: 0;">Входящий звонок!</h2>
      <p>Звонит: <b>${escapeHtml(userName(fromId))}</b></p>
      <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
        <button class="ok" onclick="answerIncoming(${callId}, true)">Принять</button>
        <button class="danger" onclick="answerIncoming(${callId}, false)">Отклонить</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

window.answerIncoming = async (callId, accepted) => {
  document.getElementById("incoming-modal")?.remove();
  try {
    await api.answerCall(callId, accepted);
    loadHistory();
  } catch (e) {
    alert(e.message);
  }
};

// Запускаем сокет и первичную загрузку
(async () => {
  try { await loadUsers(); } catch (e) { console.error(e); }
  await loadHistory();
  connectWebSocket();
})();
requireAuth();
fillHeader();

const me = getUser();
if (!me || me.role !== "admin") {
  alert("Доступ только для администратора");
  location.href = "calls.html";
}

let allUsers = [];

function refreshHouseFilter() {
  const select = document.getElementById("filter-house");
  if (!select) return;
  const current = select.value;
  const houses = [...new Set(allUsers.map((u) => u.house))].sort();
  select.innerHTML = '<option value="">— все —</option>' +
    houses.map((h) => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join("");
  select.value = current;
}

function renderTable() {
  const tbody = document.querySelector("#users-table tbody");
  const filterHouse = document.getElementById("filter-house")?.value || "";
  const filtered = filterHouse
    ? allUsers.filter((u) => u.house === filterHouse)
    : allUsers;

  if (!filtered.length) {
    tbody.innerHTML = "<tr><td colspan='7' class='muted'>Нет пользователей</td></tr>";
    return;
  }

  tbody.innerHTML = filtered.map((u) => {
    const phoneDisplay = (u.role === "admin" && u.id !== me.id)
      ? '<span class="muted">—</span>'
      : escapeHtml(u.phone);

    return `
      <tr>
        <td>${u.id}</td>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.apartment_number)}</td>
        <td>${escapeHtml(u.house)}</td>
        <td>${phoneDisplay}</td>
        <td>${escapeHtml(u.role)}</td>
        <td>
          <button class="ok" data-edit-id="${u.id}" data-apt="${escapeHtml(u.apartment_number)}" data-house="${escapeHtml(u.house)}">Изменить</button>
          <button class="danger" data-id="${u.id}">Удалить</button>
        </td>
      </tr>`;
  }).join("");
}

async function loadUsers() {
  const tbody = document.querySelector("#users-table tbody");
  tbody.innerHTML = "<tr><td colspan='7' class='muted'>Загрузка…</td></tr>";
  try {
    allUsers = await api.listUsers();
    refreshHouseFilter();
    renderTable();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan='7' class='error'>${escapeHtml(e.message)}</td></tr>`;
  }
}

// Фильтр по дому
document.getElementById("filter-house")?.addEventListener("change", renderTable);

// Форма создания
document.getElementById("create-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const payload = {
    name: f.get("name").trim(),
    apartment_number: f.get("apartment_number").trim(),
    house: f.get("house").trim() || "Дом 1",
    phone: f.get("phone").trim(),
    password: f.get("password"),
    role: f.get("role"),
  };
  const errEl = document.getElementById("create-error");
  errEl.textContent = "";
  try {
    await api.createUser(payload);
    e.target.reset();
    e.target.querySelector('input[name="house"]').value = "Дом 1";
    loadUsers();
  } catch (e) {
    errEl.textContent = e.message;
  }
});

// Кнопки «Изменить» / «Удалить»
document.querySelector("#users-table").addEventListener("click", async (e) => {
  const delBtn = e.target.closest("button[data-id]");
  const editBtn = e.target.closest("button[data-edit-id]");

  if (delBtn) {
    if (!confirm("Удалить пользователя?")) return;
    try {
      await api.deleteUser(Number(delBtn.dataset.id));
      loadUsers();
    } catch (e) { alert(e.message); }
  }

  if (editBtn) {
    const id = Number(editBtn.dataset.editId);
    const currentApt = editBtn.dataset.apt;
    const currentHouse = editBtn.dataset.house;

    const newApt = prompt(`Новая квартира (сейчас: ${currentApt}):`, currentApt);
    if (newApt === null) return;
    if (newApt !== currentApt) {
      try {
        await api.updateUser(id, { apartment_number: newApt.trim() });
      } catch (e) { alert("Квартира: " + e.message); return; }
    }

    const newHouse = prompt(`Новый дом (сейчас: ${currentHouse}):`, currentHouse);
    if (newHouse === null) return;
    if (newHouse !== currentHouse) {
      try {
        await api.updateUser(id, { house: newHouse.trim() });
      } catch (e) { alert("Дом: " + e.message); return; }
    }

    loadUsers();
  }
});

loadUsers();
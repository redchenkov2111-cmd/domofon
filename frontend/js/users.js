requireAuth();
fillHeader();

const me = getUser();
if (!me || me.role !== "admin") {
  document.getElementById("admin-only").style.display = "none";
}

async function loadUsers() {
  const tbody = document.querySelector("#users-table tbody");
  tbody.innerHTML = "<tr><td colspan='6' class='muted'>Загрузка…</td></tr>";
  try {
    const users = await api.listUsers();
    if (!users.length) {
      tbody.innerHTML = "<tr><td colspan='6' class='muted'>Пользователей нет</td></tr>";
      return;
    }
    tbody.innerHTML = users.map((u) => `
      <tr>
        <td>${u.id}</td>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.apartment_number)}</td>
        <td>${escapeHtml(u.phone)}</td>
        <td>${escapeHtml(u.role)}</td>
        <td>${me && me.role === "admin" ? `<button class="danger" data-id="${u.id}">Удалить</button>` : ""}</td>
      </tr>`).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan='6' class='error'>${escapeHtml(e.message)}</td></tr>`;
  }
}

const createForm = document.getElementById("create-form");
if (createForm) {
  createForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const payload = {
      name: f.get("name").trim(),
      apartment_number: f.get("apartment_number").trim(),
      phone: f.get("phone").trim(),
      password: f.get("password"),
      role: f.get("role"),
    };
    const errEl = document.getElementById("create-error");
    errEl.textContent = "";
    try {
      await api.createUser(payload);
      e.target.reset();
      loadUsers();
    } catch (e) {
      errEl.textContent = e.message;
    }
  });
}

document.querySelector("#users-table").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-id]");
  if (!btn) return;
  if (!confirm("Удалить пользователя?")) return;
  try {
    await api.deleteUser(Number(btn.dataset.id));
    loadUsers();
  } catch (e) {
    alert(e.message);
  }
});

loadUsers();
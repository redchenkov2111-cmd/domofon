function getUser() {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

function requireAuth() {
  if (!localStorage.getItem("token")) {
    location.href = "index.html";
    throw new Error("redirect");
  }
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  location.href = "index.html";
}

function fillHeader() {
  const me = getUser();
  if (!me) return;
  const userSlot = document.querySelector("header nav .user");
  if (userSlot) {
    userSlot.innerHTML =
      "<span>" + escapeHtml(me.name) + " (" + escapeHtml(me.role) + ")</span>" +
      '<a href="#" id="logout-link">Выйти</a>';
    document.getElementById("logout-link").addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }
  const path = location.pathname.split("/").pop();
  document.querySelectorAll("header nav a[data-page]").forEach((a) => {
    if (a.dataset.page === path) a.classList.add("active");
  });
}
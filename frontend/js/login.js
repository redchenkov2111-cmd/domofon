if (localStorage.getItem("token")) {
  location.href = "calls.html";
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const phone = document.getElementById("phone").value.trim();
  const password = document.getElementById("password").value;
  const errEl = document.getElementById("error");
  errEl.textContent = "";
  try {
    const data = await api.login(phone, password);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    location.href = "calls.html";
  } catch (e) {
    errEl.textContent = e.message;
  }
});
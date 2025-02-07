document.addEventListener("DOMContentLoaded", function () {
  const tabs = document.querySelectorAll(".tab");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach(tab => {
    tab.addEventListener("click", function () {
      tabs.forEach(t => t.classList.remove("active"));
      contents.forEach(c => c.classList.remove("active"));

      this.classList.add("active");
      document.getElementById("content-" + this.id.replace("tab-", "")).classList.add("active");
    });
  });

  const cookieNameInput = document.getElementById("cookieName");
  const cookieValueInput = document.getElementById("cookieValue");
  const userIdInput = document.getElementById("userId");
  const saveButton = document.getElementById("saveConfig");
  const statusText = document.getElementById("status");

  chrome.storage.local.get(["manualCookieName", "manualCookieValue", "userId"], function (data) {
    if (data.manualCookieName) cookieNameInput.value = data.manualCookieName;
    if (data.manualCookieValue) cookieValueInput.value = data.manualCookieValue;
    if (data.userId) userIdInput.value = data.userId;
  });

  saveButton.addEventListener("click", function () {
    const cookieName = cookieNameInput.value.trim();
    const cookieValue = cookieValueInput.value.trim();
    const userId = userIdInput.value.trim();

    if (cookieName && cookieValue && userId) {
      chrome.storage.local.set({ manualCookieName: cookieName, manualCookieValue: cookieValue, userId: userId }, function () {
        statusText.innerText = "Configuración guardada.";
        statusText.style.color = "green";
      });
    } else {
      statusText.innerText = "Completa todos los campos.";
      statusText.style.color = "red";
    }
  });

  document.getElementById("exportExcel").addEventListener("click", function () {
    chrome.storage.local.get(["manualCookieName", "manualCookieValue", "userId", "startDate", "endDate"], function (data) {
      if (data.manualCookieName && data.manualCookieValue && data.userId) {
        chrome.runtime.sendMessage({
          action: "run_script",
          cookieName: data.manualCookieName,
          cookieValue: data.manualCookieValue,
          userId: data.userId,
          startDate: document.getElementById("startDate").value,
          endDate: document.getElementById("endDate").value
        });
      } else {
        alert("Debes configurar la cookie y el UserID antes de exportar.");
      }
    });
  });
});
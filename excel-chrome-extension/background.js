chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "run_script") {
    chrome.storage.local.get(["manualCookieName", "manualCookieValue", "userId"], function (data) {
      if (data.manualCookieName && data.manualCookieValue && data.userId) {
        const params = {
          startDate: new Date(message.startDate),
          endDate: new Date(message.endDate),
          userId: data.userId,
          cookie: `${data.manualCookieName}=${data.manualCookieValue}`
        };

        return true;
      }
    });
  }
});
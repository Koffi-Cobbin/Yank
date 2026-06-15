const toggle = document.getElementById("enabledToggle");
const urlInput = document.getElementById("urlInput");
const addBtn = document.getElementById("addBtn");
const statusMsg = document.getElementById("statusMsg");
const openAppBtn = document.getElementById("openAppBtn");

chrome.storage.sync.get(["enabled"], (result) => {
  toggle.checked = result.enabled !== false;
});

toggle.addEventListener("change", () => {
  chrome.runtime.sendMessage(
    { type: "TOGGLE_ENABLED", enabled: toggle.checked },
    () => {
      showStatus(toggle.checked ? "Interception enabled" : "Interception disabled", "ok");
    }
  );
});

addBtn.addEventListener("click", () => {
  const url = urlInput.value.trim();
  if (!url || !url.startsWith("http")) {
    showStatus("Please enter a valid URL", "err");
    return;
  }

  addBtn.disabled = true;
  addBtn.textContent = "Adding…";

  chrome.runtime.sendMessage(
    {
      type: "ADD_DOWNLOAD",
      payload: {
        url,
        filename: url.split("/").pop() || "download",
        priority: "normal",
      },
    },
    (resp) => {
      addBtn.disabled = false;
      addBtn.textContent = "Add to Yank";
      if (resp && resp.success) {
        showStatus("Download added!", "ok");
        urlInput.value = "";
      } else {
        showStatus("Failed — is Yank running?", "err");
      }
    }
  );
});

openAppBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: "http://localhost:5000" });
});

function showStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = `status ${type}`;
  setTimeout(() => {
    statusMsg.textContent = "";
    statusMsg.className = "status";
  }, 3000);
}

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addBtn.click();
});

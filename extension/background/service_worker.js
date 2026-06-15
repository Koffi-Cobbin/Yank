const YANK_API = "http://localhost:6801";
let extensionEnabled = true;

chrome.storage.sync.get(["enabled"], (result) => {
  extensionEnabled = result.enabled !== false;
});

chrome.downloads.onCreated.addListener(async (downloadItem) => {
  if (!extensionEnabled) return;

  const url = downloadItem.url;
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return;

  try {
    chrome.downloads.cancel(downloadItem.id);
    chrome.downloads.erase({ id: downloadItem.id });
  } catch (e) {}

  const filename = downloadItem.filename || url.split("/").pop() || "download";
  const cookies = await getCookiesForUrl(url);

  try {
    await fetch(`${YANK_API}/downloads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        filename,
        referrer: downloadItem.referrer || "",
        cookies,
        priority: "normal",
      }),
    });
  } catch (e) {
    console.warn("Yank: failed to hand off download", e);
    chrome.downloads.download({ url });
  }
});

async function getCookiesForUrl(url) {
  try {
    const cookies = await chrome.cookies.getAll({ url });
    return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  } catch {
    return "";
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TOGGLE_ENABLED") {
    extensionEnabled = message.enabled;
    chrome.storage.sync.set({ enabled: extensionEnabled });
    sendResponse({ enabled: extensionEnabled });
  }
  if (message.type === "ADD_DOWNLOAD") {
    fetch(`${YANK_API}/downloads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload),
    })
      .then((r) => r.json())
      .then((data) => sendResponse({ success: true, data }))
      .catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }
});

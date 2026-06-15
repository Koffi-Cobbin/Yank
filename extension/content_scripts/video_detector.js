(function () {
  "use strict";

  function injectDownloadButton(src, label) {
    if (!src || document.querySelector(`[data-yank-src="${CSS.escape(src)}"]`)) return;

    const btn = document.createElement("button");
    btn.textContent = "⬇ Yank";
    btn.title = `Download with Yank: ${src}`;
    btn.dataset.yankSrc = src;
    btn.style.cssText = [
      "position:absolute",
      "z-index:2147483647",
      "background:#1a56db",
      "color:#fff",
      "border:none",
      "border-radius:4px",
      "padding:4px 8px",
      "font-size:12px",
      "cursor:pointer",
      "font-family:sans-serif",
    ].join(";");

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      chrome.runtime.sendMessage({
        type: "ADD_DOWNLOAD",
        payload: {
          url: src,
          filename: label || src.split("/").pop() || "video",
          priority: "normal",
        },
      });
      btn.textContent = "✓ Sent to Yank";
      btn.style.background = "#057a55";
      setTimeout(() => btn.remove(), 2000);
    });

    document.body.appendChild(btn);

    const positionBtn = () => {
      const el = document.querySelector(`video[src="${src}"], source[src="${src}"]`);
      if (el) {
        const rect = (el.closest("video") || el).getBoundingClientRect();
        btn.style.top = `${window.scrollY + rect.top + 8}px`;
        btn.style.left = `${window.scrollX + rect.left + 8}px`;
      }
    };
    positionBtn();
    window.addEventListener("scroll", positionBtn, { passive: true });
  }

  function scanForVideos() {
    document.querySelectorAll("video").forEach((video) => {
      if (video.src) injectDownloadButton(video.src, video.title || "");
      video.querySelectorAll("source").forEach((source) => {
        if (source.src) injectDownloadButton(source.src, "");
      });
    });
  }

  scanForVideos();

  const observer = new MutationObserver(() => scanForVideos());
  observer.observe(document.body, { childList: true, subtree: true });
})();

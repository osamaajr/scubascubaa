(() => {
  const overlayId = "scubascubaa-extension-overlay";
  const existingOverlay = document.getElementById(overlayId);

  if (existingOverlay) {
    existingOverlay.remove();
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = overlayId;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "scubascubaa-close";
  closeButton.setAttribute("aria-label", "Close ScubaScubaa camera");
  closeButton.textContent = "x";
  closeButton.addEventListener("click", () => overlay.remove());

  const frame = document.createElement("iframe");
  frame.title = "ScubaScubaa camera";
  frame.allow = "camera; autoplay";
  frame.src = chrome.runtime.getURL("extension/app.html?embedded=1");

  overlay.append(closeButton, frame);
  document.documentElement.append(overlay);
})();

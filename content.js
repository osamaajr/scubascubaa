(() => {
  const cameraOverlayId = "scubascubaa-camera-overlay";
  const gatoOverlayId = "scubascubaa-gato-overlay";
  const extensionOrigin = new URL(chrome.runtime.getURL("")).origin;
  const existingCamera = document.getElementById(cameraOverlayId);

  if (existingCamera) {
    removeOverlay(cameraOverlayId);
    removeOverlay(gatoOverlayId);
    return;
  }

  installMessageBridge();
  createCameraOverlay();

  function createCameraOverlay() {
    const overlay = createOverlay(cameraOverlayId, "Close ScubaScubaa camera");
    const frame = document.createElement("iframe");

    frame.title = "ScubaScubaa camera";
    frame.allow = "camera; autoplay";
    frame.src = chrome.runtime.getURL("extension/app.html?embedded=1");

    overlay.append(frame);
    document.documentElement.append(overlay);
  }

  function createGatoOverlay() {
    if (document.getElementById(gatoOverlayId)) {
      return;
    }

    const overlay = createOverlay(gatoOverlayId, "Close GATO MODE");
    const frame = document.createElement("iframe");

    frame.title = "GATO MODE";
    frame.allow = "autoplay";
    frame.src = chrome.runtime.getURL("extension/gato.html");

    overlay.append(frame);
    document.documentElement.append(overlay);
  }

  function createOverlay(id, closeLabel) {
    const overlay = document.createElement("div");
    const closeButton = document.createElement("button");

    overlay.id = id;
    closeButton.type = "button";
    closeButton.className = "scubascubaa-close";
    closeButton.setAttribute("aria-label", closeLabel);
    closeButton.textContent = "x";
    closeButton.addEventListener("click", () => {
      removeOverlay(id);
      if (id === cameraOverlayId) {
        removeOverlay(gatoOverlayId);
      }
    });

    overlay.append(closeButton);
    return overlay;
  }

  function installMessageBridge() {
    if (window.__scubascubaaMessageBridgeInstalled) {
      return;
    }

    window.__scubascubaaMessageBridgeInstalled = true;
    window.addEventListener("message", (event) => {
      if (event.origin !== extensionOrigin || event.data?.source !== "scubascubaa") {
        return;
      }

      if (event.data.type === "gato:start") {
        createGatoOverlay();
      }

      if (event.data.type === "gato:stop") {
        removeOverlay(gatoOverlayId);
      }
    });
  }

  function removeOverlay(id) {
    document.getElementById(id)?.remove();
  }
})();

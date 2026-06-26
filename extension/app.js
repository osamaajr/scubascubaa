import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker
} from "../vendor/mediapipe/tasks-vision/vision_bundle.mjs";

const HOLD_NOSE_DISTANCE_RATIO = 0.32;
const WAVE_DISTANCE_RATIO = 0.1;
const SIDEWAYS_RATIO = 0.8;
const WAVE_HISTORY_FRAMES = 12;
const STOP_DELAY_MS = 2500;
const HINT_DELAY_MS = 7000;
const GATO_WINDOW_WIDTH = 520;
const GATO_WINDOW_HEIGHT = 360;

const videoFrame = document.querySelector("#videoFrame");
const camera = document.querySelector("#camera");
const overlay = document.querySelector("#overlay");
const ctx = overlay.getContext("2d");
const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");
const statusText = document.querySelector("#statusText");
const emptyState = document.querySelector("#emptyState");
const hintText = document.querySelector("#hintText");
const gatoAudio = document.querySelector("#gatoAudio");
const faceSignal = document.querySelector("#faceSignal");
const handSignal = document.querySelector("#handSignal");
const gestureSignal = document.querySelector("#gestureSignal");
const modeSignal = document.querySelector("#modeSignal");

let stream = null;
let animationId = null;
let handLandmarker = null;
let faceLandmarker = null;
let loadPromise = null;
let lastVideoTime = -1;
let lastDanceTime = 0;
let waitingSince = 0;
let gatoIsActive = false;
let gatoWindowId = null;
let gatoWindowOpening = false;
let waveHistory = [];

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

startButton.addEventListener("click", start);
stopButton.addEventListener("click", stop);
window.addEventListener("beforeunload", stop);

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId !== gatoWindowId) {
    return;
  }

  gatoWindowId = null;
  gatoWindowOpening = false;
  gatoIsActive = false;
  stopAudio();
  setSignal(modeSignal, "Off");
});

async function start() {
  startButton.disabled = true;
  statusText.textContent = "Loading hand and face models...";

  try {
    await loadModels();
    await unlockMedia();

    statusText.textContent = "Requesting camera permission...";
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user"
      },
      audio: false
    });

    camera.srcObject = stream;
    await camera.play();
    syncCanvasToVideo();

    emptyState.classList.add("is-hidden");
    hideHint();
    stopButton.disabled = false;
    waitingSince = performance.now();
    statusText.textContent = "Watching for the gesture.";
    animationId = requestAnimationFrame(processFrame);
  } catch (error) {
    console.error(error);
    statusText.textContent = makeErrorMessage(error);
    startButton.disabled = false;
    stopButton.disabled = true;
    stopStream();
  }
}

function stop() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  stopGatoMode();
  stopStream();
  clearCanvas();
  hideHint();
  waveHistory = [];
  lastVideoTime = -1;
  lastDanceTime = 0;
  waitingSince = 0;

  startButton.disabled = false;
  stopButton.disabled = true;
  emptyState.classList.remove("is-hidden");
  statusText.textContent = "Stopped.";
  setSignal(faceSignal, "Waiting");
  setSignal(handSignal, "Waiting");
  setSignal(gestureSignal, "Idle");
  setSignal(modeSignal, "Off");
}

async function loadModels() {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const wasmPath = `${chrome.runtime.getURL("vendor/mediapipe/tasks-vision/wasm")}/`;
    const vision = await FilesetResolver.forVisionTasks(wasmPath);

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: chrome.runtime.getURL("vendor/mediapipe/models/hand_landmarker.task")
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: chrome.runtime.getURL("vendor/mediapipe/models/face_landmarker.task")
      },
      runningMode: "VIDEO",
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
  })();

  return loadPromise;
}

async function unlockMedia() {
  try {
    gatoAudio.muted = true;
    await gatoAudio.play();
    gatoAudio.pause();
    gatoAudio.currentTime = 0;
    gatoAudio.muted = false;
  } catch {
    gatoAudio.muted = false;
  }
}

function processFrame(timestamp) {
  if (!stream) {
    return;
  }

  if (camera.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && camera.currentTime !== lastVideoTime) {
    lastVideoTime = camera.currentTime;
    syncCanvasToVideo();

    const handResults = handLandmarker.detectForVideo(camera, timestamp);
    const faceResults = faceLandmarker.detectForVideo(camera, timestamp);
    const state = readGestureState(handResults, faceResults, timestamp);

    drawResults(handResults, state.nosePoint);
    updateSignals(state, timestamp);

    if (state.danceIsRecent) {
      startGatoMode();
    } else {
      stopGatoMode();
    }
  }

  animationId = requestAnimationFrame(processFrame);
}

function readGestureState(handResults, faceResults, now) {
  const faceLandmarks = faceResults.faceLandmarks ?? [];
  const handLandmarks = handResults.landmarks ?? [];
  const noseLandmark = faceLandmarks[0]?.[1] ?? null;
  const nosePoint = noseLandmark ? toCanvasPoint(noseLandmark) : null;
  const handInfos = [];

  if (nosePoint) {
    for (const landmarks of handLandmarks) {
      const points = landmarks.map(toCanvasPoint);
      const palm = averagePoint(points[0], points[8], points[12]);
      const closestToNose = Math.min(...points.map((point) => distance(point, nosePoint)));

      handInfos.push({ palm, closestToNose });
    }
  }

  handInfos.sort((a, b) => a.closestToNose - b.closestToNose);

  const holdDistance = Math.min(overlay.width, overlay.height) * HOLD_NOSE_DISTANCE_RATIO;
  const waveDistance = Math.min(overlay.width, overlay.height) * WAVE_DISTANCE_RATIO;
  const hasNoseHand = handInfos.length >= 2 && handInfos[0].closestToNose < holdDistance;
  let sidewaysWave = false;

  if (hasNoseHand) {
    const wavePoint = handInfos[handInfos.length - 1].palm;
    waveHistory.push(wavePoint);

    if (waveHistory.length > WAVE_HISTORY_FRAMES) {
      waveHistory = waveHistory.slice(-WAVE_HISTORY_FRAMES);
    }

    if (waveHistory.length >= 4) {
      const xPositions = waveHistory.map((point) => point.x);
      const yPositions = waveHistory.map((point) => point.y);
      const xRange = Math.max(...xPositions) - Math.min(...xPositions);
      const yRange = Math.max(...yPositions) - Math.min(...yPositions);

      sidewaysWave = xRange > waveDistance && xRange > yRange * SIDEWAYS_RATIO;
      if (sidewaysWave) {
        lastDanceTime = now;
      }
    }
  } else {
    waveHistory = [];
  }

  return {
    nosePoint,
    faceCount: faceLandmarks.length,
    handCount: handLandmarks.length,
    hasNoseHand,
    sidewaysWave,
    danceIsRecent: lastDanceTime > 0 && now - lastDanceTime <= STOP_DELAY_MS
  };
}

function drawResults(handResults, nosePoint) {
  clearCanvas();

  for (const landmarks of handResults.landmarks ?? []) {
    const points = landmarks.map(toCanvasPoint);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    for (const [start, end] of HAND_CONNECTIONS) {
      drawLine(points[start], points[end]);
    }

    ctx.fillStyle = "#ff6b4a";
    for (const point of points) {
      drawCircle(point, 5);
    }
  }

  if (nosePoint) {
    ctx.fillStyle = "#f7c948";
    drawCircle(nosePoint, 8);
  }
}

function updateSignals(state, now) {
  setSignal(faceSignal, state.faceCount ? "Seen" : "Missing", state.faceCount ? "is-active" : "");
  setSignal(handSignal, String(state.handCount), state.handCount >= 2 ? "is-active" : "");

  if (state.sidewaysWave) {
    setSignal(gestureSignal, "Wave", "is-hot");
    statusText.textContent = "Gesture detected. Opening GATO MODE in a mini window.";
  } else if (state.hasNoseHand) {
    setSignal(gestureSignal, "Hold + wave", "is-active");
    statusText.textContent = "Keep waving the free hand side to side.";
  } else {
    setSignal(gestureSignal, "Idle");
    statusText.textContent = "Hold one hand near your nose, then wave the other.";
  }

  setSignal(modeSignal, state.danceIsRecent ? "GATO" : "Off", state.danceIsRecent ? "is-hot" : "");
  updateHint(state, now);
}

function updateHint(state, now) {
  if (state.danceIsRecent) {
    waitingSince = now;
    hideHint();
    return;
  }

  if (!waitingSince) {
    waitingSince = now;
  }

  if (now - waitingSince < HINT_DELAY_MS) {
    hideHint();
    return;
  }

  hintText.hidden = false;
  hintText.textContent = getHint(state);
}

function getHint(state) {
  if (!state.faceCount) {
    return "Hint: move your face into the camera view first.";
  }

  if (state.handCount < 2) {
    return "Hint: show both hands to the camera.";
  }

  if (!state.hasNoseHand) {
    return "Hint: keep one hand close to your nose.";
  }

  return "Hint: keep that hand near your nose and wave the other hand wider, side to side.";
}

function hideHint() {
  hintText.hidden = true;
  hintText.textContent = "";
}

function startGatoMode() {
  if (!gatoIsActive) {
    gatoIsActive = true;
    gatoAudio.currentTime = 0;
    gatoAudio.play().catch(() => {
      statusText.textContent = "GATO MODE is active. Click the page once if Chrome blocks sound.";
    });
  }

  if (gatoWindowId === null && !gatoWindowOpening) {
    openGatoWindow();
  }
}

function stopGatoMode() {
  if (!gatoIsActive && gatoWindowId === null && !gatoWindowOpening) {
    return;
  }

  gatoIsActive = false;
  stopAudio();
  closeGatoWindow();
}

function openGatoWindow() {
  gatoWindowOpening = true;

  chrome.windows.create({
    url: chrome.runtime.getURL("extension/gato.html"),
    type: "popup",
    width: GATO_WINDOW_WIDTH,
    height: GATO_WINDOW_HEIGHT,
    focused: false
  }, (createdWindow) => {
    gatoWindowOpening = false;

    if (chrome.runtime.lastError) {
      statusText.textContent = "Gesture detected, but Chrome could not open the GATO mini window.";
      return;
    }

    if (!gatoIsActive) {
      chrome.windows.remove(createdWindow.id, () => {
        void chrome.runtime.lastError;
      });
      return;
    }

    gatoWindowId = createdWindow.id;
  });
}

function closeGatoWindow() {
  if (gatoWindowId === null) {
    gatoWindowOpening = false;
    return;
  }

  const windowId = gatoWindowId;
  gatoWindowId = null;
  gatoWindowOpening = false;

  chrome.windows.remove(windowId, () => {
    void chrome.runtime.lastError;
  });
}

function stopAudio() {
  gatoAudio.pause();
  gatoAudio.currentTime = 0;
}

function syncCanvasToVideo() {
  const width = camera.videoWidth;
  const height = camera.videoHeight;

  if (!width || !height) {
    return;
  }

  if (overlay.width !== width || overlay.height !== height) {
    overlay.width = width;
    overlay.height = height;
    videoFrame.style.setProperty("--video-aspect", String(width / height));
  }
}

function toCanvasPoint(landmark) {
  return {
    x: (1 - landmark.x) * overlay.width,
    y: landmark.y * overlay.height
  };
}

function averagePoint(...points) {
  return {
    x: points.reduce((total, point) => total + point.x, 0) / points.length,
    y: points.reduce((total, point) => total + point.y, 0) / points.length
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function drawLine(a, b) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawCircle(point, radius) {
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function clearCanvas() {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
}

function stopStream() {
  if (stream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }

  stream = null;
  camera.srcObject = null;
}

function setSignal(element, text, className = "") {
  element.textContent = text;
  element.className = className;
}

function makeErrorMessage(error) {
  if (error?.name === "NotAllowedError") {
    return "Camera permission was blocked. Allow camera access for this extension and try again.";
  }

  if (error?.name === "NotFoundError") {
    return "No camera was found.";
  }

  return "Could not start ScubaScubaa. Check the extension console for details.";
}

start();

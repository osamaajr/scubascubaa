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

const camera = document.querySelector("#camera");
const overlay = document.querySelector("#overlay");
const ctx = overlay.getContext("2d");
const messageText = document.querySelector("#messageText");
const gatoMode = document.querySelector("#gatoMode");
const gatoVideo = document.querySelector("#gatoVideo");
const gatoAudio = document.querySelector("#gatoAudio");

let stream = null;
let animationId = null;
let handLandmarker = null;
let faceLandmarker = null;
let loadPromise = null;
let lastVideoTime = -1;
let lastDanceTime = 0;
let waitingSince = 0;
let gatoIsActive = false;
let waveHistory = [];

window.addEventListener("beforeunload", stop);

start();

async function start() {
  showMessage("Loading camera...");

  try {
    await loadModels();
    await unlockAudio();

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

    waitingSince = performance.now();
    showMessage("Hold one hand near your nose, then wave the other.", false, 2600);
    animationId = requestAnimationFrame(processFrame);
  } catch (error) {
    console.error(error);
    showMessage(makeErrorMessage(error));
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
  waveHistory = [];
  lastVideoTime = -1;
  lastDanceTime = 0;
  waitingSince = 0;
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

async function unlockAudio() {
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

    updateGuidance(state, timestamp);

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
    faceCount: faceLandmarks.length,
    handCount: handLandmarks.length,
    hasNoseHand,
    danceIsRecent: lastDanceTime > 0 && now - lastDanceTime <= STOP_DELAY_MS
  };
}

function updateGuidance(state, now) {
  if (state.danceIsRecent) {
    waitingSince = now;
    showMessage("GATO MODE", true);
    return;
  }

  if (!waitingSince) {
    waitingSince = now;
  }

  if (now - waitingSince >= HINT_DELAY_MS) {
    showMessage(getHint(state));
  }
}

function getHint(state) {
  if (!state.faceCount) {
    return "Hint: move your face into view.";
  }

  if (state.handCount < 2) {
    return "Hint: show both hands.";
  }

  if (!state.hasNoseHand) {
    return "Hint: keep one hand near your nose.";
  }

  return "Hint: wave the other hand wider, side to side.";
}

function startGatoMode() {
  if (gatoIsActive) {
    return;
  }

  gatoIsActive = true;
  gatoMode.classList.add("is-active");
  gatoMode.setAttribute("aria-hidden", "false");
  gatoVideo.currentTime = 0;
  gatoAudio.currentTime = 0;

  gatoVideo.play().catch(console.error);
  gatoAudio.play().catch(() => {
    showMessage("GATO MODE. Click once if Chrome blocks sound.", true);
  });
}

function stopGatoMode() {
  if (!gatoIsActive) {
    return;
  }

  gatoIsActive = false;
  gatoMode.classList.remove("is-active");
  gatoMode.setAttribute("aria-hidden", "true");
  gatoVideo.pause();
  gatoAudio.pause();
  gatoVideo.currentTime = 0;
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

function showMessage(message, hot = false, timeout = 0) {
  messageText.textContent = message;
  messageText.classList.toggle("is-hot", hot);
  messageText.classList.remove("is-hidden");

  if (timeout) {
    setTimeout(() => {
      if (messageText.textContent === message) {
        messageText.classList.add("is-hidden");
      }
    }, timeout);
  }
}

function makeErrorMessage(error) {
  if (error?.name === "NotAllowedError") {
    return "Camera blocked. Allow camera access for ScubaScubaa.";
  }

  if (error?.name === "NotFoundError") {
    return "No camera found.";
  }

  return "Could not start camera.";
}

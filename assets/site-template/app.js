const allowedControlTypes = new Set(["palm", "pinch", "span", "mouth"]);
const controlIcons = {
  palm: '<svg viewBox="0 0 24 24"><path d="M7 11.5V6.2a1.25 1.25 0 0 1 2.5 0v5.1"/><path d="M9.5 11V4.8a1.25 1.25 0 0 1 2.5 0V11"/><path d="M12 11V5.6a1.25 1.25 0 0 1 2.5 0V12"/><path d="M14.5 12V8.3a1.25 1.25 0 0 1 2.5 0v5.9c0 3.2-1.9 5.3-5 5.3h-.7c-2.6 0-4.3-1.2-5.3-3.4l-1.2-2.7a1.25 1.25 0 0 1 2.2-1.2l1.1 1.7"/></svg>',
  pinch: '<svg viewBox="0 0 24 24"><path d="m8.5 8.5-4-4"/><path d="M4.5 8V4.5H8"/><path d="m15.5 15.5 4 4"/><path d="M19.5 16v3.5H16"/><path d="m10 10 4 4"/></svg>',
  span: '<svg viewBox="0 0 24 24"><path d="M8 8.5 4.5 12 8 15.5"/><path d="M16 8.5 19.5 12 16 15.5"/><path d="M5 12h14"/></svg>',
  mouth: '<svg viewBox="0 0 24 24"><path d="M4.5 12c2.1-1.9 4.6-2.8 7.5-2.8s5.4.9 7.5 2.8c-2.1 2.1-4.6 3.2-7.5 3.2S6.6 14.1 4.5 12Z"/><path d="M6.5 12h11"/></svg>',
};

async function loadProjectConfig() {
  const response = await fetch("./project.config.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Configuration request failed: ${response.status}`);
  const config = await response.json();
  if (!config?.site?.title || !config?.site?.subtitle) throw new Error("Missing site title or subtitle");
  if (!Array.isArray(config.artworks) || config.artworks.length === 0) throw new Error("At least one artwork is required");
  if (!Array.isArray(config.controls) || config.controls.length === 0) throw new Error("At least one control is required");
  if (config.controls.some((control) => !allowedControlTypes.has(control.type))) throw new Error("Unsupported control type");
  return config;
}

function renderProjectShell(config) {
  document.title = config.site.title;
  const title = document.querySelector("#siteTitle");
  const words = config.site.title.trim().split(/\s+/);
  const accent = words.pop();
  title.replaceChildren();
  if (words.length) {
    const primary = document.createElement("span");
    primary.className = "title-primary";
    primary.textContent = words.join(" ") + " ";
    title.append(primary);
  }
  const accentSpan = document.createElement("span");
  accentSpan.className = "title-accent";
  accentSpan.textContent = accent;
  title.append(accentSpan);
  document.querySelector("#siteSubtitle").textContent = config.site.subtitle;

  const tabs = document.querySelector("#controlTabs");
  tabs.style.setProperty("--tab-count", String(config.controls.length));
  config.controls.forEach((control, index) => {
    const button = document.createElement("button");
    button.className = `control-tab${index === 0 ? " is-active" : ""}`;
    button.type = "button";
    button.dataset.mode = control.type;
    button.innerHTML = `<span class="tab-icon" aria-hidden="true">${controlIcons[control.type]}</span>${control.type[0].toUpperCase()}${control.type.slice(1)}`;
    tabs.append(button);
  });
  document.querySelector("#modeInstruction").textContent = config.controls[0].instruction;

  const stack = document.querySelector("#artworkStack");
  config.artworks.forEach((artwork, index) => {
    const card = document.createElement("button");
    card.className = `artwork-card${index === 0 ? " is-active" : ""}`;
    card.type = "button";
    card.dataset.artworkIndex = String(index);
    card.setAttribute("aria-label", `${artwork.label}${index === 0 ? ", selected" : ", select animation"}`);
    const canvas = document.createElement("canvas");
    canvas.className = "frame-reel";
    canvas.dataset.artworkCanvas = String(index);
    card.append(canvas);
    stack.append(card);
  });
  const rail = document.querySelector("#artworkRail");
  rail.setAttribute("aria-valuemax", String(config.artworks.length));
  document.querySelector(".artwork-switcher").hidden = config.artworks.length < 2;
}

const projectConfig = await loadProjectConfig();
renderProjectShell(projectConfig);

const frameCanvases = Array.from(document.querySelectorAll("[data-artwork-canvas]"));
const ambientCanvas = document.querySelector("#ambientBackground");
const ambientCtx = ambientCanvas.getContext("2d", { alpha: false });
const ambientTrailCanvas = document.createElement("canvas");
const ambientTrailCtx = ambientTrailCanvas.getContext("2d");
const ambientFieldCanvas = document.createElement("canvas");
const ambientFieldCtx = ambientFieldCanvas.getContext("2d", { alpha: false });
const webcam = document.querySelector("#webcam");
const overlay = document.querySelector("#overlay");
const cameraPanel = document.querySelector("#cameraPanel");
const retryButton = document.querySelector("#retryButton");
const statusText = document.querySelector("#statusText");
const gestureFill = document.querySelector("#gestureFill");
const modeInstruction = document.querySelector("#modeInstruction");
const controlTabs = Array.from(document.querySelectorAll(".control-tab"));
const gestureCursor = document.querySelector("#gestureCursor");
const interfacePanel = document.querySelector(".interface-panel");
const siteTitle = document.querySelector(".site-title");
const visualPanel = document.querySelector(".visual-panel");
const artworkStack = document.querySelector("#artworkStack");
const artworkCards = Array.from(document.querySelectorAll(".artwork-card"));
const previousArtworkButton = document.querySelector("#previousArtwork");
const nextArtworkButton = document.querySelector("#nextArtwork");
const artworkRail = document.querySelector("#artworkRail");
const artworkThumb = document.querySelector("#artworkThumb");
const artworkCounter = document.querySelector("#artworkCounter");
const gestureActionTargets = [...controlTabs, previousArtworkButton, nextArtworkButton];
const overlayCtx = overlay.getContext("2d");
const cameraHomeParent = cameraPanel.parentNode;
const cameraHomeNextSibling = cameraPanel.nextSibling;

const artworks = projectConfig.artworks.map((artwork, index) => ({
  id: artwork.id,
  name: artwork.label,
  directory: artwork.framePath.replace(/^\.\//, "").replace(/\/$/, ""),
  frameCount: artwork.frameCount,
  progress: 0,
  canvas: frameCanvases[index],
  context: frameCanvases[index].getContext("2d"),
  frames: new Map(),
  frameLoads: new Map(),
  currentFrameIndex: 0,
  displayedFrameIndex: -1,
  preloadDirection: 0,
  networkWarmStarted: false,
}));
const frameAssetVersion = "1";
const handModelUrl =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const faceModelUrl =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const wasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const handConnections = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];
const mouthContours = [
  [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 0, 37, 39, 40, 185, 61],
  [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 13, 82, 81, 80, 191, 78],
];

let handLandmarker;
let faceLandmarker;
let visionTasks;
let cameraStream;
let lastVideoTime = -1;
let smoothFoldProgress = 0;
let targetFoldProgress = 0;
let previousFoldSignal = null;
let filteredFoldSignal = null;
let previousPinchSignal = null;
let filteredPinchSignal = null;
let previousSpanSignal = null;
let filteredSpanSignal = null;
let previousMouthSignal = null;
let filteredMouthSignal = null;
let handWasVisible = false;
let lastHandSeenAt = 0;
let progressAnimationId = 0;
let isStarting = false;
let trackingStarted = false;
let autoStartTimer;
let autoStartAttempts = 0;
let controlMode = projectConfig.controls[0].type;
let activeArtworkIndex = 0;
let cameraDragPointerId = null;
let cameraDragOffsetX = 0;
let cameraDragOffsetY = 0;
let artworkDragPointerId = null;
let artworkDragStartY = 0;
let artworkDragCurrentY = 0;
let railDragPointerId = null;
let wheelDelta = 0;
let wheelResetTimer = 0;
let artworkSwitchLockedUntil = 0;
let suppressArtworkClickUntil = 0;
let columnSyncFrame = 0;
let swipeSamples = [];
let swipeCooldownUntil = 0;
let mouthTrackingFrame = 0;
let mouthHandScanUntil = 0;
let lastFaceLandmarks = null;
let gestureCursorPinched = false;
let gesturePinchInitialized = false;
let gestureDwellTarget = null;
let gestureDwellStartedAt = 0;
let gestureDwellTriggered = false;
let ambientWidth = 0;
let ambientHeight = 0;
let ambientTrailWidth = 0;
let ambientTrailHeight = 0;
let ambientGrainPattern = null;
let ambientLastFrameAt = 0;
let ambientPointerSeen = false;
let ambientPointerX = window.innerWidth * 0.24;
let ambientPointerY = window.innerHeight * 0.22;
let ambientTargetX = ambientPointerX;
let ambientTargetY = ambientPointerY;
let ambientPreviousX = ambientPointerX;
let ambientPreviousY = ambientPointerY;
let ambientVelocityX = 0;
let ambientVelocityY = 0;
let ambientPower = 0;

const mobileCameraQuery = window.matchMedia("(max-width: 860px)");

const gestureSensitivity = 0.62;
const pinchSensitivity = 0.68;
const spanSensitivity = 0.7;
const mouthSensitivity = 0.56;
const signalDeadzone = 0.006;
const handDropoutGraceMs = 520;
const swipeWindowMs = 300;
const swipeDistanceThreshold = 0.24;
const swipeAxisRatio = 0.46;
const swipeMinimumVelocity = 0.9;
const swipeCooldownMs = 1000;
const swipeEdgeBoundary = 0.3;
const mouthSwipeProbeEvery = 10;
const mouthSwipeScanDurationMs = 520;
const modePinchCloseThreshold = 0.34;
const modePinchReleaseThreshold = 0.5;
const modePointerApproachPadding = 72;
const gestureDwellDurationMs = 2000;
const gestureDwellRetentionPadding = 14;
const gestureArrowHitPadding = 8;
const ambientRenderScale = 0.4;
const ambientTrailScale = 0.15;
const ambientFrameIntervalMs = 1000 / 24;
const controlSettings = new Map(projectConfig.controls.map((control) => [control.type, control]));
const modeInstructions = Object.fromEntries(
  projectConfig.controls.map((control) => [control.type, control.instruction])
);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (from, to, amount) => from + (to - from) * amount;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
const mapRange = (value, inMin, inMax, outMin = 0, outMax = 1) => {
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + t * (outMax - outMin);
};

function resizeAmbientBackground() {
  ambientWidth = Math.max(1, Math.round(window.innerWidth * ambientRenderScale));
  ambientHeight = Math.max(1, Math.round(window.innerHeight * ambientRenderScale));
  ambientTrailWidth = Math.max(1, Math.round(window.innerWidth * ambientTrailScale));
  ambientTrailHeight = Math.max(1, Math.round(window.innerHeight * ambientTrailScale));

  ambientCanvas.width = ambientWidth;
  ambientCanvas.height = ambientHeight;
  ambientFieldCanvas.width = ambientWidth;
  ambientFieldCanvas.height = ambientHeight;
  ambientTrailCanvas.width = ambientTrailWidth;
  ambientTrailCanvas.height = ambientTrailHeight;

  ambientTrailCtx.fillStyle = "#000";
  ambientTrailCtx.fillRect(0, 0, ambientTrailWidth, ambientTrailHeight);
  buildAmbientField();
  ambientGrainPattern = createAmbientGrainPattern();
}

function buildAmbientField() {
  ambientFieldCtx.fillStyle = "#030303";
  ambientFieldCtx.fillRect(0, 0, ambientWidth, ambientHeight);

  const fogs = [
    [0.13, 0.12, 0.17, 0.11, -0.26, 0.11],
    [0.02, 0.5, 0.13, 0.19, 0.18, 0.085],
    [0.39, 0.78, 0.19, 0.14, -0.12, 0.045],
    [0.76, 0.12, 0.16, 0.12, 0.22, 0.038],
  ];
  fogs.forEach(([x, y, width, height, rotation, alpha]) => {
    drawAmbientGlow(
      ambientFieldCtx,
      ambientWidth * x,
      ambientHeight * y,
      ambientWidth * width,
      ambientHeight * height,
      rotation,
      alpha
    );
  });

  const coarseNoise = createAmbientNoiseCanvas(18, 18, 71);
  ambientFieldCtx.save();
  ambientFieldCtx.globalCompositeOperation = "screen";
  ambientFieldCtx.globalAlpha = 0.12;
  ambientFieldCtx.filter = `blur(${Math.max(10, ambientWidth * 0.025)}px)`;
  ambientFieldCtx.drawImage(
    coarseNoise,
    -ambientWidth * 0.04,
    -ambientHeight * 0.04,
    ambientWidth * 1.08,
    ambientHeight * 1.08
  );
  ambientFieldCtx.restore();
}

function drawAmbientGlow(ctx, x, y, radiusX, radiusY, rotation, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(radiusX / 100, radiusY / 100);
  const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, 100);
  gradient.addColorStop(0, `rgba(225, 225, 225, ${alpha})`);
  gradient.addColorStop(0.24, `rgba(205, 205, 205, ${alpha * 0.62})`);
  gradient.addColorStop(0.62, `rgba(178, 178, 178, ${alpha * 0.18})`);
  gradient.addColorStop(1, "rgba(150, 150, 150, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 100, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function createAmbientNoiseCanvas(width, height, seed) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const random = createSeededRandom(seed);
  canvas.width = width;
  canvas.height = height;
  const image = ctx.createImageData(width, height);

  for (let index = 0; index < image.data.length; index += 4) {
    const value = Math.round(18 + random() * 92);
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    image.data[index + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function createAmbientGrainPattern() {
  const noiseCanvas = createAmbientNoiseCanvas(96, 96, 149);
  return ambientCtx.createPattern(noiseCanvas, "repeat");
}

function createSeededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function setAmbientPointer(x, y) {
  ambientTargetX = clamp(x, 0, window.innerWidth);
  ambientTargetY = clamp(y, 0, window.innerHeight);

  if (!ambientPointerSeen) {
    ambientPointerSeen = true;
    ambientPointerX = ambientTargetX;
    ambientPointerY = ambientTargetY;
    ambientPreviousX = ambientPointerX;
    ambientPreviousY = ambientPointerY;
  }
}

function renderAmbientBackground(timestamp) {
  requestAnimationFrame(renderAmbientBackground);
  if (document.hidden || timestamp - ambientLastFrameAt < ambientFrameIntervalMs) return;

  const elapsed = Math.min(50, Math.max(16, timestamp - ambientLastFrameAt || 16));
  ambientLastFrameAt = timestamp;
  const follow = 1 - Math.pow(0.84, elapsed / 16.67);
  ambientPointerX = lerp(ambientPointerX, ambientTargetX, follow);
  ambientPointerY = lerp(ambientPointerY, ambientTargetY, follow);

  const deltaX = ambientPointerX - ambientPreviousX;
  const deltaY = ambientPointerY - ambientPreviousY;
  ambientVelocityX = ambientVelocityX * 0.68 + deltaX * 0.32;
  ambientVelocityY = ambientVelocityY * 0.68 + deltaY * 0.32;
  ambientPreviousX = ambientPointerX;
  ambientPreviousY = ambientPointerY;

  const speed = Math.hypot(ambientVelocityX, ambientVelocityY);
  const minViewportSize = Math.max(1, Math.min(window.innerWidth, window.innerHeight));
  ambientPower = clamp(ambientPower + (speed / minViewportSize) * 3.4, 0, 1);
  ambientPower += (0 - ambientPower) * 0.05;
  if (ambientPower < 0.0005) ambientPower = 0;

  const fadeAlpha = lerp(0.38, 0.065, clamp(ambientPower * 3.5, 0, 1));
  ambientTrailCtx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
  ambientTrailCtx.fillRect(0, 0, ambientTrailWidth, ambientTrailHeight);

  if (ambientPointerSeen && ambientPower > 0) {
    drawAmbientTrailLight();
  }

  ambientCtx.globalCompositeOperation = "source-over";
  ambientCtx.globalAlpha = 1;
  ambientCtx.drawImage(ambientFieldCanvas, 0, 0);
  ambientCtx.globalCompositeOperation = "screen";
  ambientCtx.globalAlpha = 0.72;
  ambientCtx.drawImage(ambientTrailCanvas, 0, 0, ambientWidth, ambientHeight);

  if (ambientGrainPattern) {
    ambientCtx.globalCompositeOperation = "overlay";
    ambientCtx.globalAlpha = 0.16;
    ambientCtx.fillStyle = ambientGrainPattern;
    const grainOffset = Math.round(timestamp / 140) % 96;
    ambientCtx.save();
    ambientCtx.translate(-grainOffset, grainOffset * 0.5);
    ambientCtx.fillRect(
      grainOffset,
      -grainOffset * 0.5,
      ambientWidth + 96,
      ambientHeight + 96
    );
    ambientCtx.restore();
  }

  ambientCtx.globalCompositeOperation = "source-over";
  ambientCtx.globalAlpha = 1;
}

function drawAmbientTrailLight() {
  const x = ambientPointerX * ambientTrailScale;
  const y = ambientPointerY * ambientTrailScale;
  const radius = Math.min(window.innerWidth, window.innerHeight) * ambientTrailScale * 0.38;
  const direction = Math.atan2(ambientVelocityY, ambientVelocityX || 0.001);
  const stretch = 1 + clamp(Math.hypot(ambientVelocityX, ambientVelocityY) / 28, 0, 0.65);

  ambientTrailCtx.save();
  ambientTrailCtx.translate(x, y);
  ambientTrailCtx.rotate(direction);
  ambientTrailCtx.scale(stretch, 1 / Math.sqrt(stretch));
  const gradient = ambientTrailCtx.createRadialGradient(0, 0, radius * 0.01, 0, 0, radius);
  const alpha = 0.045 + ambientPower * 0.11;
  gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
  gradient.addColorStop(0.2, `rgba(255, 255, 255, ${alpha * 0.5})`);
  gradient.addColorStop(0.58, `rgba(218, 218, 218, ${alpha * 0.12})`);
  gradient.addColorStop(1, "rgba(190, 190, 190, 0)");
  ambientTrailCtx.fillStyle = gradient;
  ambientTrailCtx.beginPath();
  ambientTrailCtx.arc(0, 0, radius, 0, Math.PI * 2);
  ambientTrailCtx.fill();
  ambientTrailCtx.restore();
}

retryButton.addEventListener("click", requestStartTracking);
controlTabs.forEach((tab) => {
  tab.addEventListener("click", () => setControlMode(tab.dataset.mode, "tab"));
});
artworkCards.forEach((card) => {
  card.addEventListener("click", () => {
    if (Date.now() < suppressArtworkClickUntil) return;
    selectArtwork(Number(card.dataset.artworkIndex), "click");
  });
});
previousArtworkButton.addEventListener("click", () => changeArtworkBy(-1, "button"));
nextArtworkButton.addEventListener("click", () => changeArtworkBy(1, "button"));
visualPanel.addEventListener("wheel", handleArtworkWheel, { passive: false });
visualPanel.addEventListener("keydown", handleArtworkKeydown);
artworkStack.addEventListener("pointerdown", startArtworkDrag);
artworkStack.addEventListener("pointermove", moveArtworkDrag);
artworkStack.addEventListener("pointerup", endArtworkDrag);
artworkStack.addEventListener("pointercancel", cancelArtworkDrag);
artworkRail.addEventListener("pointerdown", startRailDrag);
artworkRail.addEventListener("pointermove", moveRailDrag);
artworkRail.addEventListener("pointerup", endRailDrag);
artworkRail.addEventListener("pointercancel", endRailDrag);
statusText.addEventListener("pointerdown", (event) => {
  if (!trackingStarted) event.stopPropagation();
});
statusText.addEventListener("click", requestStartTracking);
window.addEventListener("resize", () => {
  resizeOverlay();
  resizeAmbientBackground();
  keepMobileCameraInBounds();
  scheduleDesktopColumnSync();
});
window.addEventListener(
  "pointermove",
  (event) => {
    if (!event.isPrimary) return;
    setAmbientPointer(event.clientX, event.clientY);
  },
  { passive: true }
);
window.addEventListener(
  "pointerdown",
  (event) => {
    if (!event.isPrimary) return;
    setAmbientPointer(event.clientX, event.clientY);
  },
  { passive: true }
);
window.addEventListener("focus", () => scheduleAutoStart(150));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) scheduleAutoStart(150);
});
cameraPanel.addEventListener("pointerdown", startCameraDrag);
window.addEventListener("pointermove", moveCameraDrag, { passive: false });
window.addEventListener("pointerup", endCameraDrag);
window.addEventListener("pointercancel", endCameraDrag);
resizeAmbientBackground();
requestAnimationFrame(renderAmbientBackground);
window.addEventListener("blur", cancelCameraDrag);
mobileCameraQuery.addEventListener("change", handleCameraLayoutChange);
handleCameraLayoutChange();
updateArtworkStack();
scheduleDesktopColumnSync();
document.fonts?.ready.then(scheduleDesktopColumnSync);

function scheduleDesktopColumnSync() {
  cancelAnimationFrame(columnSyncFrame);
  columnSyncFrame = requestAnimationFrame(() => syncDesktopColumnHeights(0));
}

function syncDesktopColumnHeights(iteration) {
  columnSyncFrame = 0;

  if (mobileCameraQuery.matches) {
    document.documentElement.style.removeProperty("--control-width");
    siteTitle.style.removeProperty("font-size");
    drawCurrentFrame();
    updateArtworkStack();
    return;
  }

  fitSiteTitleToColumn();
  const interfaceRect = interfacePanel.getBoundingClientRect();
  const cameraRect = cameraPanel.getBoundingClientRect();
  const visualRect = visualPanel.getBoundingClientRect();
  const heightDifference = interfaceRect.height - visualRect.height;

  if (Math.abs(heightDifference) <= 1 || iteration >= 6) {
    drawCurrentFrame();
    updateArtworkStack();
    return;
  }

  const nonCameraHeight = Math.max(0, interfaceRect.height - cameraRect.height);
  const targetCameraHeight = Math.max(0, visualRect.height - nonCameraHeight);
  const minimumWidth = window.innerWidth < 1180 ? 250 : 280;
  const targetWidth = clamp(targetCameraHeight * 0.75, minimumWidth, 420);
  const currentWidth = interfaceRect.width;

  if (Math.abs(currentWidth - targetWidth) <= 0.5) {
    drawCurrentFrame();
    updateArtworkStack();
    return;
  }

  document.documentElement.style.setProperty("--control-width", `${targetWidth}px`);
  columnSyncFrame = requestAnimationFrame(() => syncDesktopColumnHeights(iteration + 1));
}

function fitSiteTitleToColumn() {
  siteTitle.style.removeProperty("font-size");
  const preferredSize = Number.parseFloat(getComputedStyle(siteTitle).fontSize);
  const range = document.createRange();
  range.selectNodeContents(siteTitle);
  const contentWidth = range.getBoundingClientRect().width;
  const availableWidth = Math.max(1, interfacePanel.clientWidth - 12);

  if (contentWidth <= availableWidth) return;

  const fittedSize = Math.max(28, preferredSize * (availableWidth / contentWidth) * 0.97);
  siteTitle.style.fontSize = `${fittedSize}px`;
}

function getActiveArtwork() {
  return artworks[activeArtworkIndex];
}

function activeArtworkHasFrames() {
  return Boolean(getActiveArtwork().canvas);
}

function changeArtworkBy(direction, source) {
  if (artworks.length < 2) return;
  const candidate = activeArtworkIndex + direction;
  const nextIndex = projectConfig.navigation.loop
    ? (candidate + artworks.length) % artworks.length
    : clamp(candidate, 0, artworks.length - 1);
  selectArtwork(nextIndex, source);
}

function selectArtwork(index, source = "direct") {
  const nextIndex = clamp(Math.round(index), 0, artworks.length - 1);
  if (nextIndex === activeArtworkIndex) return;

  const respectsTransitionLock = [
    "wheel",
    "drag",
    "button",
    "keyboard",
    "swipe",
    "gesture",
  ].includes(source);
  if (respectsTransitionLock && performance.now() < artworkSwitchLockedUntil) return;

  artworks[activeArtworkIndex].progress = smoothFoldProgress;
  activeArtworkIndex = nextIndex;
  artworkSwitchLockedUntil = performance.now() + 440;
  stopProgressAnimation();
  resetInputMemory();
  handWasVisible = false;
  lastHandSeenAt = 0;
  updateArtworkStack();

  const artwork = getActiveArtwork();
  warmArtworkNetworkCache(artwork);
  targetFoldProgress = artwork.progress;
  smoothFoldProgress = artwork.progress;
  renderProgress(smoothFoldProgress, getHoldLabel(smoothFoldProgress));
}

function updateArtworkStack() {
  const visualHeight = visualPanel.getBoundingClientRect().height;
  const layerStep = clamp(visualHeight * 0.09, 34, 64);

  artworkCards.forEach((card, index) => {
    let relativeIndex = index - activeArtworkIndex;
    if (relativeIndex > artworks.length / 2) relativeIndex -= artworks.length;
    if (relativeIndex < -artworks.length / 2) relativeIndex += artworks.length;
    const depth = Math.abs(relativeIndex);
    const direction = Math.sign(relativeIndex);
    const y = relativeIndex * layerStep;
    const z = depth * -86;
    const rotate = depth === 0 ? 0 : direction * depth * -2.2;
    const scale = Math.max(0.88, 1 - depth * 0.035);
    const opacity = depth === 0 ? 1 : Math.max(0.84, 1 - depth * 0.04);
    const isActive = index === activeArtworkIndex;

    card.style.setProperty("--card-y", `${y}px`);
    card.style.setProperty("--card-z", `${z}px`);
    card.style.setProperty("--card-rotate", `${rotate}deg`);
    card.style.setProperty("--card-scale", scale);
    card.style.zIndex = String(artworks.length - depth);
    card.style.opacity = String(opacity);
    card.style.filter = `brightness(${Math.max(0.9, 1.02 - depth * 0.02)})`;
    card.classList.toggle("is-active", isActive);
    card.setAttribute("aria-pressed", String(isActive));
    card.setAttribute(
      "aria-label",
      `${artworks[index].name}${isActive ? ", selected" : ", select animation"}`
    );
  });

  previousArtworkButton.disabled = !projectConfig.navigation.loop && activeArtworkIndex === 0;
  nextArtworkButton.disabled =
    !projectConfig.navigation.loop && activeArtworkIndex === artworks.length - 1;
  artworkCounter.textContent = `${String(activeArtworkIndex + 1).padStart(2, "0")} / ${String(
    artworks.length
  ).padStart(2, "0")}`;

  const thumbMin = 7;
  const thumbMax = 37;
  const progress = artworks.length > 1 ? activeArtworkIndex / (artworks.length - 1) : 0;
  artworkThumb.style.top = `${lerp(thumbMin, thumbMax, progress)}px`;
  artworkRail.setAttribute("aria-valuenow", String(activeArtworkIndex + 1));
  artworkRail.setAttribute("aria-valuetext", getActiveArtwork().name);
}

function handleArtworkWheel(event) {
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  event.preventDefault();

  clearTimeout(wheelResetTimer);
  wheelResetTimer = window.setTimeout(() => {
    wheelDelta = 0;
  }, 180);

  if (performance.now() < artworkSwitchLockedUntil) return;
  wheelDelta += event.deltaY;
  if (Math.abs(wheelDelta) < 72) return;

  changeArtworkBy(wheelDelta > 0 ? 1 : -1, "wheel");
  wheelDelta = 0;
}

function handleArtworkKeydown(event) {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  event.preventDefault();
  changeArtworkBy(event.key === "ArrowDown" ? 1 : -1, "keyboard");
}

function startArtworkDrag(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;

  artworkDragPointerId = event.pointerId;
  artworkDragStartY = event.clientY;
  artworkDragCurrentY = event.clientY;
  artworkStack.dataset.dragging = "true";
  artworkStack.setPointerCapture(event.pointerId);
}

function moveArtworkDrag(event) {
  if (event.pointerId !== artworkDragPointerId) return;

  artworkDragCurrentY = event.clientY;
  const offset = clamp(artworkDragCurrentY - artworkDragStartY, -84, 84);
  artworkStack.style.setProperty("--drag-y", `${offset}px`);
  if (Math.abs(offset) > 4) event.preventDefault();
}

function endArtworkDrag(event) {
  if (event.pointerId !== artworkDragPointerId) return;

  const distanceY = artworkDragCurrentY - artworkDragStartY;
  if (artworkStack.hasPointerCapture(event.pointerId)) {
    artworkStack.releasePointerCapture(event.pointerId);
  }
  cancelArtworkDrag();

  if (Math.abs(distanceY) < 52) return;
  suppressArtworkClickUntil = Date.now() + 500;
  changeArtworkBy(distanceY < 0 ? 1 : -1, "drag");
}

function cancelArtworkDrag() {
  artworkDragPointerId = null;
  artworkStack.style.setProperty("--drag-y", "0px");
  delete artworkStack.dataset.dragging;
}

function startRailDrag(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;

  railDragPointerId = event.pointerId;
  artworkRail.setPointerCapture(event.pointerId);
  selectArtworkFromRail(event.clientY);
  event.preventDefault();
}

function moveRailDrag(event) {
  if (event.pointerId !== railDragPointerId) return;
  selectArtworkFromRail(event.clientY);
  event.preventDefault();
}

function endRailDrag(event) {
  if (event.pointerId !== railDragPointerId) return;
  if (artworkRail.hasPointerCapture(event.pointerId)) {
    artworkRail.releasePointerCapture(event.pointerId);
  }
  railDragPointerId = null;
}

function selectArtworkFromRail(clientY) {
  const rect = artworkRail.getBoundingClientRect();
  const progress = clamp((clientY - rect.top - 7) / Math.max(1, rect.height - 14), 0, 1);
  selectArtwork(Math.round(progress * (artworks.length - 1)), "rail");
}

function startCameraDrag(event) {
  if (!mobileCameraQuery.matches || event.target.closest("button")) return;

  const rect = cameraPanel.getBoundingClientRect();
  cameraDragPointerId = event.pointerId;
  cameraDragOffsetX = event.clientX - rect.left;
  cameraDragOffsetY = event.clientY - rect.top;
  cameraPanel.dataset.dragging = "true";
  event.preventDefault();
}

function moveCameraDrag(event) {
  if (event.pointerId !== cameraDragPointerId || !mobileCameraQuery.matches) return;

  positionMobileCamera(event.clientX - cameraDragOffsetX, event.clientY - cameraDragOffsetY);
  event.preventDefault();
}

function endCameraDrag(event) {
  if (event.pointerId !== cameraDragPointerId) return;
  cancelCameraDrag();
}

function cancelCameraDrag() {
  cameraDragPointerId = null;
  delete cameraPanel.dataset.dragging;
}

function positionMobileCamera(left, top) {
  const margin = 8;
  const rect = cameraPanel.getBoundingClientRect();
  const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);

  cameraPanel.style.left = `${clamp(left, margin, maxLeft)}px`;
  cameraPanel.style.top = `${clamp(top, margin, maxTop)}px`;
  cameraPanel.style.right = "auto";
  cameraPanel.style.bottom = "auto";
}

function keepMobileCameraInBounds() {
  if (!mobileCameraQuery.matches || !cameraPanel.style.left) return;

  const rect = cameraPanel.getBoundingClientRect();
  positionMobileCamera(rect.left, rect.top);
}

function handleCameraLayoutChange() {
  cameraDragPointerId = null;
  delete cameraPanel.dataset.dragging;

  if (mobileCameraQuery.matches) {
    if (cameraPanel.parentNode !== document.body) {
      document.body.append(cameraPanel);
    }
    keepMobileCameraInBounds();
    return;
  }

  if (cameraPanel.parentNode !== cameraHomeParent) {
    cameraHomeParent.insertBefore(cameraPanel, cameraHomeNextSibling);
  }

  cameraPanel.style.removeProperty("left");
  cameraPanel.style.removeProperty("top");
  cameraPanel.style.removeProperty("right");
  cameraPanel.style.removeProperty("bottom");
}

function setControlMode(mode, source = "direct") {
  if (!["palm", "pinch", "span", "mouth"].includes(mode)) return;

  if (source === "tab" || source === "gesture") {
    swipeCooldownUntil = performance.now() + 500;
    resetSwipeMemory();
  }
  mouthTrackingFrame = 0;
  mouthHandScanUntil = 0;
  lastFaceLandmarks = null;
  controlMode = mode;
  controlTabs.forEach((tab, index) => {
    tab.classList.toggle("is-active", tab.dataset.mode === mode);
    if (tab.dataset.mode === mode) {
      tab.parentElement.style.setProperty("--active-tab-offset", `${index * 100}%`);
    }
  });
  modeInstruction.textContent = modeInstructions[mode];
  resetInputMemory();
  handWasVisible = false;
  lastHandSeenAt = 0;
  statusText.textContent = mode;
}

loadArtworkPosters().catch((error) => {
  console.error(error);
  statusText.textContent = "Frames failed";
  retryButton.hidden = false;
});
scheduleAutoStart(300);

async function loadArtworkPosters() {
  statusText.textContent = "Loading frames";
  await Promise.all(artworks.map((_, artworkIndex) => drawFrame(0, artworkIndex)));
  warmArtworkNetworkCache(getActiveArtwork());
  if (!isStarting && !trackingStarted) {
    statusText.textContent = "Allow camera";
  }
}

function loadImage(src, fetchPriority = "auto") {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = fetchPriority;
    image.onload = () => {
      if (!image.decode) {
        resolve(image);
        return;
      }
      image.decode().then(
        () => resolve(image),
        () => resolve(image)
      );
    };
    image.onerror = reject;
    image.src = src;
  });
}

function getFrameUrl(artwork, index) {
  return `./${artwork.directory}/${index + 1}.webp?v=${frameAssetVersion}`;
}

function warmArtworkNetworkCache(artwork) {
  if (artwork.networkWarmStarted || !window.fetch) return;
  artwork.networkWarmStarted = true;

  const pendingIndices = Array.from(
    { length: artwork.frameCount - 1 },
    (_, index) => index + 1
  );
  let cursor = 0;

  const worker = async () => {
    while (cursor < pendingIndices.length) {
      const index = pendingIndices[cursor];
      cursor += 1;
      try {
        const response = await fetch(getFrameUrl(artwork, index), { cache: "force-cache" });
        if (response.ok) await response.blob();
      } catch {
        // Individual frames still load normally if background warming fails.
      }
    }
  };

  Promise.all([worker(), worker(), worker()]).catch(() => {});
}

function loadArtworkFrame(artwork, index, fetchPriority = "auto") {
  if (artwork.frames.has(index)) {
    return Promise.resolve(artwork.frames.get(index));
  }
  if (artwork.frameLoads.has(index)) {
    return artwork.frameLoads.get(index);
  }

  const frameLoad = loadImage(getFrameUrl(artwork, index), fetchPriority)
    .then((frame) => {
      artwork.frameLoads.delete(index);
      artwork.frames.set(index, frame);
      trimArtworkFrameCache(artwork, artwork.currentFrameIndex);
      return frame;
    })
    .catch((error) => {
      artwork.frameLoads.delete(index);
      throw error;
    });
  artwork.frameLoads.set(index, frameLoad);
  return frameLoad;
}

async function drawFrame(index, artworkIndex = activeArtworkIndex) {
  const artwork = artworks[artworkIndex];
  const nextIndex = clamp(Math.round(index), 0, artwork.frameCount - 1);
  const direction = Math.sign(nextIndex - artwork.currentFrameIndex);
  artwork.currentFrameIndex = nextIndex;
  if (direction !== 0) artwork.preloadDirection = direction;

  const cachedFrame = artwork.frames.get(nextIndex);
  if (cachedFrame) {
    drawFrameToCanvas(artwork, cachedFrame, nextIndex);
    trimArtworkFrameCache(artwork, nextIndex);
    if (artworkIndex === activeArtworkIndex) {
      preloadArtworkWindow(artwork, nextIndex, artwork.preloadDirection);
    }
    return;
  }

  const framePromise = loadArtworkFrame(artwork, nextIndex, "high");
  if (artworkIndex === activeArtworkIndex) {
    preloadArtworkWindow(artwork, nextIndex, artwork.preloadDirection);
  }

  try {
    const frame = await framePromise;
    if (artwork.currentFrameIndex !== nextIndex) return;
    if (artwork.displayedFrameIndex !== nextIndex) {
      drawFrameToCanvas(artwork, frame, nextIndex);
    }
    trimArtworkFrameCache(artwork, nextIndex);
  } catch (error) {
    console.error(error);
    if (artworkIndex === activeArtworkIndex) statusText.textContent = "Frame failed";
  }
}

function drawFrameToCanvas(artwork, frame, frameIndex) {
  const { canvas, context } = artwork;
  const rect = visualPanel.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const renderScale = Math.min(
    pixelRatio,
    frame.naturalWidth / Math.max(1, rect.width),
    frame.naturalHeight / Math.max(1, rect.height)
  );
  const width = Math.max(1, Math.round(rect.width * renderScale));
  const height = Math.max(1, Math.round(rect.height * renderScale));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.drawImage(frame, 0, 0, width, height);
  artwork.displayedFrameIndex = frameIndex;
}

function preloadArtworkWindow(artwork, centerIndex, direction = 0) {
  const forwardCount = direction === 0 ? 6 : 10;
  const backwardCount = direction === 0 ? 6 : 4;
  const forwardDirection = direction || 1;
  const offsets = [];

  for (let offset = 1; offset <= forwardCount; offset += 1) {
    offsets.push(offset * forwardDirection);
  }
  for (let offset = 1; offset <= backwardCount; offset += 1) {
    offsets.push(offset * -forwardDirection);
  }

  offsets.forEach((offset) => {
    const index = centerIndex + offset;
    if (index < 0 || index >= artwork.frameCount) return;
    loadArtworkFrame(artwork, index, "low")
      .then(() => drawClosestLoadedFrame(artwork))
      .catch(() => {});
  });
}

function drawClosestLoadedFrame(artwork) {
  if (artwork !== getActiveArtwork()) return;

  const targetIndex = artwork.currentFrameIndex;
  const displayedIndex = artwork.displayedFrameIndex;
  let candidateIndex = displayedIndex;
  let candidateDistance = Math.abs(targetIndex - displayedIndex);

  artwork.frames.forEach((_, index) => {
    const distanceToTarget = Math.abs(targetIndex - index);
    const movesTowardTarget =
      displayedIndex < targetIndex
        ? index > displayedIndex && index <= targetIndex
        : index < displayedIndex && index >= targetIndex;

    if (movesTowardTarget && distanceToTarget < candidateDistance) {
      candidateIndex = index;
      candidateDistance = distanceToTarget;
    }
  });

  if (candidateIndex === displayedIndex || !artwork.frames.has(candidateIndex)) return;
  drawFrameToCanvas(artwork, artwork.frames.get(candidateIndex), candidateIndex);
}

function getArtworkCacheBounds(artwork, centerIndex) {
  if (artwork.preloadDirection > 0) {
    return [centerIndex - 4, centerIndex + 10];
  }
  if (artwork.preloadDirection < 0) {
    return [centerIndex - 10, centerIndex + 4];
  }
  return [centerIndex - 6, centerIndex + 6];
}

function trimArtworkFrameCache(artwork, centerIndex) {
  const [start, end] = getArtworkCacheBounds(artwork, centerIndex);
  artwork.frames.forEach((_, index) => {
    if (index !== 0 && (index < start || index > end)) {
      artwork.frames.delete(index);
    }
  });
}

function drawCurrentFrame() {
  artworks.forEach((artwork, artworkIndex) => {
    drawFrame(artwork.currentFrameIndex, artworkIndex);
  });
}

function requestStartTracking() {
  if (isStarting || trackingStarted) return;

  startTracking().catch((error) => {
    console.error(error);
    isStarting = false;
    trackingStarted = false;
    if (maybeSwitchToLocalhost(error)) return;
    statusText.textContent = getStartErrorMessage(error);
    retryButton.hidden = false;
    maybeRetryAutoStart(error);
  });
}

function scheduleAutoStart(delay) {
  if (trackingStarted || isStarting || document.hidden) return;
  clearTimeout(autoStartTimer);
  autoStartTimer = window.setTimeout(() => {
    requestStartTracking();
  }, delay);
}

function maybeRetryAutoStart(error) {
  if (trackingStarted || isStarting) return;
  if (error?.name === "NotAllowedError") return;
  if (autoStartAttempts >= 4) return;
  autoStartAttempts += 1;
  scheduleAutoStart(900 + autoStartAttempts * 600);
}

function maybeSwitchToLocalhost(error) {
  if (error?.name !== "NotAllowedError") return false;
  if (location.hostname !== "127.0.0.1") return false;

  const redirectKey = `frame-camera-localhost-retry:${location.port || "80"}`;
  if (sessionStorage.getItem(redirectKey)) return false;

  sessionStorage.setItem(redirectKey, "1");
  const nextUrl = `${location.protocol}//localhost${location.port ? `:${location.port}` : ""}${location.pathname}${location.search}${location.hash}`;
  statusText.textContent = "Retrying camera";
  location.replace(nextUrl);
  return true;
}

async function startTracking() {
  if (!window.isSecureContext) {
    throw new Error("InsecureContext");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("CameraUnavailable");
  }

  isStarting = true;
  retryButton.hidden = true;
  statusText.textContent = "Allow camera";

  if (!hasActiveCameraStream()) {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 960 },
        height: { ideal: 720 },
      },
      audio: false,
    });
  }

  webcam.srcObject = cameraStream;
  await webcam.play();
  resizeOverlay();

  statusText.textContent = "Loading model";
  try {
    visionTasks ||= await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18");
    const vision = await visionTasks.FilesetResolver.forVisionTasks(wasmUrl);
    handLandmarker = await createHandLandmarker(vision);
    faceLandmarker = await createFaceLandmarker(vision);
  } catch (error) {
    throw new Error("ModelLoadFailed", { cause: error });
  }

  isStarting = false;
  trackingStarted = true;
  autoStartAttempts = 0;
  statusText.textContent = getInputPrompt();
  requestAnimationFrame(trackVision);
}

function hasActiveCameraStream() {
  return cameraStream?.getVideoTracks().some((track) => track.readyState === "live");
}

async function createHandLandmarker(vision) {
  try {
    return await visionTasks.HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: handModelUrl,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });
  } catch {
    return visionTasks.HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: handModelUrl,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });
  }
}

async function createFaceLandmarker(vision) {
  const options = (delegate) => ({
    baseOptions: {
      modelAssetPath: faceModelUrl,
      delegate,
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
  });

  try {
    return await visionTasks.FaceLandmarker.createFromOptions(vision, options("GPU"));
  } catch {
    return visionTasks.FaceLandmarker.createFromOptions(vision, options("CPU"));
  }
}

function getStartErrorMessage(error) {
  if (error?.name === "NotAllowedError") return "Camera denied";
  if (error?.name === "NotFoundError") return "No camera";
  if (error?.message === "InsecureContext") return "Use localhost";
  if (error?.message === "CameraUnavailable") return "No camera API";
  if (error?.message === "ModelLoadFailed") return "Model failed";
  if (!navigator.onLine) return "Offline";
  return "Start failed";
}

function trackVision() {
  resizeOverlay();

  if (webcam.currentTime !== lastVideoTime && handLandmarker && faceLandmarker) {
    lastVideoTime = webcam.currentTime;
    try {
      clearOverlay();
      const timestamp = performance.now();
      if (controlMode === "mouth") {
        mouthTrackingFrame = (mouthTrackingFrame + 1) % mouthSwipeProbeEvery;
        const isScanningHandInput = timestamp < mouthHandScanUntil;
        if (isScanningHandInput || mouthTrackingFrame === 0) {
          if (lastFaceLandmarks) drawMouth(lastFaceLandmarks);
          const hands = handLandmarker.detectForVideo(webcam, timestamp).landmarks || [];
          hands.forEach(drawHand);
          if (hands.length) {
            const pointerState = handleModePointer(hands[0], timestamp);
            const isVerticalSwipeReady = isSwipeReadyAtEdge(hands[0]);

            if (pointerState.nearControls || (!isScanningHandInput && isVerticalSwipeReady)) {
              mouthHandScanUntil = timestamp + mouthSwipeScanDurationMs;
            }

            if (pointerState.nearControls) {
              resetSwipeMemory();
            } else {
              handleSwipeGesture(hands[0], timestamp);
            }
          } else {
            if (isScanningHandInput) mouthHandScanUntil = 0;
            hideModePointer();
            resetSwipeMemory();
          }
        } else {
          handleFaceResult(faceLandmarker.detectForVideo(webcam, timestamp));
        }
      } else {
        const result = handLandmarker.detectForVideo(webcam, timestamp);
        const hands = result.landmarks || [];
        if (hands.length) {
          handleHandVisible();
          hands.forEach(drawHand);
          const pointerState = handleModePointer(hands[0], timestamp);
          if (pointerState.overControl) {
            resetSwipeMemory();
          } else {
            handleSwipeGesture(hands[0], timestamp);
            handleHands(hands);
          }
        } else {
          handleHandMissing();
          hideModePointer();
          resetSwipeMemory();
        }
      }
    } catch (error) {
      console.error(error);
      statusText.textContent = "Tracking error";
    }
  }

  requestAnimationFrame(trackVision);
}

function handleHands(hands) {
  if (controlMode === "span") {
    if (hands.length < 2) {
      resetSpanMemory();
      return;
    }
    handleSpanGesture(hands[0], hands[1]);
    return;
  }

  if (controlMode === "pinch") {
    handlePinchGesture(hands[0]);
    return;
  }

  handlePalmGesture(hands[0]);
}

function handlePalmGesture(hand) {
  if (!activeArtworkHasFrames()) return;
  stopProgressAnimation();
  const rawFoldSignal = getFoldSignal(hand);
  const foldDelta = getFoldSignalDelta(rawFoldSignal);

  if (foldDelta !== 0) {
    targetFoldProgress = clamp(
      targetFoldProgress + (foldDelta * getControlDirection("palm")) / gestureSensitivity,
      0,
      1
    );
  }

  smoothFoldProgress = targetFoldProgress;
  renderProgress(smoothFoldProgress, getGestureLabel(smoothFoldProgress));
}

function handlePinchGesture(hand) {
  if (!activeArtworkHasFrames()) return;
  stopProgressAnimation();
  const rawPinchSignal = getPinchSignal(hand);
  const pinchDelta = getPinchSignalDelta(rawPinchSignal);

  if (pinchDelta !== 0) {
    targetFoldProgress = clamp(
      targetFoldProgress + (pinchDelta * getControlDirection("pinch")) / pinchSensitivity,
      0,
      1
    );
  }

  smoothFoldProgress = targetFoldProgress;
  renderProgress(smoothFoldProgress, getGestureLabel(smoothFoldProgress));
}

function handleSpanGesture(leftHand, rightHand) {
  if (!activeArtworkHasFrames()) return;
  stopProgressAnimation();
  const rawSpanSignal = getSpanSignal(leftHand, rightHand);
  const spanDelta = getSpanSignalDelta(rawSpanSignal);

  if (spanDelta !== 0) {
    targetFoldProgress = clamp(
      targetFoldProgress + (spanDelta * getControlDirection("span")) / spanSensitivity,
      0,
      1
    );
  }

  smoothFoldProgress = targetFoldProgress;
  renderProgress(smoothFoldProgress, getGestureLabel(smoothFoldProgress));
}

function handleFaceResult(result) {
  const face = result.faceLandmarks?.[0];
  if (!face) {
    lastFaceLandmarks = null;
    handleHandMissing();
    return;
  }

  lastFaceLandmarks = face;
  handleHandVisible();
  drawMouth(face);
  handleMouthGesture(result, face);
}

function handleMouthGesture(result, face) {
  if (!activeArtworkHasFrames()) return;
  stopProgressAnimation();
  const rawMouthSignal = getMouthFoldSignal(result, face);
  const mouthDelta = getMouthSignalDelta(rawMouthSignal);

  if (mouthDelta !== 0) {
    targetFoldProgress = clamp(
      targetFoldProgress + (mouthDelta * getControlDirection("mouth")) / mouthSensitivity,
      0,
      1
    );
  }

  smoothFoldProgress = targetFoldProgress;
  renderProgress(smoothFoldProgress, getGestureLabel(smoothFoldProgress));
}

function getFoldSignal(hand) {
  const wrist = hand[0];
  const palmBase = hand[9];
  const palmWidth = Math.max(distance(hand[5], hand[17]), distance(wrist, palmBase), 0.001);
  const fingers = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];
  const fingerExtension =
    fingers.reduce((sum, [tip, pip]) => {
      const reachPastKnuckle = (distance(hand[tip], wrist) - distance(hand[pip], wrist)) / palmWidth;
      return sum + mapRange(reachPastKnuckle, 0.08, 0.72);
    }, 0) / fingers.length;
  const fingerReach =
    fingers.reduce((sum, [tip]) => sum + distance(hand[tip], wrist) / palmWidth, 0) /
    fingers.length;
  const reach = mapRange(fingerReach, 1.16, 2.18);
  const fingerOpen = clamp(fingerExtension * 0.68 + reach * 0.32, 0, 1);
  const pinchOpen = mapRange(distance(hand[4], hand[8]) / palmWidth, 0.26, 1.04);

  return clamp(1 - (pinchOpen * 0.78 + fingerOpen * 0.22), 0, 1);
}

function getPinchSignal(hand) {
  const pinchDistance = getNormalizedPinchDistance(hand);
  return 1 - mapRange(pinchDistance, 0.18, 1.04);
}

function getNormalizedPinchDistance(hand) {
  const wrist = hand[0];
  const palmBase = hand[9];
  const palmWidth = Math.max(distance(hand[5], hand[17]), distance(wrist, palmBase), 0.001);
  return distance(hand[4], hand[8]) / palmWidth;
}

function getSpanSignal(leftHand, rightHand) {
  const leftCenter = getPalmCenter(leftHand);
  const rightCenter = getPalmCenter(rightHand);
  const span = Math.hypot(leftCenter.x - rightCenter.x, leftCenter.y - rightCenter.y);
  return 1 - mapRange(span, 0.14, 0.72);
}

function getMouthFoldSignal(result, face) {
  const categories = result.faceBlendshapes?.[0]?.categories || result.faceBlendshapes?.[0] || [];
  const jawOpen = categories.find((category) => category.categoryName === "jawOpen");

  if (jawOpen) {
    return clamp(1 - jawOpen.score, 0, 1);
  }

  const mouthWidth = Math.max(distance(face[61], face[291]), 0.001);
  const mouthOpenRatio = distance(face[13], face[14]) / mouthWidth;
  return 1 - mapRange(mouthOpenRatio, 0.02, 0.52);
}

function getPalmCenter(hand) {
  const indexes = [0, 5, 9, 13, 17];
  const center = indexes.reduce(
    (sum, index) => ({
      x: sum.x + hand[index].x,
      y: sum.y + hand[index].y,
    }),
    { x: 0, y: 0 }
  );
  return {
    x: center.x / indexes.length,
    y: center.y / indexes.length,
  };
}

function isSwipeReadyAtEdge(hand) {
  if (getFoldSignal(hand) > 0.2) return false;
  const center = getPalmCenter(hand);
  return center.y <= swipeEdgeBoundary || center.y >= 1 - swipeEdgeBoundary;
}

function handleSwipeGesture(hand, timestamp) {
  if (!projectConfig.navigation.verticalSwipe || artworks.length < 2) {
    resetSwipeMemory();
    return;
  }
  if (timestamp < swipeCooldownUntil || getFoldSignal(hand) > 0.38) {
    resetSwipeMemory();
    return;
  }

  const center = getPalmCenter(hand);
  swipeSamples.push({ x: center.x, y: center.y, timestamp });
  swipeSamples = swipeSamples.filter((sample) => timestamp - sample.timestamp <= swipeWindowMs);
  if (swipeSamples.length < 2) return;

  const start = swipeSamples[0];
  const elapsedSeconds = Math.max((timestamp - start.timestamp) / 1000, 0.001);
  const deltaX = center.x - start.x;
  const deltaY = center.y - start.y;
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);
  const verticalVelocity = verticalDistance / elapsedSeconds;
  const isVertical = horizontalDistance <= verticalDistance * swipeAxisRatio;

  if (
    verticalDistance < swipeDistanceThreshold ||
    verticalVelocity < swipeMinimumVelocity ||
    !isVertical
  ) {
    return;
  }

  const startsFromVerticalEdge =
    (deltaY < 0 && start.y >= 1 - swipeEdgeBoundary) ||
    (deltaY > 0 && start.y <= swipeEdgeBoundary);
  if (!startsFromVerticalEdge) {
    resetSwipeMemory();
    return;
  }
  swipeCooldownUntil = timestamp + swipeCooldownMs;
  resetSwipeMemory();
  changeArtworkBy(deltaY < 0 ? 1 : -1, "swipe");
}

function handleModePointer(hand, timestamp) {
  const point = {
    x: (1 - hand[8].x) * window.innerWidth,
    y: hand[8].y * window.innerHeight,
  };
  setAmbientPointer(point.x, point.y);
  gestureCursor.style.left = `${point.x}px`;
  gestureCursor.style.top = `${point.y}px`;
  gestureCursor.classList.add("is-visible");

  let hoveredTarget = null;
  if (gestureDwellTarget) {
    const rect = gestureDwellTarget.getBoundingClientRect();
    if (isPointInsideRect(point, rect, gestureDwellRetentionPadding)) {
      hoveredTarget = gestureDwellTarget;
    }
  }

  if (!hoveredTarget) {
    hoveredTarget = gestureActionTargets.find((target) => {
      const rect = target.getBoundingClientRect();
      const padding = target.classList.contains("stack-arrow") ? gestureArrowHitPadding : 0;
      return isPointInsideRect(point, rect, padding);
    });
  }

  gestureActionTargets.forEach((target) => {
    const isHovered = target === hoveredTarget;
    target.classList.toggle("is-gesture-hovered", isHovered);
  });

  const nearControls = gestureActionTargets.some((target) => {
    const rect = target.getBoundingClientRect();
    return (
      point.x >= rect.left - modePointerApproachPadding &&
      point.x <= rect.right + modePointerApproachPadding &&
      point.y >= rect.top - modePointerApproachPadding &&
      point.y <= rect.bottom + modePointerApproachPadding
    );
  });
  const pinchDistance = getNormalizedPinchDistance(hand);
  const dwellTriggeredNow = updateGestureDwell(hoveredTarget, timestamp);

  if (!gesturePinchInitialized) {
    gesturePinchInitialized = true;
    gestureCursorPinched = pinchDistance < modePinchReleaseThreshold;
  } else if (!gestureCursorPinched && pinchDistance <= modePinchCloseThreshold) {
    gestureCursorPinched = true;
    if (hoveredTarget && !dwellTriggeredNow) {
      activateGestureTarget(hoveredTarget);
      gestureDwellTriggered = true;
      gestureCursor.classList.remove("is-dwelling");
    }
  } else if (gestureCursorPinched && pinchDistance >= modePinchReleaseThreshold) {
    gestureCursorPinched = false;
  }

  gestureCursor.classList.toggle("is-pinching", gestureCursorPinched);
  return { overControl: Boolean(hoveredTarget), nearControls };
}

function isPointInsideRect(point, rect, padding = 0) {
  return (
    point.x >= rect.left - padding &&
    point.x <= rect.right + padding &&
    point.y >= rect.top - padding &&
    point.y <= rect.bottom + padding
  );
}

function updateGestureDwell(target, timestamp) {
  if (target !== gestureDwellTarget) {
    gestureDwellTarget = target;
    gestureDwellStartedAt = target ? timestamp : 0;
    gestureDwellTriggered = false;
    gestureCursor.style.setProperty("--gesture-dwell-angle", "0deg");
  }

  if (!target || gestureDwellTriggered) {
    gestureCursor.classList.remove("is-dwelling");
    return false;
  }

  const dwellProgress = clamp((timestamp - gestureDwellStartedAt) / gestureDwellDurationMs, 0, 1);
  gestureCursor.style.setProperty("--gesture-dwell-angle", `${dwellProgress * 360}deg`);
  gestureCursor.classList.add("is-dwelling");

  if (dwellProgress < 1) return false;

  gestureDwellTriggered = true;
  gestureCursor.classList.remove("is-dwelling");
  activateGestureTarget(target);
  return true;
}

function activateGestureTarget(target) {
  if (target === previousArtworkButton) {
    changeArtworkBy(-1, "gesture");
    return;
  }
  if (target === nextArtworkButton) {
    changeArtworkBy(1, "gesture");
    return;
  }
  setControlMode(target.dataset.mode, "gesture");
}

function resetGestureDwell() {
  gestureDwellTarget = null;
  gestureDwellStartedAt = 0;
  gestureDwellTriggered = false;
  gestureCursor.style.setProperty("--gesture-dwell-angle", "0deg");
  gestureCursor.classList.remove("is-dwelling");
}

function hideModePointer() {
  gestureCursor.classList.remove("is-visible", "is-pinching", "is-dwelling");
  gestureActionTargets.forEach((target) => target.classList.remove("is-gesture-hovered"));
  gestureCursorPinched = false;
  gesturePinchInitialized = false;
  resetGestureDwell();
}

function resetSwipeMemory() {
  swipeSamples = [];
}

function handleHandVisible() {
  const now = performance.now();
  const reacquiredHand = !handWasVisible || now - lastHandSeenAt > handDropoutGraceMs;
  lastHandSeenAt = now;

  if (reacquiredHand) {
    stopProgressAnimation();
    handWasVisible = true;
    targetFoldProgress = smoothFoldProgress;
    resetInputMemory();
  }
}

function handleHandMissing() {
  const timeSinceLastHand = performance.now() - lastHandSeenAt;
  if (handWasVisible && timeSinceLastHand < handDropoutGraceMs) {
    statusText.textContent = getGestureLabel(smoothFoldProgress);
    return;
  }

  if (handWasVisible) {
    handWasVisible = false;
    targetFoldProgress = smoothFoldProgress;
    resetInputMemory();
  }

  statusText.textContent = lastHandSeenAt === 0 ? getInputPrompt() : getHoldLabel(smoothFoldProgress);
}

function getInputPrompt() {
  return controlMode === "mouth" ? "Show face" : "Show hand";
}

function getFoldSignalDelta(rawFoldSignal) {
  filteredFoldSignal =
    filteredFoldSignal === null ? rawFoldSignal : lerp(filteredFoldSignal, rawFoldSignal, 0.58);

  if (previousFoldSignal === null) {
    previousFoldSignal = filteredFoldSignal;
    return 0;
  }

  const delta = filteredFoldSignal - previousFoldSignal;
  previousFoldSignal = filteredFoldSignal;
  return Math.abs(delta) < signalDeadzone ? 0 : delta;
}

function getControlDirection(type) {
  return controlSettings.get(type)?.invert ? -1 : 1;
}

function getPinchSignalDelta(rawPinchSignal) {
  filteredPinchSignal =
    filteredPinchSignal === null ? rawPinchSignal : lerp(filteredPinchSignal, rawPinchSignal, 0.58);

  if (previousPinchSignal === null) {
    previousPinchSignal = filteredPinchSignal;
    return 0;
  }

  const delta = filteredPinchSignal - previousPinchSignal;
  previousPinchSignal = filteredPinchSignal;
  return Math.abs(delta) < signalDeadzone ? 0 : delta;
}

function getSpanSignalDelta(rawSpanSignal) {
  filteredSpanSignal =
    filteredSpanSignal === null ? rawSpanSignal : lerp(filteredSpanSignal, rawSpanSignal, 0.58);

  if (previousSpanSignal === null) {
    previousSpanSignal = filteredSpanSignal;
    return 0;
  }

  const delta = filteredSpanSignal - previousSpanSignal;
  previousSpanSignal = filteredSpanSignal;
  return Math.abs(delta) < signalDeadzone ? 0 : delta;
}

function getMouthSignalDelta(rawMouthSignal) {
  filteredMouthSignal =
    filteredMouthSignal === null ? rawMouthSignal : lerp(filteredMouthSignal, rawMouthSignal, 0.5);

  if (previousMouthSignal === null) {
    previousMouthSignal = filteredMouthSignal;
    return 0;
  }

  const delta = filteredMouthSignal - previousMouthSignal;
  previousMouthSignal = filteredMouthSignal;
  return Math.abs(delta) < signalDeadzone ? 0 : delta;
}

function resetInputMemory() {
  previousFoldSignal = null;
  filteredFoldSignal = null;
  previousPinchSignal = null;
  filteredPinchSignal = null;
  previousMouthSignal = null;
  filteredMouthSignal = null;
  resetSpanMemory();
  resetSwipeMemory();
}

function resetSpanMemory() {
  previousSpanSignal = null;
  filteredSpanSignal = null;
}

function smoothProgressTowardTarget(current, target) {
  const next = lerp(current, target, 0.36);
  return Math.abs(next - target) < 0.006 ? target : next;
}

function updateFrameFromProgress(foldProgress) {
  const artwork = getActiveArtwork();
  const frameIndex = clamp(
    Math.round(foldProgress * (artwork.frameCount - 1)),
    0,
    artwork.frameCount - 1
  );
  if (frameIndex !== artwork.currentFrameIndex) {
    drawFrame(frameIndex);
  }
}

function updateGestureMeter(foldProgress) {
  gestureFill.style.width = `${Math.round(clamp(foldProgress, 0, 1) * 100)}%`;
}

function renderProgress(foldProgress, label) {
  if (activeArtworkHasFrames()) {
    getActiveArtwork().progress = foldProgress;
  }
  updateFrameFromProgress(foldProgress);
  updateGestureMeter(foldProgress);
  statusText.textContent = label;
}

function animateProgress() {
  if (progressAnimationId) return;

  const tick = () => {
    smoothFoldProgress = smoothProgressTowardTarget(smoothFoldProgress, targetFoldProgress);
    renderProgress(smoothFoldProgress, getHoldLabel(smoothFoldProgress));

    if (Math.abs(smoothFoldProgress - targetFoldProgress) > 0.006) {
      progressAnimationId = requestAnimationFrame(tick);
    } else {
      progressAnimationId = 0;
      statusText.textContent = getHoldLabel(smoothFoldProgress);
    }
  };

  progressAnimationId = requestAnimationFrame(tick);
}

function stopProgressAnimation() {
  if (!progressAnimationId) return;
  cancelAnimationFrame(progressAnimationId);
  progressAnimationId = 0;
}

function getGestureLabel(foldProgress) {
  const artwork = getActiveArtwork();
  const frameNumber = Math.round(foldProgress * (artwork.frameCount - 1)) + 1;
  return `${artwork.name} ${frameNumber}/${artwork.frameCount}`;
}

function getHoldLabel(foldProgress) {
  const artwork = getActiveArtwork();
  const frameNumber = Math.round(foldProgress * (artwork.frameCount - 1)) + 1;
  return `Hold ${artwork.name} ${frameNumber}/${artwork.frameCount}`;
}

function resizeOverlay() {
  const rect = overlay.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));

  if (overlay.width !== width || overlay.height !== height) {
    overlay.width = width;
    overlay.height = height;
  }
}

function clearOverlay() {
  const ratio = window.devicePixelRatio || 1;
  overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  overlayCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawHand(hand) {
  const rect = overlay.getBoundingClientRect();
  const points = hand.map((point) => ({
    x: (1 - point.x) * rect.width,
    y: point.y * rect.height,
  }));

  overlayCtx.lineCap = "round";
  overlayCtx.lineJoin = "round";
  overlayCtx.lineWidth = 3;
  overlayCtx.strokeStyle = "rgba(255, 255, 255, 0.88)";

  for (const [start, end] of handConnections) {
    overlayCtx.beginPath();
    overlayCtx.moveTo(points[start].x, points[start].y);
    overlayCtx.lineTo(points[end].x, points[end].y);
    overlayCtx.stroke();
  }

  for (const point of points) {
    overlayCtx.beginPath();
    overlayCtx.arc(point.x, point.y, 3.8, 0, Math.PI * 2);
    overlayCtx.fillStyle = "rgba(0, 0, 0, 0.78)";
    overlayCtx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    overlayCtx.fill();
    overlayCtx.stroke();
  }
}

function drawMouth(face) {
  const rect = overlay.getBoundingClientRect();
  const points = face.map((point) => ({
    x: (1 - point.x) * rect.width,
    y: point.y * rect.height,
  }));

  overlayCtx.lineCap = "round";
  overlayCtx.lineJoin = "round";
  overlayCtx.lineWidth = 2.5;
  overlayCtx.strokeStyle = "rgba(255, 255, 255, 0.92)";

  for (const contour of mouthContours) {
    overlayCtx.beginPath();
    contour.forEach((index, position) => {
      const point = points[index];
      if (position === 0) overlayCtx.moveTo(point.x, point.y);
      else overlayCtx.lineTo(point.x, point.y);
    });
    overlayCtx.stroke();
  }
}

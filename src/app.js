import { translations } from './translations.js';
import { GifReader } from './omggif.js';
import { GIFEncoder, quantize, applyPalette } from './gifenc.js';

const camera = document.querySelector('#camera');
const canvas = document.querySelector('#capture-canvas');
const startScreen = document.querySelector('#start-screen');
const cameraUi = document.querySelector('#camera-ui');
const startButton = document.querySelector('#start-button');
const switchCameraButton = document.querySelector('#switch-camera');
const frameToggle = document.querySelector('#frame-toggle');
const captureButton = document.querySelector('#capture-button');
const photoPreview = document.querySelector('#photo-preview');
const photoResult = document.querySelector('#photo-result');
const retakeButton = document.querySelector('#retake-button');
const saveButton = document.querySelector('#save-button');
const message = document.querySelector('#message');
const trackingHint = document.querySelector('#tracking-hint');
const trackingText = document.querySelector('#tracking-text');
const markerGuide = document.querySelector('#marker-guide');
const arContent = document.querySelector('#ar-content');
const resetMarker = document.querySelector('#reset-marker');
const langBtns = document.querySelectorAll('.lang-btn');

let stream;
let facingMode = 'environment';
let isFramed = true;
let currentPhotoBlob;
let currentPhotoDataUrl;
let animationId;
let detector;
let marker = null;
let markerFoundPreviously = false;
const logo = new Image();
logo.src = './GraphicResources/Banners_&_logo/Logo_&_wordmark.svg';

const arOrb = document.querySelector('#ar-orb');
const arMediaPreview = document.querySelector('#ar-media-preview');
const ar3dModel = document.querySelector('#ar-3d-model');
const btnZoomIn = document.querySelector('#btn-zoom-in');
const btnZoomOut = document.querySelector('#btn-zoom-out');
const btnRotLeft = document.querySelector('#btn-rot-left');
const btnRotRight = document.querySelector('#btn-rot-right');
const btnToggle3d = document.querySelector('#btn-toggle-3d');
const btnTogglePause = document.querySelector('#btn-toggle-pause');
const arTransformBar = document.querySelector('#ar-transform-bar');
const liveFrameOverlay = document.querySelector('#live-frame-overlay');
const liveFrameWatermark = document.querySelector('#live-frame-watermark');

function updateLiveFrame() {
  if (liveFrameOverlay) {
    liveFrameOverlay.classList.toggle('is-hidden', !isFramed);
  }
  document.body.classList.toggle('frame-active', isFramed);
}

const btnResetTransform = document.querySelector('#btn-reset-transform');
const arScaleBadge = document.querySelector('#ar-scale-badge');

const btnModePhoto = document.querySelector('#btn-mode-photo');
const btnModeGif = document.querySelector('#btn-mode-gif');
const shutterCountdown = document.querySelector('#shutter-countdown');
const shutterRingProgress = document.querySelector('#shutter-ring-progress');

const params = new URLSearchParams(window.location.search);
const contentKey = params.get('content') || 'welcome';
const mediaParam = params.get('media');

let userOffsetX = 0;
let userOffsetY = 0;
let userScale = 1.0;
let userRotateZ = 0;
let userRotateX = 0;
let userRotateY = 0;
let is3dMode = false;
let is3dModel = false;
let baseAnchorX = window.innerWidth / 2;
let baseAnchorY = window.innerHeight * (mediaParam ? 0.46 : 0.35);
let baseAngle = 0;

let mediaImage = null;
let mediaLoaded = false;

// Gestione Pausa e Frame GIF
let isPaused = false;
let pausedFrameIndex = 0;
let decodedGifFrames = [];
let gifTotalDuration = 0;
let gifStartTime = performance.now();

// Gestione Modalità Scatto (Foto vs GIF 6s)
let captureMode = 'photo'; // 'photo' | 'gif'
let isRecordingGif = false;
let gifRecordInterval = null;
let gifRecordFrames = [];
let currentGifBlob = null;
let currentGifDataUrl = null;

async function loadGifFrames(url) {
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const reader = new GifReader(new Uint8Array(buf));
    const numFrames = reader.numFrames();
    const width = reader.width;
    const height = reader.height;
    const pixels = new Uint8ClampedArray(width * height * 4);

    decodedGifFrames = [];
    gifTotalDuration = 0;

    for (let i = 0; i < numFrames; i++) {
      reader.decodeAndBlitFrameRGBA(i, pixels);
      const fCanvas = document.createElement('canvas');
      fCanvas.width = width;
      fCanvas.height = height;
      const fCtx = fCanvas.getContext('2d');
      const imgData = fCtx.createImageData(width, height);
      imgData.data.set(pixels);
      fCtx.putImageData(imgData, 0, 0);

      const delay = (reader.frameInfo(i).delay || 10) * 10;
      decodedGifFrames.push({
        canvas: fCanvas,
        delay: delay,
        time: gifTotalDuration
      });
      gifTotalDuration += delay;
    }
    gifStartTime = performance.now();
  } catch (err) {
    console.warn('Impossibile decodificare i singoli frame GIF:', err);
  }
}

function getCurrentGifFrame() {
  if (!decodedGifFrames.length) return null;
  if (isPaused) {
    return decodedGifFrames[pausedFrameIndex] || decodedGifFrames[0];
  }
  if (!gifTotalDuration) return decodedGifFrames[0];
  const elapsed = (performance.now() - gifStartTime) % gifTotalDuration;
  let accumulated = 0;
  for (let i = 0; i < decodedGifFrames.length; i++) {
    accumulated += decodedGifFrames[i].delay;
    if (elapsed <= accumulated) {
      pausedFrameIndex = i;
      return decodedGifFrames[i];
    }
  }
  return decodedGifFrames[0];
}

function updateScaleDisplay() {
  if (arScaleBadge) {
    arScaleBadge.textContent = `${Math.round(userScale * 100)}%`;
  }
}

function applyArTransform() {
  const posX = baseAnchorX + userOffsetX;
  const posY = baseAnchorY + userOffsetY;
  arContent.style.left = `${posX}px`;
  arContent.style.top = `${posY}px`;

  const translatePart = (mediaParam || is3dModel) ? 'translate(-50%, -50%)' : 'translate(-50%, -100%)';
  const totalAngleZ = baseAngle + userRotateZ;
  arContent.style.transform = `${translatePart} perspective(1000px) rotateX(${userRotateX}deg) rotateY(${userRotateY}deg) rotateZ(${totalAngleZ}deg) scale(${userScale})`;
}

if (mediaParam) {
  const ext = mediaParam.split('.').pop().toLowerCase();
  if (['gif', 'png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) {
    if (arContent) {
      arContent.classList.add('is-media-only');
    }
    if (arOrb && arMediaPreview) {
      arOrb.hidden = true;
      arMediaPreview.hidden = false;
      arMediaPreview.src = mediaParam;
    }
    mediaImage = new Image();
    mediaImage.crossOrigin = 'anonymous';
    mediaImage.onload = () => {
      mediaLoaded = true;
    };
    mediaImage.src = mediaParam;

    if (ext === 'gif') {
      loadGifFrames(mediaParam);
    }
  } else if (['glb', 'gltf'].includes(ext)) {
    is3dModel = true;
    if (arContent) {
      arContent.classList.add('is-media-only');
    }
    if (arOrb && arMediaPreview && ar3dModel) {
      arOrb.hidden = true;
      arMediaPreview.hidden = true;
      ar3dModel.hidden = false;
      ar3dModel.src = mediaParam;
    }
  }
}

// Default language: English ('en') as requested, with query param and localStorage support
let currentLang = params.get('lang') || localStorage.getItem('ismar_lang') || 'en';
if (!translations[currentLang]) currentLang = 'en';

function getT() {
  return translations[currentLang] || translations.en;
}

function getCurrentContent() {
  const t = getT();
  if (mediaParam) {
    const rawName = mediaParam.split('/').pop().replace(/\.[^/.]+$/, '');
    const cleanName = rawName.replace(/[-_]/g, ' ');
    const formattedTitle = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    return {
      title: formattedTitle,
      description: t.mediaScanDescription || 'Augmented Reality Experience'
    };
  }
  return t.contents[contentKey] || t.contents.welcome || { title: 'ISMAR 2026', description: '' };
}

let messageTimeout = null;
function setMessage(text, autoClearMs = 0) {
  if (messageTimeout) {
    clearTimeout(messageTimeout);
    messageTimeout = null;
  }
  message.textContent = text;
  message.style.opacity = '1';
  if (autoClearMs > 0) {
    messageTimeout = setTimeout(() => {
      message.style.opacity = '0';
      setTimeout(() => {
        if (message.style.opacity === '0') {
          message.textContent = '';
        }
      }, 300);
    }, autoClearMs);
  }
}

function updateTranslations() {
  const t = getT();
  const currentContent = getCurrentContent();

  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.innerHTML = t[key];
  });

  document.querySelector('#content-title').textContent = currentContent.title;
  document.querySelector('#content-description').textContent = currentContent.description;

  switchCameraButton.setAttribute('title', t.switchCameraTitle);
  switchCameraButton.setAttribute('aria-label', t.switchCameraTitle);

  if (btnModePhoto) btnModePhoto.textContent = t.modePhoto || 'Photo';
  if (btnModeGif) btnModeGif.textContent = t.modeGif || 'GIF 6s';
  if (btnTogglePause) {
    const pauseTitle = isPaused ? (t.animResumed || 'Riprendi') : (t.animPaused || 'Pausa');
    btnTogglePause.setAttribute('title', pauseTitle);
    btnTogglePause.setAttribute('aria-label', pauseTitle);
  }
  if (saveButton) {
    saveButton.textContent = (captureMode === 'gif') ? (t.saveGif || 'Save GIF') : (t.savePhoto || 'Save photo');
  }

  langBtns.forEach((btn) => {
    const isActive = btn.getAttribute('data-lang') === currentLang;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  if (liveFrameWatermark) {
    liveFrameWatermark.textContent = t.watermark || 'XR venue experience · #ISMAR2026';
  }

  if (marker) {
    trackingText.textContent = t.trackingHintFound;
  } else {
    trackingText.textContent = t.trackingHintLooking;
  }
}

async function startCamera() {
  const t = getT();
  if (!navigator.mediaDevices?.getUserMedia) {
    setMessage(t.cameraUnsupported);
    return;
  }
  try {
    stopCamera();
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
    camera.srcObject = stream;
    await camera.play();
    document.body.classList.add('camera-active');
    startScreen.hidden = true;
    cameraUi.hidden = false;
    if (arTransformBar) arTransformBar.hidden = false;
    updateLiveFrame();
    setMessage(t.contentHint);
    initialiseDetector();
  } catch (error) {
    console.error(error);
    setMessage(t.cameraPermission);
  }
}

function stopCamera() {
  cancelAnimationFrame(animationId);
  stream?.getTracks().forEach((track) => track.stop());
  stream = undefined;
  document.body.classList.remove('camera-active');
}

function initialiseDetector() {
  const t = getT();
  if ('BarcodeDetector' in window) {
    try {
      detector = new BarcodeDetector({ formats: ['qr_code'] });
      scanForMarker();
      return;
    } catch (error) {
      console.warn('QR detector non disponibile', error);
    }
  }
  detector = null;
  showFallbackMarker();
  setMessage(t.contentFallbackHint);
}

async function scanForMarker() {
  const t = getT();
  if (!stream || !detector || camera.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    animationId = requestAnimationFrame(scanForMarker);
    return;
  }
  try {
    const codes = await detector.detect(camera);
    if (codes[0]?.cornerPoints?.length) {
      marker = codes[0].cornerPoints;
      positionContent(marker);
      arContent.hidden = false;
      markerGuide.classList.add('is-hidden');
      trackingHint.classList.add('is-tracking');
      trackingText.textContent = t.trackingHintFound;
      if (!markerFoundPreviously) {
        markerFoundPreviously = true;
        setMessage(t.photoSuccessHint, 4500);
      }
    } else if (!marker) {
      arContent.hidden = true;
      markerFoundPreviously = false;
    }
  } catch (error) {
    console.warn('Errore lettura marker', error);
  }
  animationId = requestAnimationFrame(scanForMarker);
}

function positionContent(points) {
  const rect = camera.getBoundingClientRect();
  const videoRatio = camera.videoWidth / camera.videoHeight;
  const displayRatio = rect.width / rect.height;
  let scale, offsetX = 0, offsetY = 0;
  if (videoRatio > displayRatio) {
    scale = rect.height / camera.videoHeight;
    offsetX = (rect.width - camera.videoWidth * scale) / 2;
  } else {
    scale = rect.width / camera.videoWidth;
    offsetY = (rect.height - camera.videoHeight * scale) / 2;
  }
  const center = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 });
  baseAnchorX = offsetX + (center.x / points.length) * scale;
  baseAnchorY = offsetY + (center.y / points.length) * scale;
  baseAngle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x) * (180 / Math.PI);
  applyArTransform();
}

function showFallbackMarker() {
  marker = null;
  arContent.hidden = false;
  baseAnchorX = window.innerWidth / 2;
  baseAnchorY = window.innerHeight * ((mediaParam || is3dModel) ? 0.46 : 0.35);
  baseAngle = 0;
  applyArTransform();
  markerGuide.classList.remove('is-hidden');
}

function drawArCard(context, width, height, modelSnapshotImg = null) {
  const rect = camera.getBoundingClientRect();
  const screenW = rect.width || window.innerWidth;
  const screenH = rect.height || window.innerHeight;
  const currentScreenX = baseAnchorX + userOffsetX;
  const currentScreenY = baseAnchorY + userOffsetY;
  const canvasTargetX = (currentScreenX / screenW) * width;
  const canvasTargetY = (currentScreenY / screenH) * height;
  const totalAngleZ = baseAngle + userRotateZ;
  const scale = Math.min(width / 390, height / 844) * userScale;

  const tiltScaleX = Math.cos((userRotateY * Math.PI) / 180);
  const tiltScaleY = Math.cos((userRotateX * Math.PI) / 180);

  if (is3dModel && modelSnapshotImg && modelSnapshotImg.naturalWidth) {
    const mediaSize = Math.min(width * 0.78, height * 0.52) * userScale;
    context.save();
    context.translate(canvasTargetX, canvasTargetY);
    context.rotate((totalAngleZ * Math.PI) / 180);
    context.scale(tiltScaleX, tiltScaleY);
    context.shadowColor = 'rgba(0, 0, 0, 0.5)';
    context.shadowBlur = 32 * scale;
    context.shadowOffsetY = 16 * scale;
    context.drawImage(modelSnapshotImg, -mediaSize / 2, -mediaSize / 2, mediaSize, mediaSize);
    context.restore();
    return;
  }

  if (mediaParam && mediaLoaded) {
    const activeFrame = getCurrentGifFrame();
    const sourceDrawable = activeFrame ? activeFrame.canvas : (mediaImage?.complete && mediaImage?.naturalWidth ? mediaImage : null);
    if (sourceDrawable) {
      const mediaSize = Math.min(width * 0.78, height * 0.52) * userScale;
      context.save();
      context.translate(canvasTargetX, canvasTargetY);
      context.rotate((totalAngleZ * Math.PI) / 180);
      context.scale(tiltScaleX, tiltScaleY);
      context.shadowColor = 'rgba(0, 0, 0, 0.5)';
      context.shadowBlur = 32 * scale;
      context.shadowOffsetY = 16 * scale;
      context.drawImage(sourceDrawable, -mediaSize / 2, -mediaSize / 2, mediaSize, mediaSize);
      context.restore();
      return;
    }
  }

  const currentContent = getCurrentContent();
  const cardWidth = 292 * scale;
  const cardHeight = 104 * scale;

  context.save();
  context.translate(canvasTargetX, canvasTargetY);
  context.rotate((totalAngleZ * Math.PI) / 180);
  context.scale(tiltScaleX, tiltScaleY);

  context.fillStyle = '#3d1209aa';
  roundRect(context, -cardWidth / 2 + 5 * scale, -cardHeight + 7 * scale, cardWidth, cardHeight, 18 * scale);
  context.fill();

  context.fillStyle = '#f4e8d4ee';
  roundRect(context, -cardWidth / 2, -cardHeight, cardWidth, cardHeight, 18 * scale);
  context.fill();

  context.strokeStyle = '#ffffff';
  context.lineWidth = 2 * scale;
  roundRect(context, -cardWidth / 2, -cardHeight, cardWidth, cardHeight, 18 * scale);
  context.stroke();

  context.fillStyle = '#ffe000';
  roundRect(context, -cardWidth / 2 + 15 * scale, -cardHeight + 22 * scale, 53 * scale, 53 * scale, 15 * scale);
  context.fill();

  context.strokeStyle = '#3d1209';
  context.lineWidth = 2 * scale;
  context.stroke();

  context.fillStyle = '#3d1209';
  context.font = `700 ${17 * scale}px Poppins`;
  context.textAlign = 'center';
  context.fillText('AR', -cardWidth / 2 + 41.5 * scale, -cardHeight + 57 * scale);

  context.textAlign = 'left';
  context.fillStyle = '#008bf2';
  context.font = `700 ${8 * scale}px Poppins`;
  context.fillText('ISMAR 2026', -cardWidth / 2 + 81 * scale, -cardHeight + 31 * scale);

  context.fillStyle = '#3d1209';
  context.font = `700 ${18 * scale}px "Tsukimi Rounded", Poppins`;
  context.fillText(currentContent.title, -cardWidth / 2 + 81 * scale, -cardHeight + 55 * scale);

  context.font = `${9 * scale}px Poppins`;
  context.fillText(currentContent.description, -cardWidth / 2 + 81 * scale, -cardHeight + 74 * scale);
  context.restore();
}

function drawFrame(context, width, height) {
  const t = getT();
  const edge = Math.max(15, width * .027);
  context.save();
  context.strokeStyle = '#ffe000';
  context.lineWidth = edge;
  context.strokeRect(edge / 2, edge / 2, width - edge, height - edge);

  context.strokeStyle = '#008bf2';
  context.lineWidth = edge * .42;
  context.strokeRect(edge * 1.4, edge * 1.4, width - edge * 2.8, height - edge * 2.8);

  context.fillStyle = '#3d1209cc';
  context.fillRect(0, height - height * .12, width, height * .12);

  if (logo.complete && logo.naturalWidth) {
    context.drawImage(logo, edge * 2.2, height - height * .095, width * .27, (width * .27 / logo.naturalWidth) * logo.naturalHeight);
  }

  context.fillStyle = '#ffffff';
  context.textAlign = 'right';
  context.font = `600 ${Math.max(13, width * .024)}px Poppins`;
  context.fillText(t.watermark || 'XR venue experience · #ISMAR2026', width - edge * 2.2, height - height * .045);
  context.restore();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.closePath();
}

let originalGifSrc = null;

async function getModelSnapshot() {
  if (is3dModel && ar3dModel && !ar3dModel.hidden && typeof ar3dModel.toDataURL === 'function') {
    try {
      const modelUrl = await ar3dModel.toDataURL('image/png');
      if (modelUrl) {
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          img.src = modelUrl;
        });
        return img;
      }
    } catch (e) {
      console.warn('Could not capture model-viewer snapshot', e);
    }
  }
  return null;
}

const GIF_DURATION_MS = 6000;
const GIF_INTERVAL_MS = 140; // ~7 fps -> ~42 frames

async function startRecordingGif() {
  const t = getT();
  if (!camera.videoWidth || camera.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    setMessage(t.cameraStarting);
    return;
  }
  if (isRecordingGif) return;

  isRecordingGif = true;
  gifRecordFrames = [];
  captureButton.classList.add('is-recording');
  if (shutterCountdown) {
    shutterCountdown.hidden = false;
    shutterCountdown.textContent = '6s';
  }
  if (shutterRingProgress) {
    shutterRingProgress.style.strokeDashoffset = '207.34';
  }
  setMessage(t.recordingGif || 'Registrazione GIF...', GIF_DURATION_MS);

  const videoW = camera.videoWidth;
  const videoH = camera.videoHeight;
  const targetW = 390;
  const targetH = Math.round((videoH / videoW) * targetW);

  const offscreen = document.createElement('canvas');
  offscreen.width = targetW;
  offscreen.height = targetH;
  const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

  const startTime = performance.now();

  const recordFrame = async () => {
    if (!isRecordingGif) return;
    const elapsed = performance.now() - startTime;
    const remainingSec = Math.max(1, Math.ceil((GIF_DURATION_MS - elapsed) / 1000));
    if (shutterCountdown) shutterCountdown.textContent = `${remainingSec}s`;

    if (shutterRingProgress) {
      const progress = Math.min(1, elapsed / GIF_DURATION_MS);
      shutterRingProgress.style.strokeDashoffset = (207.34 * (1 - progress)).toString();
    }

    let modelSnapshotImg = await getModelSnapshot();
    offCtx.drawImage(camera, 0, 0, targetW, targetH);
    drawArCard(offCtx, targetW, targetH, modelSnapshotImg);
    if (isFramed) drawFrame(offCtx, targetW, targetH);

    const imgData = offCtx.getImageData(0, 0, targetW, targetH);
    gifRecordFrames.push({
      data: imgData.data,
      width: targetW,
      height: targetH,
      delay: GIF_INTERVAL_MS
    });

    if (elapsed >= GIF_DURATION_MS) {
      stopRecordingGif();
    }
  };

  await recordFrame();
  gifRecordInterval = setInterval(recordFrame, GIF_INTERVAL_MS);
}

async function stopRecordingGif() {
  if (!isRecordingGif) return;
  isRecordingGif = false;
  if (gifRecordInterval) {
    clearInterval(gifRecordInterval);
    gifRecordInterval = null;
  }

  captureButton.classList.remove('is-recording');
  if (shutterCountdown) shutterCountdown.hidden = true;
  if (shutterRingProgress) shutterRingProgress.style.strokeDashoffset = '207.34';

  const t = getT();
  setMessage(t.encodingGif || 'Creazione GIF...', 8000);

  await new Promise((resolve) => setTimeout(resolve, 60));

  try {
    if (!gifRecordFrames.length) {
      setMessage('');
      return;
    }

    const gif = GIFEncoder();
    const frameW = gifRecordFrames[0].width;
    const frameH = gifRecordFrames[0].height;

    for (const frame of gifRecordFrames) {
      const palette = quantize(frame.data, 128, { format: 'rgb444' });
      const index = applyPalette(frame.data, palette, 'rgb444');
      gif.writeFrame(index, frameW, frameH, {
        palette,
        delay: frame.delay
      });
    }
    gif.finish();

    const gifBytes = gif.bytes();
    if (currentGifDataUrl) {
      URL.revokeObjectURL(currentGifDataUrl);
    }
    currentGifBlob = new Blob([gifBytes], { type: 'image/gif' });
    currentGifDataUrl = URL.createObjectURL(currentGifBlob);

    photoResult.src = currentGifDataUrl;
    photoPreview.hidden = false;
    setMessage('');
  } catch (err) {
    console.error('GIF encoding error', err);
    setMessage('GIF error');
  }
}

async function capturePhoto() {
  const t = getT();
  if (!camera.videoWidth || camera.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    setMessage(t.cameraStarting);
    return;
  }
  const width = camera.videoWidth;
  const height = camera.videoHeight;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(camera, 0, 0, width, height);

  let modelSnapshotImg = await getModelSnapshot();

  drawArCard(context, width, height, modelSnapshotImg);
  if (isFramed) drawFrame(context, width, height);

  currentPhotoDataUrl = canvas.toDataURL('image/jpeg', .92);
  photoResult.src = currentPhotoDataUrl;
  currentPhotoBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .92));
  if (!currentPhotoBlob) {
    currentPhotoBlob = await (await fetch(currentPhotoDataUrl)).blob();
  }
  photoPreview.hidden = false;
}

async function savePhoto() {
  const t = getT();
  if (captureMode === 'gif') {
    if (!currentGifBlob) return;
    const file = new File([currentGifBlob], 'ismar-2026-ar-animation.gif', { type: 'image/gif' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: t.shareTitle || 'ISMAR 2026 AR Animation' });
        return;
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(currentGifBlob);
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(link.href);
    return;
  }

  if (!currentPhotoBlob) return;
  const file = new File([currentPhotoBlob], 'ismar-2026-ar-photo.jpg', { type: 'image/jpeg' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: t.shareTitle || 'ISMAR 2026 AR' });
      return;
    }
  } catch (error) {
    if (error.name === 'AbortError') return;
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(currentPhotoBlob);
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Event Listeners
startButton.addEventListener('click', startCamera);
switchCameraButton.addEventListener('click', () => {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  startCamera();
});
frameToggle.addEventListener('click', () => {
  isFramed = !isFramed;
  frameToggle.classList.toggle('is-active', isFramed);
  frameToggle.setAttribute('aria-pressed', String(isFramed));
  updateLiveFrame();
});
captureButton.addEventListener('click', () => {
  if (captureMode === 'gif') {
    if (isRecordingGif) {
      stopRecordingGif();
    } else {
      startRecordingGif();
    }
  } else {
    capturePhoto();
  }
});
retakeButton.addEventListener('click', () => {
  photoPreview.hidden = true;
  if (currentGifDataUrl) {
    URL.revokeObjectURL(currentGifDataUrl);
    currentGifDataUrl = null;
    currentGifBlob = null;
  }
});
saveButton.addEventListener('click', savePhoto);

if (btnModePhoto) {
  btnModePhoto.addEventListener('click', () => {
    if (isRecordingGif) stopRecordingGif();
    captureMode = 'photo';
    btnModePhoto.classList.add('is-active');
    btnModePhoto.setAttribute('aria-selected', 'true');
    if (btnModeGif) {
      btnModeGif.classList.remove('is-active');
      btnModeGif.setAttribute('aria-selected', 'false');
    }
    captureButton.classList.remove('mode-is-gif');
    const t = getT();
    if (saveButton) saveButton.textContent = t.savePhoto || 'Save photo';
  });
}

if (btnModeGif) {
  btnModeGif.addEventListener('click', () => {
    captureMode = 'gif';
    btnModeGif.classList.add('is-active');
    btnModeGif.setAttribute('aria-selected', 'true');
    if (btnModePhoto) {
      btnModePhoto.classList.remove('is-active');
      btnModePhoto.setAttribute('aria-selected', 'false');
    }
    captureButton.classList.add('mode-is-gif');
    const t = getT();
    if (saveButton) saveButton.textContent = t.saveGif || 'Save GIF';
    setMessage(t.modeGifHint || 'Modalità GIF 6s: tocca l\'otturatore per registrare', 3000);
  });
}

resetMarker.addEventListener('click', () => {
  const t = getT();
  marker = null;
  markerFoundPreviously = false;
  trackingHint.classList.remove('is-tracking');
  trackingText.textContent = t.trackingHintLooking;
  markerGuide.classList.remove('is-hidden');
  arContent.hidden = true;
  userOffsetX = 0;
  userOffsetY = 0;
  userScale = 1.0;
  userRotateZ = 0;
  userRotateX = 0;
  userRotateY = 0;
  is3dMode = false;
  if (btnToggle3d) {
    btnToggle3d.classList.remove('is-active');
    btnToggle3d.setAttribute('aria-pressed', 'false');
  }
  if (isPaused) {
    isPaused = false;
    if (btnTogglePause) {
      btnTogglePause.classList.remove('is-paused');
      btnTogglePause.setAttribute('aria-pressed', 'false');
      btnTogglePause.textContent = '⏸';
    }
    if (arContent) arContent.classList.remove('is-paused');
    if (originalGifSrc && arMediaPreview) arMediaPreview.src = originalGifSrc;
    if (is3dModel && ar3dModel) {
      ar3dModel.setAttribute('auto-rotate', '');
      if (typeof ar3dModel.play === 'function') ar3dModel.play();
    }
  }
  updateScaleDisplay();
  applyArTransform();
  setMessage(t.pointAgainHint);
});

// Gestione Trascinamento AR & Rotazione Spaziale 3D (Touch & Mouse Drag)
let isDragging = false;
let startPointerX = 0, startPointerY = 0;
let origOffsetX = 0, origOffsetY = 0;
let origRotateX = 0, origRotateY = 0;

arContent.addEventListener('pointerdown', (e) => {
  isDragging = true;
  startPointerX = e.clientX;
  startPointerY = e.clientY;
  origOffsetX = userOffsetX;
  origOffsetY = userOffsetY;
  origRotateX = userRotateX;
  origRotateY = userRotateY;
  arContent.classList.add('is-dragging');
  arContent.setPointerCapture(e.pointerId);
});

arContent.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - startPointerX;
  const dy = e.clientY - startPointerY;

  if (is3dMode) {
    // Modalità 3D: orientamento su asse Y (yaw orizzontale) e asse X (pitch verticale)
    userRotateY = Math.max(-85, Math.min(85, origRotateY + dx * 0.45));
    userRotateX = Math.max(-85, Math.min(85, origRotateX - dy * 0.45));
  } else {
    // Normale traslazione 2D
    userOffsetX = origOffsetX + dx;
    userOffsetY = origOffsetY + dy;
  }
  applyArTransform();
});

const stopDrag = (e) => {
  if (!isDragging) return;
  isDragging = false;
  arContent.classList.remove('is-dragging');
  try {
    arContent.releasePointerCapture(e.pointerId);
  } catch (err) {}
};

arContent.addEventListener('pointerup', stopDrag);
arContent.addEventListener('pointercancel', stopDrag);

// Pinch-to-zoom & Twist-to-rotate (2 dita su schermo touch: scala e rotazione 2D)
let initialPinchDist = 0;
let initialPinchScale = 1.0;
let initialTwistAngle = 0;
let initialRotateZ = 0;

window.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    const p1 = e.touches[0];
    const p2 = e.touches[1];
    initialPinchDist = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
    initialPinchScale = userScale;
    initialTwistAngle = Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX) * (180 / Math.PI);
    initialRotateZ = userRotateZ;
  }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && initialPinchDist > 0) {
    const p1 = e.touches[0];
    const p2 = e.touches[1];
    const currentDist = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
    const factor = currentDist / initialPinchDist;
    userScale = Math.min(3.5, Math.max(0.3, initialPinchScale * factor));
    updateScaleDisplay();

    const currentAngle = Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX) * (180 / Math.PI);
    const angleDiff = currentAngle - initialTwistAngle;
    userRotateZ = Math.round((initialRotateZ + angleDiff) % 360);

    applyArTransform();
  }
}, { passive: true });

window.addEventListener('touchend', (e) => {
  if (e.touches.length < 2) {
    initialPinchDist = 0;
  }
});

// Rotellina mouse per desktop
arContent.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY < 0 ? 0.12 : -0.12;
  userScale = Math.min(3.5, Math.max(0.3, userScale + delta));
  updateScaleDisplay();
  applyArTransform();
}, { passive: false });

// Controlli Zoom, Rotazione e Modalità 3D
if (btnZoomIn) {
  btnZoomIn.addEventListener('click', () => {
    userScale = Math.min(3.5, userScale + 0.15);
    updateScaleDisplay();
    applyArTransform();
  });
}

if (btnZoomOut) {
  btnZoomOut.addEventListener('click', () => {
    userScale = Math.max(0.3, userScale - 0.15);
    updateScaleDisplay();
    applyArTransform();
  });
}

if (btnRotLeft) {
  btnRotLeft.addEventListener('click', () => {
    userRotateZ = (userRotateZ - 15) % 360;
    applyArTransform();
  });
}

if (btnRotRight) {
  btnRotRight.addEventListener('click', () => {
    userRotateZ = (userRotateZ + 15) % 360;
    applyArTransform();
  });
}

if (btnToggle3d) {
  btnToggle3d.addEventListener('click', () => {
    is3dMode = !is3dMode;
    btnToggle3d.classList.toggle('is-active', is3dMode);
    btnToggle3d.setAttribute('aria-pressed', String(is3dMode));
    const t = getT();
    if (is3dMode) {
      setMessage(t.ar3dModeActive || 'Modalità 3D attiva: trascina per inclinare e ruotare nello spazio', 3500);
    } else {
      setMessage(t.arMoveHint || 'Trascina per spostare · Pizzica o usa i tasti per ruotare e ridimensionare', 3500);
    }
  });
}

if (btnTogglePause) {
  btnTogglePause.addEventListener('click', () => {
    isPaused = !isPaused;
    const t = getT();
    btnTogglePause.classList.toggle('is-paused', isPaused);
    btnTogglePause.setAttribute('aria-pressed', String(isPaused));
    btnTogglePause.textContent = isPaused ? '▶' : '⏸';
    const pauseTitle = isPaused ? (t.animResumed || 'Riprendi') : (t.animPaused || 'Pausa');
    btnTogglePause.setAttribute('title', pauseTitle);
    btnTogglePause.setAttribute('aria-label', pauseTitle);

    if (arContent) {
      arContent.classList.toggle('is-paused', isPaused);
    }

    if (mediaParam && mediaParam.toLowerCase().endsWith('.gif')) {
      if (isPaused) {
        const currentFrame = getCurrentGifFrame();
        if (currentFrame && arMediaPreview) {
          if (!originalGifSrc) originalGifSrc = arMediaPreview.src;
          arMediaPreview.src = currentFrame.canvas.toDataURL();
        }
      } else {
        if (originalGifSrc && arMediaPreview) {
          arMediaPreview.src = originalGifSrc;
        }
        gifStartTime = performance.now() - (decodedGifFrames[pausedFrameIndex]?.time || 0);
      }
    }

    if (is3dModel && ar3dModel) {
      if (isPaused) {
        ar3dModel.removeAttribute('auto-rotate');
        if (typeof ar3dModel.pause === 'function') ar3dModel.pause();
      } else {
        ar3dModel.setAttribute('auto-rotate', '');
        if (typeof ar3dModel.play === 'function') ar3dModel.play();
      }
    }

    const msg = isPaused ? (t.animPaused || 'Animazione in pausa') : (t.animResumed || 'Animazione ripresa');
    setMessage(msg, 2000);
  });
}

if (btnResetTransform) {
  btnResetTransform.addEventListener('click', () => {
    userOffsetX = 0;
    userOffsetY = 0;
    userScale = 1.0;
    userRotateZ = 0;
    userRotateX = 0;
    userRotateY = 0;
    is3dMode = false;
    if (btnToggle3d) {
      btnToggle3d.classList.remove('is-active');
      btnToggle3d.setAttribute('aria-pressed', 'false');
    }
    if (isPaused) {
      isPaused = false;
      if (btnTogglePause) {
        btnTogglePause.classList.remove('is-paused');
        btnTogglePause.setAttribute('aria-pressed', 'false');
        btnTogglePause.textContent = '⏸';
      }
      if (arContent) arContent.classList.remove('is-paused');
      if (originalGifSrc && arMediaPreview) arMediaPreview.src = originalGifSrc;
      if (is3dModel && ar3dModel) {
        ar3dModel.setAttribute('auto-rotate', '');
        if (typeof ar3dModel.play === 'function') ar3dModel.play();
      }
    }
    updateScaleDisplay();
    applyArTransform();
  });
}

window.addEventListener('pagehide', stopCamera);

// Flag button event listeners
langBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const lang = btn.getAttribute('data-lang');
    if (translations[lang]) {
      currentLang = lang;
      localStorage.setItem('ismar_lang', lang);
      updateTranslations();
    }
  });
});

// Initialize translations and live frame on load
updateTranslations();
updateLiveFrame();

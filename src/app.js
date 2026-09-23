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
const downloadButton = document.querySelector('#download-button');
const shareButton = document.querySelector('#share-button');
const downloadBtnText = document.querySelector('#download-btn-text');
const message = document.querySelector('#message');
const trackingHint = document.querySelector('#tracking-hint');
const trackingText = document.querySelector('#tracking-text');
const markerGuide = document.querySelector('#marker-guide');
const arContent = document.querySelector('#ar-content');
const resetMarker = document.querySelector('#reset-marker');
const langBtns = document.querySelectorAll('.lang-btn');
const progressBarFill = document.querySelector('#progress-bar-fill');
const progressStatus = document.querySelector('#progress-status');
const progressPercent = document.querySelector('#progress-percent');
const startBtnText = document.querySelector('#start-btn-text');

function setProgress(percent, text) {
  if (progressBarFill) {
    progressBarFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  }
  if (progressPercent) {
    progressPercent.textContent = `${Math.round(percent)}%`;
  }
  if (text && progressStatus) {
    progressStatus.textContent = text;
  }
}

let stream;
let facingMode = 'environment';
const FRAME_STYLES = ['classic', 'minimal', 'puglia', 'cyber', 'none'];
let currentFrameIndex = 0;
let isFramed = true;
let currentPhotoBlob;
let currentPhotoDataUrl;
let animationId;
let detector;
let marker = null;
let markerFoundPreviously = false;
let isPinned = false;

const logo = new Image();
logo.src = './GraphicResources/Banners_&_logo/Logo_&_wordmark.svg';
const logoEmblem = new Image();
logoEmblem.src = './GraphicResources/Banners_&_logo/Logo.svg';
const roosterImg = new Image();
roosterImg.src = './GraphicResources/Website_materials/rooster.svg';

const arMediaPreview = document.querySelector('#ar-media-preview');
const btnTogglePause = document.querySelector('#btn-toggle-pause');
const liveFrameOverlay = document.querySelector('#live-frame-overlay');
const liveFrameWatermark = document.querySelector('#live-frame-watermark');
const frameSwatch = document.querySelector('#frame-swatch');
const frameToggleText = document.querySelector('#frame-toggle-text');

function updateLiveFrame() {
  const style = FRAME_STYLES[currentFrameIndex] || 'classic';
  isFramed = style !== 'none';
  const t = getT();

  if (liveFrameOverlay) {
    liveFrameOverlay.classList.remove('frame-style-classic', 'frame-style-minimal', 'frame-style-puglia', 'frame-style-cyber');
    if (isFramed) {
      liveFrameOverlay.classList.remove('is-hidden');
      liveFrameOverlay.classList.add(`frame-style-${style}`);
    } else {
      liveFrameOverlay.classList.add('is-hidden');
    }
  }

  document.body.classList.toggle('frame-active', isFramed);

  if (frameToggle) {
    frameToggle.classList.toggle('is-active', isFramed);
    frameToggle.setAttribute('aria-pressed', String(isFramed));
  }

  if (frameSwatch) {
    frameSwatch.className = `frame-swatch swatch-${style}`;
  }

  if (frameToggleText) {
    const labelKey = `frame${style.charAt(0).toUpperCase() + style.slice(1)}`;
    frameToggleText.textContent = t[labelKey] || style;
  }

  if (liveFrameWatermark) {
    liveFrameWatermark.textContent = t.watermark || 'XR venue experience · #ISMAR2026';
  }
}

const btnModePhoto = document.querySelector('#btn-mode-photo');
const btnModeGif = document.querySelector('#btn-mode-gif');
const shutterCountdown = document.querySelector('#shutter-countdown');
const shutterRingProgress = document.querySelector('#shutter-ring-progress');

const params = new URLSearchParams(window.location.search);
const contentKey = params.get('content') || 'welcome';
const DEFAULT_MEDIA = './media/images/Logo_Animated.gif';
const mediaParam = params.get('media') || DEFAULT_MEDIA;

let userOffsetX = 0;
let userOffsetY = 0;
let userScale = 1.0;
let userRotateZ = 0;
let userRotateX = 0;
let userRotateY = 0;
let baseAnchorX = window.innerWidth / 2;
let baseAnchorY = window.innerHeight * 0.46;
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

let isGifLoading = false;

async function loadGifFrames(url) {
  if (isGifLoading || decodedGifFrames.length > 0) return;
  isGifLoading = true;
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
  } finally {
    isGifLoading = false;
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

function applyArTransform() {
  const posX = baseAnchorX + userOffsetX;
  const posY = baseAnchorY + userOffsetY;
  arContent.style.left = `${posX}px`;
  arContent.style.top = `${posY}px`;

  const totalAngleZ = baseAngle + userRotateZ;
  arContent.style.transform = `translate(-50%, -50%) rotateZ(${totalAngleZ}deg) scale(${userScale})`;
}

if (mediaParam) {
  const ext = mediaParam.split('.').pop().toLowerCase();
  if (arContent) {
    arContent.classList.add('is-media-only');
  }
  if (arMediaPreview) {
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
    // Schedule background frame decoding without blocking camera initialization
    setTimeout(() => {
      loadGifFrames(mediaParam);
    }, 1800);
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
  if (toolsLabel) {
    toolsLabel.textContent = t.btnAdjustTools || 'Adjust';
  }
  if (downloadBtnText) {
    downloadBtnText.textContent = (captureMode === 'gif') ? (t.saveGif || 'Save GIF') : (t.downloadAction || 'Save');
  }

  langBtns.forEach((btn) => {
    const isActive = btn.getAttribute('data-lang') === currentLang;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  if (liveFrameWatermark) {
    liveFrameWatermark.textContent = t.watermark || 'XR venue experience · #ISMAR2026';
  }

  if (frameToggleText) {
    const style = FRAME_STYLES[currentFrameIndex] || 'classic';
    const labelKey = `frame${style.charAt(0).toUpperCase() + style.slice(1)}`;
    frameToggleText.textContent = t[labelKey] || style;
  }

  if (facingMode === 'user') {
    trackingText.textContent = t.selfieModeHint || 'Selfie mode: pose with AR!';
  } else if (isPinned) {
    trackingText.textContent = t.trackingHintLocked || 'AR Ready · Move & Pose!';
  } else if (marker) {
    trackingText.textContent = t.trackingHintFound;
  } else {
    trackingText.textContent = t.trackingHintLooking;
  }

  if (progressStatus && !stream) {
    progressStatus.textContent = t.loadingStatus || 'Starting AR camera...';
  }
  if (startBtnText) {
    startBtnText.textContent = t.startButton || 'Open AR camera';
  }
}

let isStartingCamera = false;

async function startCamera(fromUserGesture = false) {
  if (stream) return;
  if (isStartingCamera && !fromUserGesture) return;
  isStartingCamera = true;
  const t = getT();

  if (!navigator.mediaDevices?.getUserMedia) {
    setMessage(t.cameraUnsupported);
    setProgress(0, t.cameraUnsupported);
    isStartingCamera = false;
    return;
  }

  try {
    setProgress(35, t.loadingStatus || 'Avvio fotocamera AR...');
    stopCamera();

    // Setup video element attributes required for iOS Safari & Android inline autoplay
    camera.muted = true;
    camera.playsInline = true;
    camera.setAttribute('playsinline', '');
    camera.setAttribute('webkit-playsinline', '');

    // Robust camera constraints compatible with all mobile cameras
    const constraints = {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    const streamPromise = navigator.mediaDevices.getUserMedia(constraints);
    if (!fromUserGesture) {
      // If auto-starting on page load, timeout in 1.8s so we never stay stuck on "Starting AR camera"
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AutoStartTimeout')), 1800)
      );
      stream = await Promise.race([streamPromise, timeoutPromise]);
    } else {
      stream = await streamPromise;
    }

    setProgress(75, t.loadingStatus || 'Avvio fotocamera AR...');
    camera.srcObject = stream;

    try {
      await camera.play();
    } catch (playErr) {
      console.warn('camera.play() error / awaiting user gesture:', playErr);
    }

    setProgress(100, t.loadingReady || 'Pronto!');

    document.body.classList.add('camera-active');
    cameraUi.hidden = false;
    updateLiveFrame();

    // AR content is immediately active, centered, and pinned in the scene
    isPinned = true;
    arContent.hidden = false;
    markerGuide.classList.add('is-hidden');

    if (facingMode === 'user') {
      document.body.classList.add('selfie-mode');
      trackingHint.classList.add('is-selfie');
      trackingHint.classList.remove('is-tracking', 'is-locked');
      trackingText.textContent = t.selfieModeHint || 'Modalità Selfie: elemento pronto!';
      baseAnchorX = window.innerWidth * 0.72;
      baseAnchorY = window.innerHeight * 0.32;
    } else {
      document.body.classList.remove('selfie-mode');
      trackingHint.classList.remove('is-selfie');
      trackingHint.classList.add('is-tracking', 'is-locked');
      trackingText.textContent = t.trackingHintLocked || 'AR Pronto · Mettiti in posa!';
      baseAnchorX = window.innerWidth / 2;
      baseAnchorY = window.innerHeight * 0.46;
    }
    baseAngle = 0;
    applyArTransform();

    // Smooth fade out of the loading screen
    if (startScreen) {
      startScreen.classList.add('is-fading-out');
      setTimeout(() => {
        startScreen.hidden = true;
      }, 400);
    }

    setMessage(t.contentHint || 'Esperienza AR attiva! Trascina per posizionare e scatta la foto.', 4000);
    initialiseDetector();
  } catch (error) {
    console.warn('Camera launch waiting for user gesture or permission:', error?.name || error);
    setProgress(50, t.loadingTapHint || 'Tocca per avviare la fotocamera');
    if (startButton) {
      startButton.classList.remove('is-hidden');
    }
  } finally {
    isStartingCamera = false;
  }
}

function stopCamera() {
  cancelAnimationFrame(animationId);
  stream?.getTracks().forEach((track) => track.stop());
  stream = undefined;
  document.body.classList.remove('camera-active');
}

function initialiseDetector() {
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
}

async function scanForMarker() {
  const t = getT();
  if (!stream || !detector || camera.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    animationId = requestAnimationFrame(scanForMarker);
    return;
  }
  try {
    if (facingMode === 'user') {
      animationId = requestAnimationFrame(scanForMarker);
      return;
    }

    const codes = await detector.detect(camera);
    if (codes[0]?.cornerPoints?.length) {
      marker = codes[0].cornerPoints;
      // If user hasn't manually moved the AR item, align with physical marker
      if (userOffsetX === 0 && userOffsetY === 0) {
        positionContent(marker);
      }
      isPinned = true;
      arContent.hidden = false;
      markerGuide.classList.add('is-hidden');
      trackingHint.classList.add('is-tracking', 'is-locked');
      trackingText.textContent = t.trackingHintLocked || 'AR Pronto · Mettiti in posa!';
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
  baseAnchorY = window.innerHeight * 0.46;
  baseAngle = 0;
  applyArTransform();
  markerGuide.classList.remove('is-hidden');
}

function drawArCard(context, width, height) {
  const rect = camera.getBoundingClientRect();
  const screenW = rect.width || window.innerWidth;
  const screenH = rect.height || window.innerHeight;
  const currentScreenX = baseAnchorX + userOffsetX;
  const currentScreenY = baseAnchorY + userOffsetY;
  const canvasTargetX = (currentScreenX / screenW) * width;
  const canvasTargetY = (currentScreenY / screenH) * height;
  const totalAngleZ = baseAngle + userRotateZ;
  const scale = Math.min(width / 390, height / 844) * userScale;

  if (mediaParam && mediaLoaded) {
    const activeFrame = getCurrentGifFrame();
    const sourceDrawable = activeFrame ? activeFrame.canvas : (mediaImage?.complete && mediaImage?.naturalWidth ? mediaImage : null);
    if (sourceDrawable) {
      const mediaSize = Math.min(width * 0.78, height * 0.52) * userScale;
      context.save();
      context.translate(canvasTargetX, canvasTargetY);
      context.rotate((totalAngleZ * Math.PI) / 180);
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
  const style = FRAME_STYLES[currentFrameIndex] || 'classic';
  if (style === 'none') return;

  if (style === 'classic') {
    drawFrameClassic(context, width, height);
  } else if (style === 'minimal') {
    drawFrameMinimal(context, width, height);
  } else if (style === 'puglia') {
    drawFramePuglia(context, width, height);
  } else if (style === 'cyber') {
    drawFrameCyber(context, width, height);
  }
}

function drawFrameClassic(context, width, height) {
  const t = getT();
  const edge = Math.max(14, width * .027);
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

function drawFrameMinimal(context, width, height) {
  const edge = Math.max(14, width * .035);
  const bLen = Math.max(26, width * .075);
  const bThick = Math.max(3.5, width * .007);
  context.save();

  // 4 corner brackets
  context.strokeStyle = '#ffe000';
  context.lineWidth = bThick;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  // Top-left
  context.beginPath();
  context.moveTo(edge, edge + bLen);
  context.lineTo(edge, edge);
  context.lineTo(edge + bLen, edge);
  context.stroke();

  // Top-right
  context.beginPath();
  context.moveTo(width - edge - bLen, edge);
  context.lineTo(width - edge, edge);
  context.lineTo(width - edge, edge + bLen);
  context.stroke();

  // Bottom-left
  context.beginPath();
  context.moveTo(edge, height - edge - bLen);
  context.lineTo(edge, height - edge);
  context.lineTo(edge + bLen, height - edge);
  context.stroke();

  // Bottom-right
  context.beginPath();
  context.moveTo(width - edge - bLen, height - edge);
  context.lineTo(width - edge, height - edge);
  context.lineTo(width - edge, height - edge - bLen);
  context.stroke();

  // Top-left badge pill
  const pillW = Math.max(140, width * .34);
  const pillH = Math.max(28, width * .065);
  context.fillStyle = 'rgba(61, 18, 9, 0.88)';
  roundRect(context, edge + 8, edge + 8, pillW, pillH, pillH / 2);
  context.fill();
  context.strokeStyle = '#ffe000';
  context.lineWidth = 1.5;
  context.stroke();

  if (logoEmblem.complete && logoEmblem.naturalWidth) {
    const iconH = pillH * 0.72;
    const iconW = (iconH / logoEmblem.naturalHeight) * logoEmblem.naturalWidth;
    context.drawImage(logoEmblem, edge + 14, edge + 8 + (pillH - iconH) / 2, iconW, iconH);
  }

  context.fillStyle = '#ffffff';
  context.textAlign = 'left';
  context.font = `700 ${Math.max(10, width * .021)}px Poppins`;
  context.fillText('IEEE ISMAR 2026 · BARI', edge + 14 + pillH * 0.8, edge + 8 + pillH * 0.65);

  // Bottom-right coordinate tag
  context.textAlign = 'right';
  context.fillStyle = '#ffe000';
  context.font = `600 ${Math.max(10, width * .02)}px Poppins`;
  context.shadowColor = 'rgba(0, 0, 0, 0.8)';
  context.shadowBlur = 4;
  context.fillText('41.1171° N, 16.8719° E · XR VENUE', width - edge - 8, height - edge - 12);
  context.restore();
}

function drawFramePuglia(context, width, height) {
  context.save();
  const stripeH = Math.max(5, height * 0.009);

  // Top Mediterranean 4-color stripe
  const segW = width / 4;
  context.fillStyle = '#ea5454';
  context.fillRect(0, 0, segW, stripeH);
  context.fillStyle = '#ffaa00';
  context.fillRect(segW, 0, segW, stripeH);
  context.fillStyle = '#ffe000';
  context.fillRect(segW * 2, 0, segW, stripeH);
  context.fillStyle = '#008bf2';
  context.fillRect(segW * 3, 0, segW, stripeH);

  // Bottom warm terracotta banner
  const barH = height * 0.12;
  context.fillStyle = '#3d1209ee';
  context.fillRect(0, height - barH, width, barH);
  context.fillStyle = '#ffaa00';
  context.fillRect(0, height - barH, width, 3);

  // Rooster on the right
  if (roosterImg.complete && roosterImg.naturalWidth) {
    const rH = barH * 0.82;
    const rW = (rH / roosterImg.naturalHeight) * roosterImg.naturalWidth;
    context.drawImage(roosterImg, width - rW - width * 0.035, height - barH + (barH - rH) / 2, rW, rH);
  }

  // Text on the left
  context.textAlign = 'left';
  context.fillStyle = '#ffaa00';
  context.font = `800 ${Math.max(9, width * .019)}px Poppins`;
  context.fillText('WELCOME TO PUGLIA', width * 0.04, height - barH * 0.58);

  context.fillStyle = '#ffffff';
  context.font = `700 ${Math.max(14, width * .03)}px "Tsukimi Rounded", Poppins`;
  context.fillText('ISMAR 2026 · BARI', width * 0.04, height - barH * 0.22);
  context.restore();
}

function drawFrameCyber(context, width, height) {
  const edge = Math.max(12, width * .028);
  const bLen = Math.max(32, width * .085);
  const bThick = Math.max(3, width * .006);
  context.save();

  // Cyber corner brackets with glow
  context.strokeStyle = '#00e5ff';
  context.shadowColor = 'rgba(0, 229, 255, 0.85)';
  context.shadowBlur = 8;
  context.lineWidth = bThick;

  // TL
  context.beginPath();
  context.moveTo(edge, edge + bLen);
  context.lineTo(edge, edge);
  context.lineTo(edge + bLen, edge);
  context.stroke();

  // TR
  context.beginPath();
  context.moveTo(width - edge - bLen, edge);
  context.lineTo(width - edge, edge);
  context.lineTo(width - edge, edge + bLen);
  context.stroke();

  // BL
  context.beginPath();
  context.moveTo(edge, height - edge - bLen);
  context.lineTo(edge, height - edge);
  context.lineTo(edge + bLen, height - edge);
  context.stroke();

  // BR
  context.beginPath();
  context.moveTo(width - edge - bLen, height - edge);
  context.lineTo(width - edge, height - edge);
  context.lineTo(width - edge, height - edge - bLen);
  context.stroke();

  // Corner yellow tick dots
  context.fillStyle = '#ffe000';
  context.fillRect(edge - 2, edge - 2, 5, 5);
  context.fillRect(width - edge - 3, edge - 2, 5, 5);
  context.fillRect(edge - 2, height - edge - 3, 5, 5);
  context.fillRect(width - edge - 3, height - edge - 3, 5, 5);

  // Top HUD readout
  context.font = `700 ${Math.max(10, width * .022)}px monospace`;
  context.textAlign = 'left';
  context.fillStyle = '#ff3344';
  context.fillText('● AR TRACKING [ACTIVE]', edge + 14, edge + 22);

  context.textAlign = 'right';
  context.fillStyle = '#ffe000';
  context.fillText('TARGET: ISMAR 2026', width - edge - 14, edge + 22);

  // Bottom HUD readout
  context.textAlign = 'left';
  context.fillStyle = '#00e5ff';
  context.font = `700 ${Math.max(9, width * .019)}px monospace`;
  context.fillText('41°07\'01"N 16°52\'18"E // BARI', edge + 14, height - edge - 16);

  context.textAlign = 'right';
  context.fillStyle = '#ffe000';
  context.fillText('XR-HUD v2.6 · #ISMAR2026', width - edge - 14, height - edge - 16);
  context.restore();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.closePath();
}

let originalGifSrc = null;

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

    if (facingMode === 'user') {
      offCtx.save();
      offCtx.scale(-1, 1);
      offCtx.drawImage(camera, -targetW, 0, targetW, targetH);
      offCtx.restore();
    } else {
      offCtx.drawImage(camera, 0, 0, targetW, targetH);
    }
    drawArCard(offCtx, targetW, targetH);
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
  if (facingMode === 'user') {
    context.save();
    context.scale(-1, 1);
    context.drawImage(camera, -width, 0, width, height);
    context.restore();
  } else {
    context.drawImage(camera, 0, 0, width, height);
  }

  drawArCard(context, width, height);
  if (isFramed) drawFrame(context, width, height);

  currentPhotoDataUrl = canvas.toDataURL('image/jpeg', .92);
  photoResult.src = currentPhotoDataUrl;
  currentPhotoBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .92));
  if (!currentPhotoBlob) {
    currentPhotoBlob = await (await fetch(currentPhotoDataUrl)).blob();
  }
  photoPreview.hidden = false;
}

// Download action (Save directly to storage)
if (downloadButton) {
  downloadButton.addEventListener('click', () => {
    const t = getT();
    if (captureMode === 'gif') {
      if (!currentGifBlob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(currentGifBlob);
      link.download = 'ismar-2026-ar-animation.gif';
      link.click();
      URL.revokeObjectURL(link.href);
    } else {
      if (!currentPhotoBlob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(currentPhotoBlob);
      link.download = 'ismar-2026-ar-photo.jpg';
      link.click();
      URL.revokeObjectURL(link.href);
    }
    setMessage(t.savedNotification || 'Salvato!', 2500);
  });
}

// Share action (Web Share API with graceful fallback)
if (shareButton) {
  shareButton.addEventListener('click', async () => {
    const t = getT();
    try {
      if (captureMode === 'gif') {
        if (!currentGifBlob) return;
        const file = new File([currentGifBlob], 'ismar-2026-ar-animation.gif', { type: 'image/gif' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: t.shareTitle || 'ISMAR 2026 AR Animation',
            text: '#ISMAR2026 XR venue experience',
            url: window.location.href
          });
          return;
        }
      } else {
        if (!currentPhotoBlob) return;
        const file = new File([currentPhotoBlob], 'ismar-2026-ar-photo.jpg', { type: 'image/jpeg' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: t.shareTitle || 'ISMAR 2026 AR',
            text: '#ISMAR2026 XR venue experience',
            url: window.location.href
          });
          return;
        }
      }

      if (navigator.share) {
        await navigator.share({
          title: t.shareTitle || 'ISMAR 2026 AR',
          text: '#ISMAR2026 XR venue experience',
          url: window.location.href
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setMessage(t.linkCopied || 'Link copiato negli appunti!', 3000);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Share error:', err);
      }
    }
  });
}

// Event Listeners
startButton.addEventListener('click', (e) => {
  e.stopPropagation();
  startCamera(true);
});
switchCameraButton.addEventListener('click', () => {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  startCamera(true);
});

// Interactive Frame Selector Drawer Toggle
// Direct 1-tap Frame Cycling
if (frameToggle) {
  frameToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    currentFrameIndex = (currentFrameIndex + 1) % FRAME_STYLES.length;
    updateLiveFrame();
  });
}

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
    if (downloadBtnText) downloadBtnText.textContent = t.downloadAction || 'Save';
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
    if (downloadBtnText) downloadBtnText.textContent = t.saveGif || 'Save GIF';
    setMessage(t.modeGifHint || 'Modalità GIF 6s: tocca l\'otturatore per registrare', 3000);
  });
}

resetMarker.addEventListener('click', () => {
  const t = getT();
  userOffsetX = 0;
  userOffsetY = 0;
  userScale = 1.0;
  userRotateZ = 0;
  userRotateX = 0;
  userRotateY = 0;
  if (isPaused) {
    isPaused = false;
    if (btnTogglePause) {
      btnTogglePause.classList.remove('is-paused');
      btnTogglePause.setAttribute('aria-pressed', 'false');
      btnTogglePause.textContent = '⏸';
    }
    if (arContent) arContent.classList.remove('is-paused');
    if (originalGifSrc && arMediaPreview) arMediaPreview.src = originalGifSrc;
  }
  if (facingMode === 'user') {
    baseAnchorX = window.innerWidth * 0.72;
    baseAnchorY = window.innerHeight * 0.32;
  } else {
    baseAnchorX = window.innerWidth / 2;
    baseAnchorY = window.innerHeight * 0.46;
  }
  baseAngle = 0;
  isPinned = true;
  arContent.hidden = false;
  markerGuide.classList.add('is-hidden');
  applyArTransform();
  setMessage(t.pointAgainHint || 'Elemento AR riposizionato al centro.', 2500);
});

// Gestione Trascinamento AR (Touch & Mouse Drag)
let isDragging = false;
let startPointerX = 0, startPointerY = 0;
let origOffsetX = 0, origOffsetY = 0;

arContent.addEventListener('pointerdown', (e) => {
  isDragging = true;
  startPointerX = e.clientX;
  startPointerY = e.clientY;
  origOffsetX = userOffsetX;
  origOffsetY = userOffsetY;
  arContent.classList.add('is-dragging');
  arContent.setPointerCapture(e.pointerId);
});

arContent.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - startPointerX;
  const dy = e.clientY - startPointerY;
  userOffsetX = origOffsetX + dx;
  userOffsetY = origOffsetY + dy;
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
  applyArTransform();
}, { passive: false });

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

    const msg = isPaused ? (t.animPaused || 'Animazione in pausa') : (t.animResumed || 'Animazione ripresa');
    setMessage(msg, 2000);
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

// Direct camera launch: auto-start if permissions already granted on this device
if (navigator.mediaDevices?.getUserMedia) {
  startCamera(false).catch(() => {
    // If browser requires an explicit user gesture (e.g. first visit),
    // startScreen and startButton remain ready for an instant tap to launch.
  });
}

if (startScreen) {
  startScreen.addEventListener('click', (e) => {
    if (!e.target.closest('.lang-bar')) {
      startCamera(true);
    }
  });
}

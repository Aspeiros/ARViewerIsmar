import { translations } from './translations.js';

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
const logo = new Image();
logo.src = './GraphicResources/Banners_&_logo/Logo_&_wordmark.svg';

const arOrb = document.querySelector('#ar-orb');
const arMediaPreview = document.querySelector('#ar-media-preview');

const params = new URLSearchParams(window.location.search);
const contentKey = params.get('content') || 'welcome';
const mediaParam = params.get('media');

let mediaImage = null;
let mediaLoaded = false;

if (mediaParam) {
  const ext = mediaParam.split('.').pop().toLowerCase();
  if (['gif', 'png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) {
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

function setMessage(text) {
  message.textContent = text;
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

  langBtns.forEach((btn) => {
    const isActive = btn.getAttribute('data-lang') === currentLang;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

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
      setMessage(t.photoSuccessHint);
    } else if (!marker) {
      arContent.hidden = true;
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
  const x = offsetX + (center.x / points.length) * scale;
  const y = offsetY + (center.y / points.length) * scale;
  const angle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x) * (180 / Math.PI);
  arContent.style.left = `${x}px`;
  arContent.style.top = `${y}px`;
  arContent.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
}

function showFallbackMarker() {
  marker = null;
  arContent.hidden = false;
  arContent.style.left = '50%';
  arContent.style.top = '48%';
  arContent.style.transform = 'translate(-50%, -100%)';
  markerGuide.classList.remove('is-hidden');
}

function drawArCard(context, width, height) {
  const currentContent = getCurrentContent();
  const x = width * 0.5;
  const y = height * 0.32;
  const scale = Math.min(width / 390, height / 844);
  const cardWidth = 292 * scale;
  const cardHeight = 104 * scale;

  context.save();
  context.translate(x, y);
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

  if (mediaLoaded && mediaImage?.complete && mediaImage?.naturalWidth) {
    context.save();
    roundRect(context, -cardWidth / 2 + 15 * scale, -cardHeight + 22 * scale, 53 * scale, 53 * scale, 15 * scale);
    context.clip();
    context.fillStyle = '#ffffff';
    context.fillRect(-cardWidth / 2 + 15 * scale, -cardHeight + 22 * scale, 53 * scale, 53 * scale);
    context.drawImage(mediaImage, -cardWidth / 2 + 15 * scale, -cardHeight + 22 * scale, 53 * scale, 53 * scale);
    context.restore();

    context.strokeStyle = '#3d1209';
    context.lineWidth = 2 * scale;
    roundRect(context, -cardWidth / 2 + 15 * scale, -cardHeight + 22 * scale, 53 * scale, 53 * scale, 15 * scale);
    context.stroke();
  } else {
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
  }

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

async function savePhoto() {
  if (!currentPhotoBlob) return;
  const t = getT();
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
});
captureButton.addEventListener('click', capturePhoto);
retakeButton.addEventListener('click', () => {
  photoPreview.hidden = true;
});
saveButton.addEventListener('click', savePhoto);
resetMarker.addEventListener('click', () => {
  const t = getT();
  marker = null;
  trackingHint.classList.remove('is-tracking');
  trackingText.textContent = t.trackingHintLooking;
  markerGuide.classList.remove('is-hidden');
  arContent.hidden = true;
  setMessage(t.pointAgainHint);
});
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

// Initialize translations on load
updateTranslations();

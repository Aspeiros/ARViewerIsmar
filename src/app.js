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

const content = {
  welcome: { title: 'Welcome to Bari', description: 'La tua esperienza XR inizia qui.' },
  food: { title: 'Taste Puglia', description: 'Un viaggio aumentato tra sapori e tradizioni.' },
  venue: { title: 'Explore the venue', description: 'Guarda oltre il poster: questo è solo l’inizio.' },
};

const params = new URLSearchParams(window.location.search);
const chosenContent = content[params.get('content')] || content.welcome;
document.querySelector('#content-title').textContent = chosenContent.title;
document.querySelector('#content-description').textContent = chosenContent.description;

function setMessage(text) {
  message.textContent = text;
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setMessage('Questo browser non supporta l’accesso alla fotocamera. Apri il link in Safari o Chrome.');
    return;
  }
  try {
    stopCamera();
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    camera.srcObject = stream;
    await camera.play();
    startScreen.hidden = true;
    cameraUi.hidden = false;
    setMessage('Inquadra il QR/marker per attivare il contenuto.');
    initialiseDetector();
  } catch (error) {
    console.error(error);
    setMessage('Per proseguire, autorizza l’uso della fotocamera nelle impostazioni del browser.');
  }
}

function stopCamera() {
  cancelAnimationFrame(animationId);
  stream?.getTracks().forEach((track) => track.stop());
  stream = undefined;
}

function initialiseDetector() {
  if ('BarcodeDetector' in window) {
    try {
      detector = new BarcodeDetector({ formats: ['qr_code'] });
      scanForMarker();
      return;
    } catch (error) { console.warn('QR detector non disponibile', error); }
  }
  detector = null;
  showFallbackMarker();
  setMessage('Tieni il marker al centro dell’inquadratura.');
}

async function scanForMarker() {
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
      trackingText.textContent = 'Marker riconosciuto';
      setMessage('Contenuto AR attivo. Tocca il pulsante bianco per la foto.');
    } else if (!marker) {
      arContent.hidden = true;
    }
  } catch (error) { console.warn('Errore lettura marker', error); }
  animationId = requestAnimationFrame(scanForMarker);
}

function positionContent(points) {
  const rect = camera.getBoundingClientRect();
  const videoRatio = camera.videoWidth / camera.videoHeight;
  const displayRatio = rect.width / rect.height;
  let scale, offsetX = 0, offsetY = 0;
  if (videoRatio > displayRatio) { scale = rect.height / camera.videoHeight; offsetX = (rect.width - camera.videoWidth * scale) / 2; }
  else { scale = rect.width / camera.videoWidth; offsetY = (rect.height - camera.videoHeight * scale) / 2; }
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
  const x = width * 0.5;
  const y = height * 0.32;
  const scale = Math.min(width / 390, height / 844);
  const cardWidth = 292 * scale;
  const cardHeight = 104 * scale;
  context.save();
  context.translate(x, y);
  context.fillStyle = '#3d1209aa';
  roundRect(context, -cardWidth / 2 + 5 * scale, -cardHeight + 7 * scale, cardWidth, cardHeight, 18 * scale); context.fill();
  context.fillStyle = '#f4e8d4ee';
  roundRect(context, -cardWidth / 2, -cardHeight, cardWidth, cardHeight, 18 * scale); context.fill();
  context.strokeStyle = '#ffffff'; context.lineWidth = 2 * scale; roundRect(context, -cardWidth / 2, -cardHeight, cardWidth, cardHeight, 18 * scale); context.stroke();
  context.fillStyle = '#ffe000'; roundRect(context, -cardWidth / 2 + 15 * scale, -cardHeight + 22 * scale, 53 * scale, 53 * scale, 15 * scale); context.fill();
  context.strokeStyle = '#3d1209'; context.lineWidth = 2 * scale; context.stroke();
  context.fillStyle = '#3d1209'; context.font = `700 ${17 * scale}px Poppins`; context.textAlign = 'center'; context.fillText('AR', -cardWidth / 2 + 41.5 * scale, -cardHeight + 57 * scale);
  context.textAlign = 'left'; context.fillStyle = '#008bf2'; context.font = `700 ${8 * scale}px Poppins`; context.fillText('ISMAR 2026', -cardWidth / 2 + 81 * scale, -cardHeight + 31 * scale);
  context.fillStyle = '#3d1209'; context.font = `700 ${18 * scale}px "Tsukimi Rounded", Poppins`; context.fillText(chosenContent.title, -cardWidth / 2 + 81 * scale, -cardHeight + 55 * scale);
  context.font = `${9 * scale}px Poppins`; context.fillText(chosenContent.description, -cardWidth / 2 + 81 * scale, -cardHeight + 74 * scale);
  context.restore();
}

function drawFrame(context, width, height) {
  const edge = Math.max(15, width * .027);
  context.save();
  context.strokeStyle = '#ffe000'; context.lineWidth = edge; context.strokeRect(edge / 2, edge / 2, width - edge, height - edge);
  context.strokeStyle = '#008bf2'; context.lineWidth = edge * .42; context.strokeRect(edge * 1.4, edge * 1.4, width - edge * 2.8, height - edge * 2.8);
  context.fillStyle = '#3d1209cc'; context.fillRect(0, height - height * .12, width, height * .12);
  if (logo.complete && logo.naturalWidth) context.drawImage(logo, edge * 2.2, height - height * .095, width * .27, (width * .27 / logo.naturalWidth) * logo.naturalHeight);
  context.fillStyle = '#ffffff'; context.textAlign = 'right'; context.font = `600 ${Math.max(13, width * .024)}px Poppins`; context.fillText('XR venue experience · #ISMAR2026', width - edge * 2.2, height - height * .045);
  context.restore();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath(); context.roundRect(x, y, width, height, radius); context.closePath();
}

async function capturePhoto() {
  if (!camera.videoWidth || camera.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    setMessage('La fotocamera si sta ancora avviando: attendi un istante e riprova.');
    return;
  }
  const width = camera.videoWidth;
  const height = camera.videoHeight;
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(camera, 0, 0, width, height);
  drawArCard(context, width, height);
  if (isFramed) drawFrame(context, width, height);
  // I data URL sono più affidabili dei blob URL per l'anteprima su alcuni browser Android.
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
  const file = new File([currentPhotoBlob], 'ismar-2026-ar-photo.jpg', { type: 'image/jpeg' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'ISMAR 2026 AR' });
      return;
    }
  } catch (error) { if (error.name === 'AbortError') return; }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(currentPhotoBlob);
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(link.href);
}

startButton.addEventListener('click', startCamera);
switchCameraButton.addEventListener('click', () => { facingMode = facingMode === 'environment' ? 'user' : 'environment'; startCamera(); });
frameToggle.addEventListener('click', () => { isFramed = !isFramed; frameToggle.classList.toggle('is-active', isFramed); frameToggle.setAttribute('aria-pressed', String(isFramed)); });
captureButton.addEventListener('click', capturePhoto);
retakeButton.addEventListener('click', () => { photoPreview.hidden = true; });
saveButton.addEventListener('click', savePhoto);
resetMarker.addEventListener('click', () => { marker = null; trackingHint.classList.remove('is-tracking'); trackingText.textContent = 'Cerca il marker ISMAR'; markerGuide.classList.remove('is-hidden'); arContent.hidden = true; setMessage('Punta di nuovo il QR/marker.'); });
window.addEventListener('pagehide', stopCamera);

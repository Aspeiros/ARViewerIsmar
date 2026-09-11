import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';

// Base URL di GitHub Pages del progetto
const BASE_URL = process.env.BASE_URL || 'https://aspeiros.github.io/ARViewerIsmar/';
const MEDIA_DIR = path.resolve('media');
const QR_OUTPUT_DIR = path.resolve('media', 'qrcodes');

if (!fs.existsSync(QR_OUTPUT_DIR)) {
  fs.mkdirSync(QR_OUTPUT_DIR, { recursive: true });
}

/**
 * Trova ricorsivamente tutti i file multimediali in una cartella
 */
function getFilesRecursively(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    // Ignora la cartella qrcodes, markers, file nascosti o file di testo
    if (entry.isDirectory()) {
      if (entry.name !== 'qrcodes' && entry.name !== 'markers') {
        files.push(...getFilesRecursively(fullPath));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.gif', '.png', '.jpg', '.jpeg', '.webp', '.glb', '.gltf', '.mp4', '.webm', '.mp3'].includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

/**
 * Genera il QR code per un file specifico
 */
async function generateQRForFile(filePath) {
  const relativeFromRoot = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  const baseName = path.basename(filePath, path.extname(filePath));
  const subFolder = path.basename(path.dirname(filePath));
  
  // URL dell'esperienza WebAR con il parametro del media
  const targetUrl = `${BASE_URL}?media=${encodeURI(relativeFromRoot)}`;
  
  // Nomi file output (PNG ad alta risoluzione e vettoriale SVG per la stampa)
  const safeName = `qr_${subFolder}_${baseName}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const pngPath = path.join(QR_OUTPUT_DIR, `${safeName}.png`);
  const svgPath = path.join(QR_OUTPUT_DIR, `${safeName}.svg`);

  // Opzioni QR code brandizzato ISMAR 2026 (marrone scuro su bianco, livello di correzione High H)
  const qrOptions = {
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: '#3D1209', // Marrone ISMAR
      light: '#FFFFFF' // Sfondo bianco puro per massima leggibilità della fotocamera
    }
  };

  // Genera PNG ad alta risoluzione (1024x1024) per stampa tipografica
  await QRCode.toFile(pngPath, targetUrl, {
    ...qrOptions,
    width: 1024
  });

  // Genera anche SVG vettoriale (scalabile a qualsiasi dimensione senza sgranare)
  await QRCode.toFile(svgPath, targetUrl, {
    ...qrOptions,
    type: 'svg'
  });

  return {
    file: relativeFromRoot,
    url: targetUrl,
    png: path.relative(process.cwd(), pngPath).replace(/\\/g, '/'),
    svg: path.relative(process.cwd(), svgPath).replace(/\\/g, '/')
  };
}

async function main() {
  const args = process.argv.slice(2);
  let filesToProcess = [];

  if (args.length > 0) {
    const specifiedPath = path.resolve(args[0]);
    if (fs.existsSync(specifiedPath)) {
      if (fs.statSync(specifiedPath).isDirectory()) {
        filesToProcess = getFilesRecursively(specifiedPath);
      } else {
        filesToProcess = [specifiedPath];
      }
    } else {
      console.error(`❌ Percorso non trovato: ${args[0]}`);
      process.exit(1);
    }
  } else {
    filesToProcess = getFilesRecursively(MEDIA_DIR);
  }

  if (filesToProcess.length === 0) {
    console.log(`ℹ️ Nessun file multimediale trovato in ${MEDIA_DIR}`);
    return;
  }

  console.log(`\n🔍 Generazione QR Code in corso per ${filesToProcess.length} file multimediali...\n`);

  for (const file of filesToProcess) {
    try {
      const res = await generateQRForFile(file);
      console.log(`✅ File: ${res.file}`);
      console.log(`   🔗 URL: ${res.url}`);
      console.log(`   🖼️  PNG: ${res.png} (1024x1024 px)`);
      console.log(`   📐 SVG: ${res.svg} (Vettoriale per stampa)\n`);
    } catch (err) {
      console.error(`❌ Errore durante la generazione per ${file}:`, err);
    }
  }

  console.log(`🎉 Tutti i QR code sono stati salvati nella cartella: media/qrcodes/\n`);

  // Aggiorna il catalogo completo di tutti i file multimediali per la finestra interattiva
  const allMedia = getFilesRecursively(MEDIA_DIR);
  const catalog = [];
  for (const f of allMedia) {
    const relativeFromRoot = path.relative(process.cwd(), f).replace(/\\/g, '/');
    const baseName = path.basename(f, path.extname(f));
    const subFolder = path.basename(path.dirname(f));
    const safeName = `qr_${subFolder}_${baseName}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const pngRel = `media/qrcodes/${safeName}.png`;
    const svgRel = `media/qrcodes/${safeName}.svg`;
    catalog.push({
      file: relativeFromRoot,
      fileName: path.basename(f),
      name: baseName.replace(/[-_]/g, ' '),
      category: subFolder,
      ext: path.extname(f).toLowerCase(),
      url: `${BASE_URL}?media=${encodeURI(relativeFromRoot)}`,
      png: pngRel,
      svg: svgRel,
      sizeBytes: fs.existsSync(f) ? fs.statSync(f).size : 0
    });
  }

  const catalogJsonPath = path.join(MEDIA_DIR, 'catalog.json');
  const catalogJsPath = path.join(MEDIA_DIR, 'catalog.js');
  fs.writeFileSync(catalogJsonPath, JSON.stringify(catalog, null, 2));
  fs.writeFileSync(catalogJsPath, `window.ISMAR_MEDIA_CATALOG = ${JSON.stringify(catalog, null, 2)};\n`);
  console.log(`📋 Catalogo multimediale aggiornato con successo:`);
  console.log(`   📄 JSON: media/catalog.json`);
  console.log(`   📜 JS:   media/catalog.js\n`);
}

main().catch(console.error);

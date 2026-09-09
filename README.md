# ISMAR 2026 AR — prototipo web

Esperienza AR installazione-free: il QR apre questa pagina, il browser usa la fotocamera e colloca una scheda AR sul QR/marker. Il pulsante di scatto crea un JPEG con la scena della fotocamera, il contenuto AR e — se abilitato — il frame ISMAR 2026.

## Avvio locale

La fotocamera richiede un contesto sicuro. Per provarla sul computer o telefono, pubblicare questa cartella tramite un server HTTPS (oppure `localhost` durante lo sviluppo), poi aprire l'indirizzo dal telefono.

### Test immediato con il telefono

1. Aprire un terminale in questa cartella e avviare `npm run serve`.
2. Esporre la demo su un indirizzo HTTPS temporaneo: `npx cloudflared tunnel --url http://localhost:8080`.
3. Aprire dal computer `https://.../test.html`: questa pagina visualizza un QR di test già collegato alla demo.
4. Dal telefono inquadrare il QR, aprire la pagina in Safari/Chrome, premere **Apri la fotocamera** e puntare nuovamente il telefono verso il QR sul computer.

Il tunnel è temporaneo: resta disponibile finché la sua finestra rimane aperta. Per la demo si può usare un QR che punta all'indirizzo HTTPS del tunnel, con `?content=food` o `?content=venue` in fondo al link per cambiare il messaggio AR.

Esempi di link da codificare nei QR:

- `https://tuo-dominio.example/?content=welcome`
- `https://tuo-dominio.example/?content=food`
- `https://tuo-dominio.example/?content=venue`

## Stato del prototipo

- Usa palette, logo e un frame derivato dal kit ISMAR 2026.
- L'accesso alla camera e l'esportazione/condivisione della foto funzionano interamente nel browser; nessuno scatto viene inviato a un server.
- Sui browser che espongono `BarcodeDetector`, il QR viene individuato per posizionare la scheda AR. Su browser che non lo offrono, la pagina mostra un fallback centrato: per una pubblicazione definitiva si sostituirà questo componente con il marker tracking multipiattaforma (MindAR), distribuendo per ogni marker il relativo file di tracking.

## Passi per il prodotto evento

1. Aggiungere un catalogo contenuti con asset `glb`, immagini e video collegati ai codici QR.
2. Generare un marker grafico per ogni installazione (QR + illustrazione), e compilarne il target di tracking.
3. Pubblicare l'app in HTTPS e servire gli asset da storage/CDN. Google Drive può restare l'archivio editoriale, ma gli asset pubblici dovrebbero essere sincronizzati su storage per evitare limiti di quota e compatibilità.

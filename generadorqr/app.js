import { PRESETS, normalizeUrl, validateOptions, createMatrix, drawCanvas, createSvg, downloadName } from './core.js?v=20260830-1';

const byId = id => document.getElementById(id);
const form = byId('qrForm');
const canvas = byId('qrCanvas');
const message = byId('formMessage');
const pngButton = byId('downloadPng');
const svgButton = byId('downloadSvg');
const urlInput = byId('urlInput');
const presetButtons = Array.from(document.querySelectorAll('[data-preset]'));
let current = null;
let cached = null;
let timer = null;
let downloading = false;

function setMessage(text, error = false) {
  message.textContent = text;
  message.dataset.state = error ? 'error' : 'ready';
}

function syncColors() {
  for (const field of ['foreground', 'background']) byId(`${field}Value`).textContent = byId(field).value.toUpperCase();
  for (const button of presetButtons) {
    const preset = PRESETS[button.dataset.preset];
    button.setAttribute('aria-pressed', String(preset.foreground === byId('foreground').value && preset.background === byId('background').value));
  }
}

function invalidate() {
  current = null;
  pngButton.disabled = true;
  svgButton.disabled = true;
  canvas.hidden = true;
  byId('emptyPreview').hidden = false;
  byId('encodedUrl').textContent = '—';
  byId('matrixInfo').textContent = 'PNG / SVG';
  byId('dimensions').textContent = `${byId('size').value} × ${byId('size').value} px`;
}

function generate() {
  clearTimeout(timer);
  invalidate();
  syncColors();
  urlInput.removeAttribute('aria-invalid');
  let url;
  try { url = normalizeUrl(urlInput.value); }
  catch (error) {
    urlInput.setAttribute('aria-invalid', 'true');
    byId('previewStatus').textContent = 'FALTA EL ENLACE';
    byId('emptyPreview').textContent = 'Escribe una URL válida para comenzar.';
    setMessage(error.message, true);
    return;
  }
  try {
    const options = validateOptions(Object.fromEntries(['foreground', 'background', 'size', 'margin', 'correction'].map(key => [key, byId(key).value])));
    const key = `${options.correction}:${url}`;
    const matrix = cached?.key === key ? cached.matrix : createMatrix(url, options.correction, window.qrcode);
    cached = { key, matrix };
    drawCanvas(canvas, matrix, options);
    current = { url, options, matrix };
    canvas.hidden = false;
    canvas.setAttribute('aria-label', `Código QR para ${url}`);
    byId('emptyPreview').hidden = true;
    byId('encodedUrl').textContent = url;
    byId('matrixInfo').textContent = `${matrix.length} × ${matrix.length} módulos · ${options.correction}`;
    byId('previewStatus').textContent = 'LISTO PARA ESCANEAR';
    pngButton.disabled = downloading;
    svgButton.disabled = downloading;
    setMessage('Listo. La vista previa se actualiza al cambiar las opciones.');
  } catch (error) {
    invalidate();
    byId('previewStatus').textContent = 'REVISA LAS OPCIONES';
    byId('emptyPreview').textContent = 'Ajusta las opciones para generar tu QR.';
    setMessage(error.message || 'No se pudo generar el QR. Inténtalo de nuevo.', true);
  }
}

function schedule() {
  clearTimeout(timer);
  invalidate();
  syncColors();
  byId('previewStatus').textContent = 'ACTUALIZANDO';
  byId('emptyPreview').textContent = 'Actualizando tu código…';
  timer = setTimeout(generate, 220);
}

function saveBlob(blob, filename) {
  if (!blob) throw new Error('No se pudo preparar la descarga. Inténtalo de nuevo.');
  const address = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = address;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(address), 30000);
}

async function download(extension) {
  if (!current || downloading) return;
  const snapshot = current;
  downloading = true;
  pngButton.disabled = svgButton.disabled = true;
  try {
    let blob;
    if (extension === 'svg') blob = new Blob([createSvg(snapshot.matrix, snapshot.options)], { type: 'image/svg+xml;charset=utf-8' });
    else {
      // A separate canvas freezes the selected QR even if the user edits while encoding.
      const exportCanvas = document.createElement('canvas');
      drawCanvas(exportCanvas, snapshot.matrix, snapshot.options);
      blob = await new Promise(resolve => exportCanvas.toBlob(resolve, 'image/png'));
    }
    saveBlob(blob, downloadName(snapshot.url, snapshot.options.size, extension));
    if (current === snapshot) setMessage(`Descarga ${extension.toUpperCase()} preparada. Comprueba el código antes de imprimir.`);
  } catch (error) { setMessage(error.message || 'No se pudo descargar. Inténtalo de nuevo.', true); }
  finally {
    downloading = false;
    pngButton.disabled = svgButton.disabled = !current;
  }
}

form.addEventListener('submit', event => { event.preventDefault(); generate(); });
form.addEventListener('input', schedule);
form.addEventListener('change', schedule);
form.addEventListener('reset', () => { clearTimeout(timer); cached = null; setTimeout(generate, 0); });
for (const button of presetButtons) button.addEventListener('click', () => {
  const preset = PRESETS[button.dataset.preset];
  byId('foreground').value = preset.foreground;
  byId('background').value = preset.background;
  generate();
});
pngButton.addEventListener('click', () => download('png'));
svgButton.addEventListener('click', () => download('svg'));
generate();

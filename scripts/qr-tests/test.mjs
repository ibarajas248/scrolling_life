import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import jsQR from 'jsqr';
import { PRESETS, normalizeUrl, validateOptions, createMatrix, pixelLayout, drawCanvas, createSvg, downloadName } from '../../generadorqr/core.js';

const require = createRequire(import.meta.url);
const qrcode = require('../../generadorqr/vendor/qrcode-2.0.4.js');
const defaults = { ...PRESETS.classic, correction: 'M', size: 768, margin: 4 };

function rasterCanvas() {
  const canvas = { width: 0, height: 0 };
  const context = {
    fillStyle: '#ffffff',
    fillRect(x, y, width, height) {
      const color = [1, 3, 5].map(i => parseInt(this.fillStyle.slice(i, i + 2), 16));
      for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) {
        canvas.pixels.set([...color, 255], (py * canvas.width + px) * 4);
      }
    },
  };
  canvas.getContext = type => {
    assert.equal(type, '2d');
    canvas.pixels = new Uint8ClampedArray(canvas.width * canvas.height * 4);
    return context;
  };
  return canvas;
}

test('normaliza dominios, puertos, Unicode y parámetros sin perder el destino', () => {
  assert.equal(normalizeUrl(' scrollinglife.com '), 'https://scrollinglife.com/');
  assert.equal(normalizeUrl('example.com:8080/a'), 'https://example.com:8080/a');
  assert.equal(normalizeUrl('http://localhost:8765/a?x=1&y=2#fin'), 'http://localhost:8765/a?x=1&y=2#fin');
  assert.equal(normalizeUrl('https://ejemplo.com/niño?q=café#🖼️'), new URL('https://ejemplo.com/niño?q=café#🖼️').href);
});

test('rechaza URL vacía, inválida, protocolos ejecutables y credenciales', () => {
  for (const value of ['', '   ', 'not a url', 'https://', 'javascript:alert(1)', 'data:text/html,hello', 'ftp://example.com', 'https://user:secret@example.com', 'https://example.com/\nhi', 'https://example.com/\\hi', 'x'.repeat(2001)]) assert.throws(() => normalizeUrl(value));
});

test('mantiene contraste alto y margen mínimo; valida valores manipulados', () => {
  for (const preset of Object.values(PRESETS)) assert.doesNotThrow(() => validateOptions({ ...defaults, ...preset }));
  for (const options of [{ foreground: '#ffffff' }, { background: '#000000' }, { foreground: '#bbbbbb' }, { foreground: 'url(javascript:x)' }, { margin: 0 }, { size: 3 }, { correction: 'Z' }]) assert.throws(() => validateOptions({ ...defaults, ...options }));
});

for (const [index, correction] of ['L', 'M', 'Q', 'H'].entries()) {
  test(`el lector independiente decodifica el QR ${correction} con paleta y margen personalizados`, () => {
    const url = normalizeUrl('https://scrollinglife.com/generadorqr/?lugar=niño&x=1#🖼️');
    const options = validateOptions({ ...defaults, ...Object.values(PRESETS)[index], correction, margin: [4, 6, 8, 4][index] });
    const matrix = createMatrix(url, correction, qrcode);
    const canvas = rasterCanvas();
    drawCanvas(canvas, matrix, options);
    const result = jsQR(canvas.pixels, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
    assert.equal(result?.data, url);
    const layout = pixelLayout(matrix, options);
    assert.ok(layout.offset >= options.margin * layout.cell);
    assert.ok(Number.isInteger(layout.cell));
  });
}

test('PNG conserva el tamaño seleccionado y evita módulos con fracciones de píxel', () => {
  const matrix = createMatrix('https://scrollinglife.com/', 'M', qrcode);
  for (const size of [384, 768, 1024, 2048]) {
    const calls = [];
    const canvas = { getContext: () => ({ fillRect: (...args) => calls.push(args) }) };
    drawCanvas(canvas, matrix, { ...defaults, size });
    assert.equal(canvas.width, size);
    assert.equal(canvas.height, size);
    assert.ok(calls.every(args => args.every(Number.isInteger)));
    assert.deepEqual(calls[0], [0, 0, size, size]);
  }
});

test('enlaces densos piden mayor resolución; desbordamiento se informa sin fallar', () => {
  const url = 'https://example.com/?data=' + 'abc123'.repeat(150);
  const matrix = createMatrix(url, 'H', qrcode);
  assert.throws(() => pixelLayout(matrix, { ...defaults, size: 384 }), /tamaño mayor/);
  assert.doesNotThrow(() => pixelLayout(matrix, { ...defaults, size: 1024 }));
  assert.throws(() => createMatrix('https://example.com/' + 'x'.repeat(2900), 'H', qrcode), /no cabe/);
  assert.throws(() => createMatrix(url, 'H', undefined), /cargar el generador/);
});

test('SVG autocontenido, escalable, sin recursos externos y con quiet zone', () => {
  const matrix = createMatrix('https://example.com/?a=1&b=2', 'M', qrcode);
  const svg = createSvg(matrix, defaults);
  assert.match(svg, /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg, /width="768" height="768"/);
  const total = matrix.length + 8;
  assert.ok(svg.includes(`viewBox="0 0 ${total} ${total}"`));
  assert.ok(!/script|href|foreignObject/i.test(svg));
  const paths = [...svg.matchAll(/M(\d+),(\d+)h1v1h-1z/g)];
  assert.equal(paths.length, matrix.flat().filter(Boolean).length);
  for (const [, x, y] of paths) {
    assert.ok(Number(x) >= 4 && Number(y) >= 4);
    assert.equal(matrix[Number(y) - 4][Number(x) - 4], true);
  }
});

test('nombres de descarga seguros y sin parámetros privados', () => {
  assert.equal(downloadName('https://example.com/a?token=private', 1024, 'png'), 'qr-example.com-1024.png');
});

test('controlador: estado inicial, cambios inválidos, paletas, reset y exportaciones', async () => {
  class Element {
    constructor(value = '') { this.value = value; this.textContent = ''; this.hidden = false; this.disabled = false; this.dataset = {}; this.attributes = {}; this.listeners = {}; }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    getContext() { return { fillRect() {} }; }
    toBlob(callback, type) { callback(new Blob(['png-test-data'], { type })); }
    click() { this.clicked = true; }
    remove() {}
  }
  const ids = ['qrForm', 'qrCanvas', 'formMessage', 'downloadPng', 'downloadSvg', 'urlInput', 'foreground', 'background', 'size', 'margin', 'correction', 'foregroundValue', 'backgroundValue', 'emptyPreview', 'encodedUrl', 'matrixInfo', 'dimensions', 'previewStatus'];
  const nodes = Object.fromEntries(ids.map(id => [id, new Element()]));
  const resetValues = { urlInput: 'https://scrollinglife.com/', foreground: '#111111', background: '#ffffff', size: '1024', margin: '4', correction: 'M' };
  const reset = () => { for (const [key, value] of Object.entries(resetValues)) nodes[key].value = value; };
  reset();
  const buttons = Object.keys(PRESETS).map(key => { const el = new Element(); el.dataset.preset = key; return el; });
  const saved = [], appended = [];
  const tasks = new Map(); let next = 0;
  const sandbox = {
    PRESETS, normalizeUrl, validateOptions, createMatrix, drawCanvas, createSvg, downloadName, Blob,
    window: { qrcode }, URL: { createObjectURL: blob => { saved.push(blob); return 'blob:test'; }, revokeObjectURL() {} },
    document: { getElementById: id => nodes[id], querySelectorAll: () => buttons, createElement: () => new Element(), body: { append: link => appended.push(link) } },
    setTimeout: (callback, delay) => { const id = ++next; if (delay < 1000) tasks.set(id, callback); return id; },
    clearTimeout: id => tasks.delete(id),
  };
  const code = readFileSync(new URL('../../generadorqr/app.js', import.meta.url), 'utf8').replace(/^import[^\n]+\n/, '');
  vm.runInNewContext(code, sandbox);
  assert.equal(nodes.downloadPng.disabled, false);
  assert.equal(nodes.encodedUrl.textContent, 'https://scrollinglife.com/');
  nodes.urlInput.value = 'javascript:alert(1)';
  nodes.qrForm.listeners.input();
  assert.equal(nodes.downloadPng.disabled, true, 'never download a stale QR after an edit');
  for (const callback of [...tasks.values()]) callback(); tasks.clear();
  assert.equal(nodes.qrCanvas.hidden, true);
  assert.equal(nodes.urlInput.attributes['aria-invalid'], 'true');
  reset();
  nodes.qrForm.listeners.submit({ preventDefault() {} });
  buttons[2].listeners.click();
  assert.equal(nodes.foreground.value, PRESETS.ink.foreground);
  assert.equal(buttons[2].attributes['aria-pressed'], 'true');
  await nodes.downloadSvg.listeners.click();
  assert.match(await saved[0].text(), /<svg/);
  assert.equal(appended[0].download, 'qr-scrollinglife.com-1024.svg');
  await nodes.downloadPng.listeners.click();
  assert.equal(saved[1].type, 'image/png');
  nodes.qrForm.listeners.reset(); reset();
  for (const callback of [...tasks.values()]) callback(); tasks.clear();
  assert.equal(nodes.foreground.value, '#111111');
  assert.equal(nodes.downloadPng.disabled, false);
});

test('HTML publica assets propios, sin formularios remotos ni rastreadores', () => {
  const html = readFileSync(new URL('../../generadorqr/index.html', import.meta.url), 'utf8');
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.ok(!/<script[^>]+src="https?:/i.test(html));
  assert.ok(!/maintenance-gate|traffic-tracker|localStorage/.test(html));
  assert.match(html, /role="status"/);
});

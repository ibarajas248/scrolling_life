export const PRESETS = Object.freeze({
  classic: { foreground: '#111111', background: '#ffffff' },
  scroll: { foreground: '#0b5359', background: '#effcfa' },
  ink: { foreground: '#50348a', background: '#fbf8ff' },
  paper: { foreground: '#583520', background: '#fff3db' },
});

export function normalizeUrl(value) {
  const raw = String(value).trim();
  if (!raw) throw new Error('Escribe una URL para generar tu código QR.');
  if (raw.length > 2000) throw new Error('El enlace es demasiado largo. Usa una URL más corta.');
  if (/[\u0000-\u001f\u007f\\]/u.test(raw)) throw new Error('La URL contiene caracteres no válidos.');
  const hasProtocol = /^[a-z][a-z\d+.-]*:/i.test(raw);
  const isHostWithPort = /^[^\s/:?#]+:\d+(?:[/?#]|$)/u.test(raw);
  let url;
  try { url = new URL(hasProtocol && !isHostWithPort ? raw : `https://${raw}`); }
  catch { throw new Error('Revisa el enlace. Ejemplo: https://tu-sitio.com'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Usa una URL web que empiece por http:// o https://.');
  if (!url.hostname || url.username || url.password) throw new Error('Usa un enlace web sin usuario ni contraseña.');
  return url.href;
}

function luminance(hex) {
  const channels = [1, 3, 5].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function validateOptions(options) {
  const { foreground, background, correction } = options;
  const size = Number(options.size), margin = Number(options.margin);
  if (![foreground, background].every(color => /^#[0-9a-f]{6}$/i.test(color))) throw new Error('Selecciona colores válidos.');
  if (!['L', 'M', 'Q', 'H'].includes(correction)) throw new Error('Selecciona un nivel de corrección válido.');
  if (![384, 768, 1024, 2048].includes(size) || ![4, 6, 8].includes(margin)) throw new Error('Selecciona un tamaño y un margen válidos.');
  const dark = luminance(foreground), light = luminance(background);
  if (dark >= light || (light + 0.05) / (dark + 0.05) < 4.5) {
    throw new Error('Aumenta el contraste: usa un código oscuro sobre un fondo claro. Prueba una de las paletas.');
  }
  return { foreground, background, correction, size, margin };
}

export function createMatrix(url, correction, factory) {
  if (typeof factory !== 'function') throw new Error('No se pudo cargar el generador. Recarga la página e inténtalo de nuevo.');
  // Explicit UTF-8 also keeps non-ASCII URL fragments safe if normalization changes.
  factory.stringToBytes = value => Array.from(new TextEncoder().encode(value));
  const qr = factory(0, correction);
  qr.addData(url, 'Byte');
  try { qr.make(); }
  catch { throw new Error('El enlace no cabe con esta corrección. Acórtalo o selecciona un nivel menor.'); }
  return Array.from({ length: qr.getModuleCount() }, (_, y) =>
    Array.from({ length: qr.getModuleCount() }, (_, x) => qr.isDark(y, x)));
}

export function pixelLayout(matrix, options) {
  const total = matrix.length + options.margin * 2;
  const cell = Math.floor(options.size / total);
  if (cell < 3) throw new Error('Este enlace necesita un tamaño mayor. Selecciona 768 px o más.');
  return { cell, offset: Math.floor((options.size - matrix.length * cell) / 2) };
}

export function drawCanvas(canvas, matrix, options) {
  const { cell, offset } = pixelLayout(matrix, options);
  canvas.width = options.size;
  canvas.height = options.size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Tu navegador no permite dibujar el QR. Prueba con un navegador actualizado.');
  context.imageSmoothingEnabled = false;
  context.fillStyle = options.background;
  context.fillRect(0, 0, options.size, options.size);
  context.fillStyle = options.foreground;
  matrix.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) context.fillRect(offset + x * cell, offset + y * cell, cell, cell);
  }));
}

export function createSvg(matrix, options) {
  const safe = validateOptions(options);
  const total = matrix.length + safe.margin * 2;
  const paths = [];
  matrix.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) paths.push(`M${x + safe.margin},${y + safe.margin}h1v1h-1z`);
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${safe.size}" height="${safe.size}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><title>Código QR</title><rect width="${total}" height="${total}" fill="${safe.background}"/><path fill="${safe.foreground}" d="${paths.join('')}"/></svg>`;
}

export function downloadName(url, size, extension) {
  const host = new URL(url).hostname.replace(/[^a-z0-9.-]/gi, '-');
  return `qr-${host.slice(0, 80)}-${size}.${extension}`;
}

// El servidor local de la consola incluye su API de escritura.
if (['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
  document.querySelectorAll('[data-input-link]').forEach((link) => {
    const url = new URL('/input.sh/', window.location.href);
    url.port = '8094';
    link.href = url.href;
  });
}

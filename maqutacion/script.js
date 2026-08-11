const formatButtons = document.querySelectorAll('.format-item');
const igPost = document.getElementById('igPost');
const activeFormat = document.getElementById('activeFormat');
const activeAspect = document.getElementById('activeAspect');
const formatText = document.getElementById('formatText');
const rgbText = document.getElementById('rgbText');
const btnDownloadImg = document.getElementById('btnDownloadImg');
const btnDownloadVid = document.getElementById('btnDownloadVid');

const templateLabels = {
  home: 'POST_01_HOME',
  archive: 'POST_02_ARCHIVO',
  date: 'POST_03_FECHA',
  clean: 'POST_04_LIMPIO',
  reel: 'REEL_01_FEED',
  story: 'STORY_01_ARCH',
};

const templateClasses = Object.keys(templateLabels).map((name) => `template-${name}`);

formatButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const template = button.dataset.template || 'home';
    const aspect = button.dataset.aspect || '1:1';

    formatButtons.forEach((item) => {
      const isActive = item === button;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-pressed', String(isActive));
    });

    igPost.classList.remove(...templateClasses);
    igPost.classList.add(`template-${template}`);

    if (aspect === '9:16') {
      igPost.classList.add('aspect-9-16');
      if (activeAspect) activeAspect.textContent = '9:16';
      if (formatText) formatText.textContent = 'Formato Vertical';
    } else {
      igPost.classList.remove('aspect-9-16');
      if (activeAspect) activeAspect.textContent = '1:1';
      if (formatText) formatText.textContent = 'Formato para feed';
    }

    if (activeFormat) {
      activeFormat.textContent = templateLabels[template] || templateLabels.home;
    }
  });
});

if (btnDownloadImg) {
  btnDownloadImg.addEventListener('click', () => {
    // Aquí puedes integrar html2canvas u otra librería para renderizar el DOM a imagen.
    console.log('Descargando imagen del DOM...');
    alert('Función de descarga de imagen en desarrollo. Aquí iría la lógica (ej. html2canvas).');
  });
}

if (btnDownloadVid) {
  btnDownloadVid.addEventListener('click', () => {
    // Aquí puedes integrar MediaRecorder y Canvas para exportar animación a video.
    console.log('Descargando video de la animación...');
    alert('Función de descarga de video en desarrollo. Requiere grabar el canvas animado.');
  });
}

const stage = document.querySelector('.space-stage');
const camera = document.getElementById('sceneCamera');
const nodes = Array.from(document.querySelectorAll('.space-node'));
const cards = Array.from(document.querySelectorAll('.info-card'));

let targetRotateX = -8;
let targetRotateY = 10;
let currentRotateX = -8;
let currentRotateY = 10;

const setActivePanel = (panelName) => {
  nodes.forEach((node) => {
    node.classList.toggle('is-active', node.dataset.panel === panelName);
  });

  cards.forEach((card) => {
    card.classList.toggle('is-active', card.dataset.card === panelName);
  });
};

nodes.forEach((node) => {
  node.addEventListener('click', () => setActivePanel(node.dataset.panel));
  node.addEventListener('focus', () => setActivePanel(node.dataset.panel));
});

const onPointerMove = (event) => {
  const bounds = stage.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width - 0.5;
  const y = (event.clientY - bounds.top) / bounds.height - 0.5;

  targetRotateX = -8 - y * 16;
  targetRotateY = 10 + x * 22;
};

const onPointerLeave = () => {
  targetRotateX = -8;
  targetRotateY = 10;
};

const animateCamera = () => {
  currentRotateX += (targetRotateX - currentRotateX) * 0.08;
  currentRotateY += (targetRotateY - currentRotateY) * 0.08;

  camera.style.transform = `rotateX(${currentRotateX}deg) rotateY(${currentRotateY}deg)`;
  window.requestAnimationFrame(animateCamera);
};

stage.addEventListener('pointermove', onPointerMove);
stage.addEventListener('pointerleave', onPointerLeave);

animateCamera();
setActivePanel('gesto');

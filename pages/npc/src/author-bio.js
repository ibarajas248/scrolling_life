(() => {
  const trigger = document.querySelector('.author-button');
  const dialog = document.querySelector('#author-bio');
  trigger.addEventListener('click', () => {
    dialog.showModal();
    dialog.scrollTop = 0;
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
})();

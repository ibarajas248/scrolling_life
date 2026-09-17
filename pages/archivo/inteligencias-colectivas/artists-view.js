(() => {
  const gallery = document.querySelector('.horizontal-scroll-container');
  const navigation = document.querySelector('.gallery-navigation');
  const previous = navigation.querySelector('.gallery-previous');
  const next = navigation.querySelector('.gallery-next');
  const updateNavigation = () => {
    previous.disabled = gallery.scrollLeft <= 2;
    next.disabled = gallery.scrollLeft >= gallery.scrollWidth - gallery.clientWidth - 2;
  };
  const move = direction => {
    const card = gallery.querySelector('.artist-card');
    const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(gallery).gap || 0);
    gallery.scrollBy({ left: direction * step, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  gallery.addEventListener('scroll', updateNavigation, { passive: true });
  window.addEventListener('resize', updateNavigation);
  document.addEventListener('DOMContentLoaded', updateNavigation);
  updateNavigation();
  const close = document.createElement('button');
  close.className = 'gallery-close';
  close.textContent = 'Cerrar vista ×';
  close.hidden = true;
  document.body.append(close);
  let selected;
  let opener;
  let position = 0;
  let textPosition = 0;

  gallery.querySelectorAll('.artist-card').forEach(card => {
    const title = card.querySelector('h2').textContent.trim();
    const frame = card.querySelector('iframe');
    frame.title = title;
    frame.tabIndex = -1;
    const button = document.createElement('button');
    button.className = 'video-open';
    button.type = 'button';
    button.setAttribute('aria-label', `Abrir ${title} en dos columnas`);
    card.querySelector('.video-container').append(button);
    const text = card.querySelector('.text-content');
    text.tabIndex = 0;
    text.setAttribute('role', 'region');
    text.setAttribute('aria-label', `Texto de ${title}`);
    button.addEventListener('click', () => {
      position = gallery.scrollLeft;
      textPosition = text.scrollTop;
      selected = card;
      opener = button;
      card.classList.add('is-selected');
      gallery.classList.add('is-detail');
      navigation.hidden = true;
      frame.tabIndex = 0;
      // Enable the player's controls in the individual view.
      const source = new URL(frame.src);
      source.searchParams.delete('background');
      source.searchParams.set('controls', '1');
      frame.src = source.href;
      text.scrollTop = 0;
      close.hidden = false;
      close.focus();
    });
  });

  const leaveDetail = () => {
    if (!selected) return;
    const frame = selected.querySelector('iframe');
    const source = new URL(frame.src);
    source.searchParams.set('background', '1');
    source.searchParams.delete('controls');
    frame.src = source.href;
    frame.tabIndex = -1;
    gallery.classList.remove('is-detail');
    navigation.hidden = false;
    selected.classList.remove('is-selected');
    selected.querySelector('.text-content').scrollTop = textPosition;
    close.hidden = true;
    gallery.scrollLeft = position;
    updateNavigation();
    opener.focus({ preventScroll: true });
    selected = undefined;
  };
  close.addEventListener('click', leaveDetail);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') leaveDetail();
  });
})();

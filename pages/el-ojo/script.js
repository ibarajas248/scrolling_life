(() => {
  const container = document.querySelector('[data-scroll-container]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const paragraphs = document.querySelectorAll('.poem p');
  const sections = [...document.querySelectorAll('.movement')];
  const links = [...document.querySelectorAll('nav a')];
  let scroll = null;
  const update = (position, limit) => {
    document.documentElement.style.setProperty('--progress', `${Math.min(100, Math.max(0, position / Math.max(1, limit) * 100))}%`);
    let current = '';
    sections.forEach(section => { if (section.getBoundingClientRect().top <= window.innerHeight * .55) current = section.id; });
    links.forEach(link => {
      if (link.hash === `#${current}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };
  const start = () => {
    if (!reduced.matches && window.LocomotiveScroll) {
      try {
        scroll = new window.LocomotiveScroll({ el: container, smooth: true, lerp: .075, multiplier: .85, smartphone: { smooth: false }, tablet: { smooth: false } });
        document.documentElement.classList.add('motion');
        scroll.on('scroll', state => update(state.scroll.y, state.limit.y));
        document.fonts.ready.then(() => scroll.update());
      } catch (error) { scroll = null; }
    }
    if (!scroll) {
      if (!reduced.matches && 'IntersectionObserver' in window) {
        document.documentElement.classList.add('motion');
        const observer = new IntersectionObserver(entries => entries.forEach(entry => {
          if (entry.isIntersecting) { entry.target.classList.add('is-inview'); observer.unobserve(entry.target); }
        }), { threshold: .05 });
        paragraphs.forEach(p => observer.observe(p));
      }
      const onScroll = () => update(window.scrollY, document.documentElement.scrollHeight - innerHeight);
      addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
    document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
      const target = link.hash === '#top' ? container : document.querySelector(link.hash);
      if (!target) return;
      event.preventDefault();
      if (scroll) scroll.scrollTo(target, { offset: -90 });
      else target.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth' });
    }));
  };
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
})();

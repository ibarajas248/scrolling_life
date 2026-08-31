(() => {
  const CONFIG = {
    DATA_SOURCE: 'api-with-fallback', // api | local | api-with-fallback
    POST_LIMIT: 50,
    API_BASE_URL: 'https://esferapublica.org/wp-json/wp/v2/posts',
    API_EMBED: '',
    API_FIELDS: ['id', 'date', 'link', 'slug', 'title', 'author'],
    FALLBACK_URL: './esfera-publica-fallback.json',
    REQUEST_TIMEOUT_MS: 8500,
    BASE_SPEED: 1.18,
    MAX_DPR: 1.35,
    TARGET_FPS: 42,
    MAX_TRAILS: 3,
    DENSITY_RAMP_SECONDS: 42,
    CYCLE_SECONDS: 86
  };

  const canvas = document.querySelector('[data-rain-canvas]');
  const statusNode = document.querySelector('[data-status]');
  const passedNode = document.querySelector('[data-passed-count]');
  const readNode = document.querySelector('[data-read-count]');
  const reader = document.querySelector('[data-reader]');
  const readerTitle = document.querySelector('[data-reader-title]');
  const readerAuthor = document.querySelector('[data-reader-author]');
  const readerDate = document.querySelector('[data-reader-date]');
  const readerLink = document.querySelector('[data-reader-link]');
  const readerClose = document.querySelector('[data-reader-close]');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const random = (min, max) => min + Math.random() * (max - min);

  const decodeEntities = (value = '') => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  };

  const stripTags = (value = '') => decodeEntities(String(value).replace(/<[^>]*>/g, ''));

  const formatDate = (isoDate) => {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return 'fecha no disponible';
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    }).format(date);
  };

  const buildApiUrl = () => {
    const url = new URL(CONFIG.API_BASE_URL);
    url.searchParams.set('per_page', String(CONFIG.POST_LIMIT));
    if (CONFIG.API_EMBED) {
      url.searchParams.set('_embed', CONFIG.API_EMBED);
    }
    url.searchParams.set('_fields', CONFIG.API_FIELDS.join(','));
    return url.toString();
  };

  const normalizePost = (post, index = 0, source = 'api') => {
    const embeddedAuthor = post?._embedded?.author?.[0]?.name;
    const rawTitle = typeof post?.title === 'string' ? post.title : post?.title?.rendered;
    const author = post?.authorName || embeddedAuthor || (post?.author ? `autor ${post.author}` : 'autor no disponible');
    const id = post?.id ?? `${source}-${index}`;

    return {
      id: String(id),
      title: stripTags(rawTitle || 'publicacion sin titulo'),
      author: stripTags(author),
      date: post?.date || '',
      dateLabel: formatDate(post?.date),
      link: post?.link || 'https://esferapublica.org/',
      slug: post?.slug || '',
      index,
      source
    };
  };

  const fetchJson = async (url) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: 'application/json' }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const fetchApiPosts = async () => {
    const data = await fetchJson(buildApiUrl());
    return data.map((post, index) => normalizePost(post, index, 'api'));
  };

  const fetchFallbackPosts = async () => {
    const data = await fetchJson(CONFIG.FALLBACK_URL);
    const posts = Array.isArray(data) ? data : data.posts || [];
    return posts.map((post, index) => normalizePost(post, index, 'fallback'));
  };

  const loadPosts = async () => {
    if (CONFIG.DATA_SOURCE === 'local') {
      return { posts: await fetchFallbackPosts(), source: 'respaldo local' };
    }

    if (CONFIG.DATA_SOURCE === 'api') {
      return { posts: await fetchApiPosts(), source: 'api viva' };
    }

    try {
      return { posts: await fetchApiPosts(), source: 'api viva' };
    } catch (error) {
      console.warn('No fue posible cargar la API. Usando respaldo local.', error);
      return { posts: await fetchFallbackPosts(), source: 'respaldo local' };
    }
  };

  class CriticalRain {
    constructor(rainCanvas, posts) {
      this.canvas = rainCanvas;
      this.ctx = rainCanvas.getContext('2d', { alpha: false });
      this.posts = posts;
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.drops = [];
      this.lastTime = 0;
      this.elapsed = 0;
      this.passed = 0;
      this.readIds = new Set();
      this.pointer = { x: -9999, y: -9999, active: false, touch: false };
      this.observed = null;
      this.scrollImpulse = 0;
      this.pausedForVisibility = document.hidden;
      this.recentCursor = 0;
      this.frameRequest = 0;
      this.frameInterval = 1000 / CONFIG.TARGET_FPS;
      this.resize = this.resize.bind(this);
      this.tick = this.tick.bind(this);
      this.onPointerMove = this.onPointerMove.bind(this);
      this.onPointerDown = this.onPointerDown.bind(this);
      this.onPointerLeave = this.onPointerLeave.bind(this);
      this.onWheel = this.onWheel.bind(this);
      this.onTouchMove = this.onTouchMove.bind(this);
      this.onVisibilityChange = this.onVisibilityChange.bind(this);
      this.onReaderClose = this.releaseObserved.bind(this);
    }

    start() {
      this.resize();
      this.bind();
      this.seedDrops();
      this.lastTime = performance.now();
      this.frameRequest = window.requestAnimationFrame(this.tick);
    }

    bind() {
      window.addEventListener('resize', this.resize, { passive: true });
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
      window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
      window.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
      window.addEventListener('wheel', this.onWheel, { passive: false });
      window.addEventListener('touchmove', this.onTouchMove, { passive: false });
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      readerClose?.addEventListener('click', this.onReaderClose);
    }

    destroy() {
      window.cancelAnimationFrame(this.frameRequest);
      window.removeEventListener('resize', this.resize);
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerdown', this.onPointerDown);
      window.removeEventListener('pointerleave', this.onPointerLeave);
      window.removeEventListener('wheel', this.onWheel);
      window.removeEventListener('touchmove', this.onTouchMove);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      readerClose?.removeEventListener('click', this.onReaderClose);
    }

    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.dpr = Math.min(CONFIG.MAX_DPR, window.devicePixelRatio || 1);
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.ctx.fillStyle = '#040508';
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.drops.forEach((drop) => this.measure(drop));
    }

    seedDrops() {
      const initialCount = Math.max(8, Math.floor(this.maxDrops() * 0.24));
      for (let index = 0; index < initialCount; index += 1) {
        const drop = this.createDrop(true);
        drop.y = random(-this.height * 0.95, this.height * 0.92);
        this.drops.push(drop);
      }
    }

    maxDrops() {
      const area = this.width * this.height;
      const base = clamp(Math.floor(area / 33000), 12, 44);
      return prefersReducedMotion.matches ? Math.max(8, Math.floor(base * 0.45)) : base;
    }

    targetDrops() {
      const phase = (this.elapsed % CONFIG.CYCLE_SECONDS) / CONFIG.CYCLE_SECONDS;
      const cycleDensity = phase < 0.74
        ? 0.26 + (phase / 0.74) * 0.74
        : 1 - ((phase - 0.74) / 0.26) * 0.46;
      const ramp = clamp(this.elapsed / CONFIG.DENSITY_RAMP_SECONDS, 0, 1);
      const impulse = clamp(this.scrollImpulse * 0.18, 0, 0.32);
      return Math.round(this.maxDrops() * clamp(cycleDensity * ramp + impulse, 0.2, 1.18));
    }

    choosePost() {
      if (Math.random() < 0.38) {
        const post = this.posts[this.recentCursor % Math.min(12, this.posts.length)];
        this.recentCursor += 1;
        return post;
      }
      return this.posts[Math.floor(Math.random() * this.posts.length)];
    }

    createDrop(initial = false) {
      const post = this.choosePost();
      const recent = 1 - clamp(post.index / Math.max(1, this.posts.length - 1), 0, 1);
      const mobile = this.width < 720;
      const baseSize = mobile ? random(13, 23) : random(16, 36);
      const fontSize = baseSize + recent * (mobile ? 5 : 10);
      const drop = {
        post,
        x: random(-this.width * 0.08, this.width * 0.92),
        y: initial ? random(-this.height, this.height) : random(-220, -40),
        speed: random(this.height * 0.26, this.height * 0.86) * (prefersReducedMotion.matches ? 0.28 : 1),
        drift: random(-16, 16),
        fontSize,
        recent,
        opacity: random(0.34, 0.88) + recent * 0.15,
        blur: random(0, 0.75) + (1 - recent) * 0.8,
        redBias: Math.random() < 0.16 + recent * 0.12,
        hold: 0,
        width: 0,
        height: fontSize * 1.15,
        wasObserved: false,
        seed: Math.random() * 10000,
        trailSpacing: fontSize * random(0.62, 0.86),
        trailFragments: this.buildTrailFragments(post.title)
      };
      this.measure(drop);
      return drop;
    }

    measure(drop) {
      const ctx = this.ctx;
      ctx.save();
      ctx.font = this.font(drop);
      drop.width = ctx.measureText(drop.post.title).width;
      drop.height = drop.fontSize * 1.22;
      ctx.restore();
    }

    font(drop) {
      const weight = drop.recent > 0.72 ? 720 : 560;
      return `${weight} ${drop.fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    }

    buildTrailFragments(title) {
      return Array.from({ length: CONFIG.MAX_TRAILS }, (_, index) => {
        const slicePoint = Math.max(10, Math.floor(title.length * random(0.36, 0.84)));
        return index % 2 === 0 ? title.slice(0, slicePoint) : title.slice(-slicePoint);
      });
    }

    onPointerMove(event) {
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
      this.pointer.active = true;
      this.pointer.touch = event.pointerType === 'touch';
      if (!this.pointer.touch) {
        const hit = this.findHit(this.pointer.x, this.pointer.y);
        if (hit !== this.observed) {
          this.setObserved(hit);
        }
      }
    }

    onPointerDown(event) {
      const hit = this.findHit(event.clientX, event.clientY);
      if (hit) {
        this.pointer.x = event.clientX;
        this.pointer.y = event.clientY;
        this.pointer.active = true;
        this.pointer.touch = event.pointerType === 'touch';
        this.setObserved(hit);
      } else if (!reader?.contains(event.target)) {
        this.releaseObserved();
      }
    }

    onPointerLeave() {
      this.pointer.active = false;
      if (!this.pointer.touch) this.releaseObserved();
    }

    onWheel(event) {
      event.preventDefault();
      this.scrollImpulse = clamp(this.scrollImpulse + Math.abs(event.deltaY) / 360, 0, 3.2);
      if (Math.abs(event.deltaY) < 22 && !this.observed) {
        this.makeReadableMoment();
      }
    }

    onTouchMove(event) {
      if (event.touches.length > 0) {
        event.preventDefault();
        this.scrollImpulse = clamp(this.scrollImpulse + Math.abs(event.touches[0].clientY - this.pointer.y) / 220, 0, 2.6);
        this.pointer.x = event.touches[0].clientX;
        this.pointer.y = event.touches[0].clientY;
      }
    }

    onVisibilityChange() {
      this.pausedForVisibility = document.hidden;
      if (!document.hidden) {
        this.lastTime = performance.now();
      }
    }

    makeReadableMoment() {
      this.drops.slice(0, 4).forEach((drop) => {
        drop.speed *= 0.9;
        drop.blur = Math.max(0, drop.blur - 0.4);
        drop.opacity = Math.min(1, drop.opacity + 0.08);
      });
    }

    findHit(x, y) {
      for (let index = this.drops.length - 1; index >= 0; index -= 1) {
        const drop = this.drops[index];
        const pad = Math.max(10, drop.fontSize * 0.25);
        const left = drop.x - pad;
        const right = drop.x + Math.min(drop.width, this.width * 1.05) + pad;
        const top = drop.y - pad;
        const bottom = drop.y + drop.height + pad;
        if (x >= left && x <= right && y >= top && y <= bottom) {
          return drop;
        }
      }
      return null;
    }

    setObserved(drop) {
      if (!drop) {
        this.releaseObserved();
        return;
      }
      this.observed = drop;
      if (!drop.wasObserved) {
        drop.wasObserved = true;
        this.readIds.add(drop.post.id);
        if (readNode) {
          readNode.textContent = String(this.readIds.size);
        }
      }
      this.updateReader(drop);
    }

    releaseObserved() {
      this.observed = null;
      if (reader) reader.hidden = true;
    }

    updateReader(drop) {
      if (!reader || !drop) return;
      reader.hidden = false;
      if (readerTitle) readerTitle.textContent = drop.post.title;
      if (readerAuthor) readerAuthor.textContent = drop.post.author;
      if (readerDate) {
        readerDate.textContent = drop.post.dateLabel;
        readerDate.setAttribute('datetime', drop.post.date || '');
      }
      if (readerLink) readerLink.href = drop.post.link;

      if (window.innerWidth <= 720) return;

      const readerWidth = Math.min(410, window.innerWidth - 28);
      const left = clamp(drop.x, 14, window.innerWidth - readerWidth - 14);
      const top = clamp(drop.y + drop.height + 14, 104, window.innerHeight - 210);
      reader.style.left = `${left}px`;
      reader.style.top = `${top}px`;
    }

    tick(now) {
      this.frameRequest = window.requestAnimationFrame(this.tick);
      if (this.pausedForVisibility) return;
      if (now - this.lastTime < this.frameInterval) return;

      const rawDelta = (now - this.lastTime) / 1000;
      const delta = clamp(rawDelta, 0.001, 0.05);
      this.lastTime = now;
      this.elapsed += delta;
      this.scrollImpulse = lerp(this.scrollImpulse, 0, 0.035);

      this.ensureDensity();
      this.paint(delta);
    }

    ensureDensity() {
      const target = this.targetDrops();
      while (this.drops.length < target) {
        this.drops.push(this.createDrop(false));
      }
      if (this.drops.length > target + 5) {
        this.drops.sort((a, b) => b.y - a.y);
        this.drops.length = target + 5;
      }
    }

    paint(delta) {
      const ctx = this.ctx;
      const phase = (this.elapsed % CONFIG.CYCLE_SECONDS) / CONFIG.CYCLE_SECONDS;
      const clearing = phase > 0.76 ? 0.082 : 0.046;

      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = `rgba(4, 5, 8, ${clearing})`;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();

      const speedMultiplier = CONFIG.BASE_SPEED + this.scrollImpulse * 0.82;
      this.drops.forEach((drop) => {
        const holdTarget = drop === this.observed ? 1 : 0;
        drop.hold = lerp(drop.hold, holdTarget, holdTarget ? 0.16 : 0.08);
        const localSpeed = speedMultiplier * (1 - drop.hold * 0.94);
        drop.y += drop.speed * localSpeed * delta;
        drop.x += Math.sin(this.elapsed * 1.1 + drop.seed) * drop.drift * delta * 0.12;

        if (drop.y > this.height + drop.height + 70) {
          Object.assign(drop, this.createDrop(false));
          this.passed += 1;
          if (passedNode) {
            passedNode.textContent = String(this.passed);
          }
        }

        this.drawDrop(drop);
      });

      if (this.observed) {
        this.updateReader(this.observed);
      }
    }

    drawDrop(drop) {
      const ctx = this.ctx;
      const title = drop.post.title;
      const hold = drop.hold;
      const alpha = clamp(drop.opacity + hold * 0.45, 0.12, 1);
      const blur = Math.max(0, drop.blur * (1 - hold * 0.86));
      const trailCount = Math.round(CONFIG.MAX_TRAILS - hold * (CONFIG.MAX_TRAILS - 1));
      const baseColor = drop.redBias
        ? `rgba(255, 61, 61, ${alpha})`
        : `rgba(245, 245, 239, ${alpha})`;

      ctx.save();
      ctx.font = this.font(drop);
      ctx.textBaseline = 'top';
      ctx.filter = blur > 0.16 ? `blur(${blur}px)` : 'none';
      ctx.shadowColor = drop.redBias ? 'rgba(255, 24, 24, 0.42)' : 'rgba(255, 255, 255, 0.2)';
      ctx.shadowBlur = hold ? 10 : 4 + drop.recent * 10;

      for (let index = trailCount; index > 0; index -= 1) {
        const ghost = drop.trailFragments[index - 1] || title;
        ctx.fillStyle = drop.redBias
          ? `rgba(255, 61, 61, ${0.045 * index * (1 - hold * 0.8)})`
          : `rgba(245, 245, 239, ${0.035 * index * (1 - hold * 0.75)})`;
        ctx.fillText(ghost, drop.x + index * 3, drop.y - index * drop.trailSpacing);
      }

      ctx.fillStyle = baseColor;
      ctx.fillText(title, drop.x, drop.y);

      if (hold > 0.18) {
        ctx.filter = 'none';
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(255, 61, 61, ${0.22 + hold * 0.42})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y + drop.height + 4);
        ctx.lineTo(Math.min(this.width - 12, drop.x + Math.min(drop.width, this.width * 0.72)), drop.y + drop.height + 4);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  loadPosts()
    .then(({ posts, source }) => {
      if (!posts.length) throw new Error('No hay publicaciones disponibles.');
      if (statusNode) {
        statusNode.textContent = source === 'api viva'
          ? `API viva: ${posts.length} publicaciones recibidas.`
          : `API sin respuesta: usando ${posts.length} publicaciones de respaldo.`;
      }
      document.body.classList.add('is-ready');
      const engine = new CriticalRain(canvas, posts);
      engine.start();
      document.fonts?.ready?.then(() => engine.resize());
      window.precipitacionCritica = { config: CONFIG, engine };
      window.addEventListener('beforeunload', () => engine.destroy(), { once: true });
    })
    .catch((error) => {
      console.error(error);
      if (statusNode) {
        statusNode.textContent = 'No fue posible recibir la discusion. Revisa el archivo de respaldo local.';
      }
    });
})();

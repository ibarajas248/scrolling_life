(() => {
  const terminalBody = document.getElementById('terminalBody');
  const linesNode = document.getElementById('terminalLines');
  const modeLabel = document.getElementById('modeLabel');
  const lineLabel = document.getElementById('lineLabel');
  const scrollThumb = document.getElementById('scrollThumb');

  if (!(terminalBody instanceof HTMLElement) || !(linesNode instanceof HTMLOListElement)) {
    return;
  }

  const chapterTemplates = [
    {
      cmd: 'grep -R "scroll" /archive/memoria | head -n 4',
      type: 'note',
      out: [
        'el dedo decide el ritmo antes de que el ojo entienda',
        'cada gesto abre una promesa de encontrar algo mas abajo',
        'la imagen aparece y se extingue sin cerrar su sentido',
      ],
    },
    {
      cmd: 'tail -n 3 /var/log/cuerpo.log',
      type: 'system',
      out: [
        'frame synced: torso=0.48 motion=0.23',
        'mask drift corrected by temporal filter',
        'build pushed 12px upward',
      ],
    },
    {
      cmd: 'cat manifiesto.txt | sed -n "1,4p"',
      type: 'note',
      out: [
        'scrollear no navega: ensaya una forma de quedarse en flujo',
        'no hay final, solo capas que desplazan otras capas',
        'el archivo respira cuando la mano no para',
      ],
    },
    {
      cmd: 'watch -n 1 "printf \\"scroll=%s\\n\\" $(date +%s)"',
      type: 'system',
      out: [
        'loop activo, tiempo vertical en ejecucion',
        'pulso de pantalla estabilizado',
        'persistencia: OK, fatiga: en aumento',
      ],
    },
  ];

  function buildFeed() {
    const feed = [];

    feed.push({ type: 'note', text: 'Booting Linux terminal simulation...' });
    feed.push({ type: 'system', text: '[ok] tty session mounted at /dev/scroll0' });
    feed.push({ type: 'system', text: '[ok] font loaded: IBM Plex Mono' });

    for (let cycle = 1; cycle <= 46; cycle += 1) {
      const template = chapterTemplates[(cycle - 1) % chapterTemplates.length];
      feed.push({ type: 'command', text: `scrolling@life:~$ ${template.cmd}` });

      template.out.forEach((line) => {
        feed.push({ type: template.type, text: `[${String(cycle).padStart(2, '0')}] ${line}` });
      });
    }

    feed.push({ type: 'command', text: 'scrolling@life:~$ tail -f /var/log/scrolling-life' });
    return feed;
  }

  const feed = buildFeed();

  const state = {
    current: 0,
    target: 0,
    max: Math.max(0, feed.length - 1),
    lineHeight: 24,
    visibleCount: 1,
    renderFrom: -1,
    renderTo: -1,
    auto: false,
    lastTs: 0,
    typedLine: 0,
    typedChars: 0,
    typeCarry: 0,
    typeSpeed: 86,
    dragging: false,
    dragStartY: 0,
    dragStartTarget: 0,
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function escapeHtml(value) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function measureMetrics() {
    const probe = document.createElement('li');
    probe.textContent = '.';
    probe.dataset.line = '0000';
    linesNode.appendChild(probe);
    const measured = probe.getBoundingClientRect().height;
    probe.remove();

    state.lineHeight = measured > 0 ? measured : 24;
    state.visibleCount = Math.max(1, Math.ceil(terminalBody.clientHeight / state.lineHeight) + 2);
  }

  function updateHud() {
    const lineNumber = Math.round(state.current) + 1;
    if (lineLabel) {
      lineLabel.textContent = `${lineNumber} / ${feed.length}`;
    }
    if (modeLabel) {
      modeLabel.textContent = state.auto ? 'auto' : 'manual';
    }

    if (scrollThumb?.parentElement) {
      const trackHeight = scrollThumb.parentElement.clientHeight;
      const thumbHeight = clamp((state.visibleCount / feed.length) * trackHeight, 34, trackHeight);
      const progress = state.max === 0 ? 0 : state.current / state.max;
      const range = Math.max(0, trackHeight - thumbHeight);
      scrollThumb.style.height = `${thumbHeight}px`;
      scrollThumb.style.transform = `translateY(${range * progress}px)`;
    }
  }

  function render(force = false) {
    const start = Math.floor(state.current);
    const offset = state.current - start;
    const from = clamp(start - 1, 0, state.max);
    const to = clamp(from + state.visibleCount, 1, feed.length);

    if (force || from !== state.renderFrom || to !== state.renderTo) {
      const html = [];

      for (let i = from; i < to; i += 1) {
        const entry = feed[i];
        let css = `line-${entry.type}`;
        let text = entry.text;

        if (i === state.typedLine) {
          text = entry.text.slice(0, state.typedChars);
          if (state.typedChars < entry.text.length) {
            css += ' line-cursor';
          }
        }

        html.push(
          `<li class="${css}" data-line="${String(i + 1).padStart(4, '0')}">${escapeHtml(text)}</li>`,
        );
      }

      linesNode.innerHTML = html.join('');
      state.renderFrom = from;
      state.renderTo = to;
    }

    linesNode.style.transform = `translateY(${-offset * state.lineHeight}px)`;
    updateHud();
  }

  function setTarget(value) {
    state.target = clamp(value, 0, state.max);
  }

  function updateTyping(dt) {
    const desiredLine = clamp(Math.floor(state.current), 0, state.max);
    const currentLineLength = feed[state.typedLine].text.length;
    const currentComplete = state.typedChars >= currentLineLength;

    if (desiredLine < state.typedLine) {
      state.typedLine = desiredLine;
      state.typedChars = feed[desiredLine].text.length;
      state.typeCarry = 0;
    } else if (desiredLine > state.typedLine && (currentComplete || desiredLine - state.typedLine > 3)) {
      state.typedLine = desiredLine;
      state.typedChars = 0;
      state.typeCarry = 0;
    }

    const fullLength = feed[state.typedLine].text.length;
    if (state.typedChars >= fullLength) {
      return;
    }

    state.typeCarry += dt * state.typeSpeed;
    const advance = Math.floor(state.typeCarry);
    if (advance <= 0) {
      return;
    }

    state.typeCarry -= advance;
    state.typedChars = Math.min(fullLength, state.typedChars + advance);
  }

  function toggleAuto() {
    state.auto = !state.auto;
    updateHud();
  }

  terminalBody.addEventListener('wheel', (event) => {
    event.preventDefault();
    state.auto = false;
    setTarget(state.target + event.deltaY * 0.036);
  }, { passive: false });

  terminalBody.addEventListener('keydown', (event) => {
    switch (event.code) {
      case 'ArrowDown':
      case 'KeyJ':
        event.preventDefault();
        state.auto = false;
        setTarget(state.target + 2);
        break;
      case 'ArrowUp':
      case 'KeyK':
        event.preventDefault();
        state.auto = false;
        setTarget(state.target - 2);
        break;
      case 'PageDown':
        event.preventDefault();
        state.auto = false;
        setTarget(state.target + state.visibleCount - 2);
        break;
      case 'PageUp':
        event.preventDefault();
        state.auto = false;
        setTarget(state.target - (state.visibleCount - 2));
        break;
      case 'Home':
        event.preventDefault();
        state.auto = false;
        setTarget(0);
        break;
      case 'End':
        event.preventDefault();
        state.auto = false;
        setTarget(state.max);
        break;
      case 'Space':
        event.preventDefault();
        toggleAuto();
        break;
      default:
        break;
    }
  });

  terminalBody.addEventListener('pointerdown', (event) => {
    state.dragging = true;
    state.auto = false;
    state.dragStartY = event.clientY;
    state.dragStartTarget = state.target;
    terminalBody.setPointerCapture(event.pointerId);
  });

  terminalBody.addEventListener('pointermove', (event) => {
    if (!state.dragging) {
      return;
    }
    const delta = state.dragStartY - event.clientY;
    setTarget(state.dragStartTarget + delta * 0.24);
  });

  terminalBody.addEventListener('pointerup', (event) => {
    state.dragging = false;
    terminalBody.releasePointerCapture(event.pointerId);
  });

  terminalBody.addEventListener('pointercancel', () => {
    state.dragging = false;
  });

  window.addEventListener('resize', () => {
    measureMetrics();
    render(true);
  });

  function tick(ts) {
    if (!state.lastTs) {
      state.lastTs = ts;
    }

    const dt = Math.min(0.05, Math.max(0.001, (ts - state.lastTs) / 1000));
    state.lastTs = ts;

    if (state.auto) {
      setTarget(state.target + dt * 12);
      if (state.target >= state.max) {
        state.auto = false;
      }
    }

    const diff = state.target - state.current;
    state.current += diff * Math.min(1, dt * 13);

    if (Math.abs(diff) < 0.0005) {
      state.current = state.target;
    }

    updateTyping(dt);
    render(false);
    requestAnimationFrame(tick);
  }

  measureMetrics();
  render(true);
  terminalBody.focus();
  requestAnimationFrame(tick);
})();

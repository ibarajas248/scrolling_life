(() => {
  "use strict";

  // ---------------------------------------------------------------------------
  // Configuración y constantes
  // ---------------------------------------------------------------------------

  const CONFIG = Object.freeze({
    width: 480,
    height: 640,
    centerX: 240,
    playerY: 414,
    startStep: 10,
    stepGap: 52,
    lookAhead: 1.65,
    maxStepsAhead: 34,
    initialLead: 12.5,
    maxLead: 16,
    fixedStep: 1 / 60,
    maxParticles: window.matchMedia("(max-width: 560px)").matches ? 70 : 120,
    storageKey: "scrolling-life-escape-best-v2"
  });

  const COLORS = Object.freeze({
    void: "#08060a",
    deep: "#120a10",
    wine: "#2b1118",
    rust: "#6a3026",
    amber: "#e7aa58",
    paper: "#f2dfbd",
    danger: "#ff5548",
    dangerDark: "#73181c",
    signal: "#50e6cf",
    signalDark: "#123c38",
    ink: "#100a0d"
  });

  const FRAGMENTS = [
    "SIGUE BAJANDO",
    "ALGO MÁS TE ESPERA",
    "NO CIERRES LA PANTALLA",
    "TODAVÍA NO HAS LLEGADO",
    "CONTINÚA"
  ];

  const END_PHRASES = [
    "Nunca existió el último contenido.",
    "La pantalla todavía tenía algo más.",
    "Bajaste para escapar, pero alimentaste al monstruo.",
    "El final del feed volvió a desplazarse."
  ];

  const STEP_TYPES = Object.freeze({
    normal: "normal",
    unstable: "unstable",
    broken: "broken",
    moving: "moving"
  });

  // ---------------------------------------------------------------------------
  // Referencias de interfaz y estado
  // ---------------------------------------------------------------------------

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const ui = {
    hud: document.getElementById("hud"),
    depth: document.getElementById("depthLabel"),
    best: document.getElementById("bestLabel"),
    lead: document.getElementById("leadLabel"),
    distanceFill: document.getElementById("distanceFill"),
    monsterMeter: document.getElementById("monsterMeter"),
    energy: document.getElementById("energyLabel"),
    energyFill: document.getElementById("energyFill"),
    status: document.getElementById("statusLabel"),
    startScreen: document.getElementById("startScreen"),
    pauseScreen: document.getElementById("pauseScreen"),
    gameOverScreen: document.getElementById("gameOverScreen"),
    finalDepth: document.getElementById("finalDepth"),
    finalBest: document.getElementById("finalBest"),
    gameOverPhrase: document.getElementById("gameOverPhrase"),
    startButton: document.getElementById("startButton"),
    restartButton: document.getElementById("restartButton"),
    resumeButton: document.getElementById("resumeButton"),
    pauseExitButton: document.getElementById("pauseExitButton"),
    pauseButton: document.getElementById("pauseButton"),
    soundButton: document.getElementById("soundButton"),
    soundIcon: document.getElementById("soundIcon"),
    leftButton: document.getElementById("leftButton"),
    rightButton: document.getElementById("rightButton"),
    dashButton: document.getElementById("dashButton")
  };

  const input = {
    left: false,
    right: false,
    dash: false
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sound = typeof window.ScrollSound === "function" ? new window.ScrollSound() : null;
  let soundChoiceMade = false;

  const state = {
    mode: "menu",
    time: 0,
    elapsed: 0,
    progress: CONFIG.startStep,
    currentStep: CONFIG.startStep,
    depth: 0,
    best: loadBest(),
    lead: CONFIG.initialLead,
    energy: 100,
    speed: 2.15,
    difficulty: 0,
    cameraY: 0,
    shake: 0,
    glitch: 0,
    warningFlash: 0,
    hudTimer: 0,
    messageTimer: 0,
    phraseTimer: 3.8,
    phrase: { text: "", x: 0, y: 0, life: 0 },
    steps: [],
    particles: [],
    debris: [],
    player: {
      x: 0,
      velocityX: 0,
      facing: 1,
      moving: 0,
      landing: 0,
      falling: 0,
      invulnerable: 0,
      dashActive: false,
      dashLatch: false
    }
  };

  // ---------------------------------------------------------------------------
  // Utilidades y persistencia
  // ---------------------------------------------------------------------------

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function easeOutCubic(value) {
    const inverse = 1 - value;
    return 1 - inverse * inverse * inverse;
  }

  function randomRange(minimum, maximum) {
    return minimum + Math.random() * (maximum - minimum);
  }

  function randomChoice(values) {
    return values[Math.floor(Math.random() * values.length)];
  }

  function loadBest() {
    try {
      return Math.max(0, Number(localStorage.getItem(CONFIG.storageKey) || 0));
    } catch (error) {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      localStorage.setItem(CONFIG.storageKey, String(Math.floor(value)));
    } catch (error) {
      // El juego continúa aunque el navegador bloquee el almacenamiento.
    }
  }

  function formatDepth(value) {
    return String(Math.max(0, Math.floor(value))).padStart(4, "0") + " m";
  }

  function setText(element, value) {
    if (element.textContent !== value) {
      element.textContent = value;
    }
  }

  function setMessage(message, duration = 2.2) {
    setText(ui.status, message);
    state.messageTimer = duration;
  }

  // ---------------------------------------------------------------------------
  // Generación procedural de escaleras
  // ---------------------------------------------------------------------------

  function getStepX(step, time = state.time) {
    if (step.type !== STEP_TYPES.moving) {
      return step.baseX;
    }
    return step.baseX + Math.sin(time * step.moveSpeed + step.phase) * step.moveAmount;
  }

  function buildStep(index) {
    const previous = state.steps[index - 1] || { baseX: 0 };
    const safeOpening = index < CONFIG.startStep + 13;
    const generationDifficulty = clamp((index - CONFIG.startStep - 18) / 180, 0, 1);
    const maxDrift = lerp(36, 54, generationDifficulty);
    const drift = safeOpening ? randomChoice([-14, 0, 0, 14]) : randomRange(-maxDrift, maxDrift);
    const baseX = safeOpening
      ? lerp(previous.baseX, 0, 0.42)
      : clamp(previous.baseX + drift, -142, 142);
    const width = safeOpening ? 126 : randomChoice([96, 108, 118, 132]);

    let type = STEP_TYPES.normal;
    if (!safeOpening) {
      const roll = Math.random();
      const brokenChance = 0.045 + generationDifficulty * 0.07;
      const unstableChance = brokenChance + 0.09 + generationDifficulty * 0.07;
      const movingChance = unstableChance + 0.075 + generationDifficulty * 0.065;
      if (roll < brokenChance) {
        type = STEP_TYPES.broken;
      } else if (roll < unstableChance) {
        type = STEP_TYPES.unstable;
      } else if (roll < movingChance) {
        type = STEP_TYPES.moving;
      }
    }

    const hasHazard = index > CONFIG.startStep + 13 && Math.random() < 0.075 + generationDifficulty * 0.075;
    const hasPickup = !hasHazard && index > CONFIG.startStep + 8 && Math.random() < 0.13;
    const usableHalf = Math.max(22, width / 2 - 24);

    return {
      index,
      y: index * CONFIG.stepGap,
      baseX,
      width,
      type,
      phase: randomRange(0, Math.PI * 2),
      moveAmount: type === STEP_TYPES.moving ? randomRange(16, 30) : 0,
      moveSpeed: randomRange(0.75, 1.2),
      hazard: hasHazard,
      hazardX: hasHazard ? randomRange(-usableHalf, usableHalf) : 0,
      pickup: hasPickup,
      pickupX: hasPickup ? randomRange(-usableHalf, usableHalf) : 0,
      taken: false,
      triggered: false,
      collapse: 0,
      fragment: index > CONFIG.startStep + 4 && Math.random() < 0.1 ? randomChoice(FRAGMENTS) : ""
    };
  }

  function ensureSteps(upToIndex) {
    while (state.steps.length <= upToIndex) {
      state.steps.push(buildStep(state.steps.length));
    }
  }

  function getStep(index) {
    const safeIndex = Math.max(0, index);
    ensureSteps(safeIndex + CONFIG.maxStepsAhead);
    return state.steps[safeIndex];
  }

  function getPathPoint(progress) {
    const index = Math.floor(progress);
    const amount = progress - index;
    const current = getStep(index);
    const next = getStep(index + 1);
    return {
      x: lerp(getStepX(current), getStepX(next), amount),
      y: lerp(current.y, next.y, amount)
    };
  }

  function createDebris() {
    state.debris.length = 0;
    const amount = reducedMotion ? 12 : 30;
    for (let index = 0; index < amount; index += 1) {
      state.debris.push({
        x: randomRange(18, CONFIG.width - 18),
        y: randomRange(0, CONFIG.height),
        speed: randomRange(10, 30),
        size: randomChoice([1, 2, 2, 3]),
        drift: randomRange(-4, 4),
        tone: Math.random() < 0.22 ? COLORS.danger : "rgba(231, 170, 88, 0.34)"
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Flujo del juego e interfaz
  // ---------------------------------------------------------------------------

  function clearInput() {
    input.left = false;
    input.right = false;
    input.dash = false;
    ui.leftButton.classList.remove("is-active");
    ui.rightButton.classList.remove("is-active");
    ui.dashButton.classList.remove("is-active");
  }

  function resetWorld() {
    state.time = 0;
    state.elapsed = 0;
    state.progress = CONFIG.startStep;
    state.currentStep = CONFIG.startStep;
    state.depth = 0;
    state.lead = CONFIG.initialLead;
    state.energy = 100;
    state.speed = 2.15;
    state.difficulty = 0;
    state.shake = 0;
    state.glitch = 0;
    state.warningFlash = 0;
    state.hudTimer = 0;
    state.messageTimer = 0;
    state.phraseTimer = 3.8;
    state.phrase.life = 0;
    state.steps.length = 0;
    state.particles.length = 0;
    ensureSteps(CONFIG.startStep + 64);
    state.player.x = getStepX(getStep(CONFIG.startStep));
    state.player.velocityX = 0;
    state.player.facing = 1;
    state.player.moving = 0;
    state.player.landing = 0;
    state.player.falling = 0;
    state.player.invulnerable = 0;
    state.player.dashActive = false;
    state.player.dashLatch = false;
    state.cameraY = getPathPoint(CONFIG.startStep + CONFIG.lookAhead).y - CONFIG.playerY;
    createDebris();
    clearInput();
    setMessage("La escalera espera.", 0);
    updateHud(true);
  }

  function hideAllScreens() {
    ui.startScreen.hidden = true;
    ui.pauseScreen.hidden = true;
    ui.gameOverScreen.hidden = true;
  }

  function ensureDefaultSound() {
    if (!sound || soundChoiceMade) {
      return;
    }
    sound.setEnabled(true);
    syncSoundButton();
  }

  function startGame() {
    resetWorld();
    ensureDefaultSound();
    state.mode = "playing";
    hideAllScreens();
    setMessage("Desciende. El feed ya se está moviendo.", 2.8);
    canvas.focus({ preventScroll: true });
  }

  function showMenu() {
    state.mode = "menu";
    resetWorld();
    ui.startScreen.hidden = false;
    ui.pauseScreen.hidden = true;
    ui.gameOverScreen.hidden = true;
    ui.startButton.focus({ preventScroll: true });
  }

  function pauseGame(fromVisibility = false) {
    if (state.mode !== "playing") {
      return;
    }
    state.mode = "paused";
    clearInput();
    ui.pauseScreen.hidden = false;
    if (sound && !fromVisibility) {
      sound.pause();
    }
    if (!fromVisibility) {
      ui.resumeButton.focus({ preventScroll: true });
    }
  }

  function resumeGame() {
    if (state.mode !== "paused") {
      return;
    }
    state.mode = "playing";
    ui.pauseScreen.hidden = true;
    canvas.focus({ preventScroll: true });
  }

  function endGame() {
    if (state.mode === "over") {
      return;
    }
    state.mode = "over";
    clearInput();
    state.best = Math.max(state.best, state.depth);
    saveBest(state.best);
    ui.finalDepth.textContent = formatDepth(state.depth);
    ui.finalBest.textContent = formatDepth(state.best);
    ui.gameOverPhrase.textContent = randomChoice(END_PHRASES);
    ui.gameOverScreen.hidden = false;
    ui.pauseScreen.hidden = true;
    setMessage("El monstruo cerró la distancia.", 0);
    updateHud(true);
    if (sound) {
      sound.gameOver();
    }
    ui.restartButton.focus({ preventScroll: true });
  }

  function syncSoundButton() {
    const enabled = Boolean(sound && sound.enabled);
    ui.soundButton.setAttribute("aria-pressed", String(enabled));
    ui.soundButton.setAttribute("aria-label", enabled ? "Silenciar sonido" : "Activar sonido");
    ui.soundIcon.textContent = enabled ? "◉" : "◌";
  }

  function updateHud(force = false) {
    if (!force && state.hudTimer < 0.075) {
      return;
    }
    state.hudTimer = 0;
    setText(ui.depth, formatDepth(state.depth));
    setText(ui.best, formatDepth(state.best));
    setText(ui.energy, Math.round(state.energy) + "%");

    const leadRatio = clamp(state.lead / CONFIG.maxLead, 0, 1);
    const energyRatio = clamp(state.energy / 100, 0, 1);
    ui.distanceFill.style.transform = `scaleX(${leadRatio.toFixed(3)})`;
    ui.energyFill.style.transform = `scaleX(${energyRatio.toFixed(3)})`;
    ui.monsterMeter.classList.toggle("is-critical", state.lead < 4.2 && state.mode === "playing");

    let leadText = "Estable";
    if (state.lead < 2.8) {
      leadText = "Inminente";
    } else if (state.lead < 5) {
      leadText = "Muy cerca";
    } else if (state.lead < 8) {
      leadText = "Acercándose";
    } else if (state.lead > 13.5) {
      leadText = "Lejos";
    }
    setText(ui.lead, leadText);
  }

  // ---------------------------------------------------------------------------
  // Partículas, efectos y feedback
  // ---------------------------------------------------------------------------

  function spawnParticles(x, y, color, amount, spread = 74) {
    const available = CONFIG.maxParticles - state.particles.length;
    const count = Math.min(amount, Math.max(0, available));
    for (let index = 0; index < count; index += 1) {
      state.particles.push({
        x,
        y,
        velocityX: randomRange(-spread, spread),
        velocityY: randomRange(-96, -24),
        gravity: randomRange(38, 92),
        life: randomRange(0.3, 0.72),
        maxLife: 0,
        size: randomChoice([2, 2, 3, 4]),
        color
      });
      state.particles[state.particles.length - 1].maxLife = state.particles[state.particles.length - 1].life;
    }
  }

  function updateParticles(deltaTime) {
    for (let index = state.particles.length - 1; index >= 0; index -= 1) {
      const particle = state.particles[index];
      particle.life -= deltaTime;
      if (particle.life <= 0) {
        state.particles.splice(index, 1);
        continue;
      }
      particle.x += particle.velocityX * deltaTime;
      particle.y += particle.velocityY * deltaTime;
      particle.velocityY += particle.gravity * deltaTime;
    }
  }

  function updateDebris(deltaTime) {
    for (let index = 0; index < state.debris.length; index += 1) {
      const debris = state.debris[index];
      debris.y -= debris.speed * deltaTime * (1 + state.speed * 0.08);
      debris.x += debris.drift * deltaTime;
      if (debris.y < -8) {
        debris.y = CONFIG.height + randomRange(4, 80);
        debris.x = randomRange(12, CONFIG.width - 12);
      }
    }
  }

  function showFragment() {
    state.phrase.text = randomChoice(FRAGMENTS);
    state.phrase.x = randomRange(42, CONFIG.width - 200);
    state.phrase.y = randomRange(142, CONFIG.height - 120);
    state.phrase.life = reducedMotion ? 1.2 : 2.2;
    state.phraseTimer = randomRange(4.5, 7.5);
  }

  function damage(message, amount) {
    if (state.player.invulnerable > 0 || state.mode !== "playing") {
      return;
    }
    state.player.invulnerable = 0.92;
    state.player.falling = 0.38;
    state.lead -= amount;
    state.energy = clamp(state.energy - 16, 0, 100);
    state.shake = reducedMotion ? 2 : 11;
    state.glitch = reducedMotion ? 0.08 : 0.52;
    state.warningFlash = 0.24;
    setMessage(message, 2.1);
    spawnParticles(CONFIG.centerX + state.player.x, CONFIG.playerY, COLORS.danger, 12, 96);
    if (sound) {
      sound.hit();
    }
    if (state.lead <= 0.35) {
      endGame();
    }
  }

  function collectPickup(step, stepX) {
    if (step.taken) {
      return;
    }
    step.taken = true;
    state.lead = clamp(state.lead + 2.8, 0, CONFIG.maxLead);
    state.energy = clamp(state.energy + 24, 0, 100);
    state.warningFlash = 0.14;
    setMessage("Pulso recuperado. El monstruo pierde tu rastro.", 2.4);
    spawnParticles(CONFIG.centerX + stepX + step.pickupX, CONFIG.playerY - 10, COLORS.signal, 15, 88);
    if (sound) {
      sound.pickup();
    }
  }

  // ---------------------------------------------------------------------------
  // Física, colisiones y dificultad
  // ---------------------------------------------------------------------------

  function resolveLanding(step) {
    if (state.mode !== "playing") {
      return;
    }

    const stepX = getStepX(step);
    const relativeX = state.player.x - stepX;
    const distanceFromCenter = Math.abs(relativeX);
    const forgivingHalf = step.width / 2 + 13;
    state.player.landing = 0.16;

    if (sound) {
      sound.step(step.type);
    }

    if (distanceFromCenter > forgivingHalf) {
      state.player.x = stepX + Math.sign(relativeX || 1) * (step.width / 2 - 7);
      damage("El vacío te rozó. La escalera te devolvió tarde.", 2.65);
      return;
    }

    if (step.type === STEP_TYPES.broken) {
      const gapHalf = 15;
      if (distanceFromCenter < gapHalf + 7) {
        const direction = relativeX === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(relativeX);
        state.player.x = stepX + direction * (gapHalf + 10);
        step.collapse = 1;
        damage("El escalón se abrió bajo tus pies.", 2.25);
        return;
      }
    }

    if (step.type === STEP_TYPES.unstable && !step.triggered) {
      step.triggered = true;
      step.collapse = 0.72;
      state.lead = clamp(state.lead - 0.52, 0, CONFIG.maxLead);
      state.shake = reducedMotion ? 1 : 4;
      setMessage("El escalón tiembla y comienza a borrarse.", 1.8);
      spawnParticles(CONFIG.centerX + stepX, CONFIG.playerY + 10, COLORS.amber, 7, 52);
    } else {
      state.lead = clamp(state.lead + 0.06, 0, CONFIG.maxLead);
    }

    if (step.hazard && Math.abs(relativeX - step.hazardX) < 25) {
      damage("Una notificación roja bloqueó el descenso.", 2.15);
    }

    if (step.pickup && !step.taken && Math.abs(relativeX - step.pickupX) < 30) {
      collectPickup(step, stepX);
    }

    spawnParticles(CONFIG.centerX + state.player.x, CONFIG.playerY + 13, "rgba(231, 170, 88, 0.75)", 4, 34);
  }

  function updateSteps(deltaTime) {
    const first = Math.max(0, Math.floor(state.progress) - 8);
    const last = Math.min(state.steps.length - 1, Math.floor(state.progress) + CONFIG.maxStepsAhead);
    for (let index = first; index <= last; index += 1) {
      const step = state.steps[index];
      if (step.collapse > 0) {
        step.collapse = Math.max(0, step.collapse - deltaTime * 0.55);
      }
    }
  }

  function updateGame(deltaTime) {
    if (state.mode !== "playing") {
      return;
    }

    state.time += deltaTime;
    state.elapsed += deltaTime;
    state.hudTimer += deltaTime;
    state.messageTimer = Math.max(0, state.messageTimer - deltaTime);
    state.phraseTimer -= deltaTime;
    state.phrase.life = Math.max(0, state.phrase.life - deltaTime);
    state.player.landing = Math.max(0, state.player.landing - deltaTime);
    state.player.falling = Math.max(0, state.player.falling - deltaTime);
    state.player.invulnerable = Math.max(0, state.player.invulnerable - deltaTime);
    state.shake = Math.max(0, state.shake - deltaTime * 28);
    state.glitch = Math.max(0, state.glitch - deltaTime * 1.8);
    state.warningFlash = Math.max(0, state.warningFlash - deltaTime);

    if (state.phraseTimer <= 0) {
      showFragment();
    }

    const horizontalInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dashActive = input.dash && state.energy > 1.5;
    const targetVelocity = horizontalInput * (dashActive ? 278 : 224);
    const acceleration = horizontalInput === 0 ? 13 : 18;
    state.player.velocityX = lerp(state.player.velocityX, targetVelocity, 1 - Math.exp(-acceleration * deltaTime));
    state.player.x += state.player.velocityX * deltaTime;
    state.player.x = clamp(state.player.x, -184, 184);
    state.player.moving = lerp(state.player.moving, Math.abs(horizontalInput), 1 - Math.exp(-12 * deltaTime));
    if (horizontalInput !== 0) {
      state.player.facing = horizontalInput;
    }

    if (dashActive) {
      state.energy = clamp(state.energy - 31 * deltaTime, 0, 100);
      state.lead = clamp(state.lead + 0.11 * deltaTime, 0, CONFIG.maxLead);
      if (!state.player.dashLatch && sound) {
        sound.dash();
      }
      state.player.dashLatch = true;
    } else {
      state.energy = clamp(state.energy + 18 * deltaTime, 0, 100);
      state.player.dashLatch = false;
    }
    state.player.dashActive = dashActive;

    state.difficulty = clamp((state.depth - 120) / 1500 + state.elapsed / 180, 0, 1);
    state.speed = lerp(2.08, 3.9, easeOutCubic(state.difficulty));
    const dashDescent = dashActive ? 0.86 : 0;
    state.progress += (state.speed + dashDescent) * deltaTime;
    state.depth = Math.max(0, Math.floor((state.progress - CONFIG.startStep) * 8));

    const cameraTarget = getPathPoint(state.progress + CONFIG.lookAhead).y - CONFIG.playerY;
    state.cameraY = lerp(state.cameraY, cameraTarget, 1 - Math.exp(-7.5 * deltaTime));

    const naturalPressure = lerp(0.075, 0.19, state.difficulty);
    state.lead -= naturalPressure * deltaTime;
    const nextLandedStep = Math.floor(state.progress);
    while (state.currentStep < nextLandedStep && state.mode === "playing") {
      state.currentStep += 1;
      resolveLanding(getStep(state.currentStep));
    }

    updateSteps(deltaTime);
    updateParticles(deltaTime);
    updateDebris(deltaTime);

    if (state.depth > state.best) {
      state.best = state.depth;
      if (state.depth % 40 < 8) {
        saveBest(state.best);
      }
    }

    if (state.messageTimer <= 0 && state.lead < 4.2) {
      setMessage("No mires atrás. Ya ocupa toda la pantalla.", 1.2);
    }

    if (state.lead <= 0.35 && state.mode === "playing") {
      endGame();
    }

    if (sound) {
      const threat = 1 - clamp(state.lead / CONFIG.maxLead, 0, 1);
      sound.setThreat(threat);
    }
    updateHud();
  }

  // ---------------------------------------------------------------------------
  // Renderizado pixelado y profundidad
  // ---------------------------------------------------------------------------

  const backgroundGradient = ctx.createLinearGradient(0, 0, 0, CONFIG.height);
  backgroundGradient.addColorStop(0, "#180c13");
  backgroundGradient.addColorStop(0.48, "#10090f");
  backgroundGradient.addColorStop(1, "#060508");

  const fogGradient = ctx.createLinearGradient(0, 0, 0, CONFIG.height);
  fogGradient.addColorStop(0, "rgba(59, 24, 31, 0.34)");
  fogGradient.addColorStop(0.38, "rgba(22, 13, 18, 0.02)");
  fogGradient.addColorStop(1, "rgba(5, 4, 7, 0.52)");

  const vignetteGradient = ctx.createRadialGradient(
    CONFIG.centerX,
    CONFIG.height * 0.46,
    100,
    CONFIG.centerX,
    CONFIG.height * 0.48,
    390
  );
  vignetteGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignetteGradient.addColorStop(1, "rgba(0, 0, 0, 0.72)");

  function pixelRect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  function drawQuad(x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(Math.round(x1), Math.round(y1));
    ctx.lineTo(Math.round(x2), Math.round(y2));
    ctx.lineTo(Math.round(x3), Math.round(y3));
    ctx.lineTo(Math.round(x4), Math.round(y4));
    ctx.closePath();
    ctx.fill();
  }

  function drawBackground() {
    ctx.fillStyle = backgroundGradient;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    const farOffset = (state.cameraY * 0.09) % 96;
    const middleOffset = (state.cameraY * 0.18) % 128;

    for (let index = -2; index < 9; index += 1) {
      const y = Math.round(index * 96 + farOffset);
      pixelRect(0, y, 76, 54, index % 2 ? "#1b0d16" : "#251119");
      pixelRect(CONFIG.width - 76, y + 22, 76, 54, index % 2 ? "#251119" : "#1b0d16");
      pixelRect(18, y + 16, 42, 2, "rgba(231, 170, 88, 0.12)");
      pixelRect(CONFIG.width - 60, y + 38, 42, 2, "rgba(231, 170, 88, 0.1)");
    }

    drawQuad(70, 0, 145, 0, 190, CONFIG.height, 18, CONFIG.height, "rgba(75, 30, 32, 0.16)");
    drawQuad(CONFIG.width - 145, 0, CONFIG.width - 70, 0, CONFIG.width - 18, CONFIG.height, CONFIG.width - 190, CONFIG.height, "rgba(75, 30, 32, 0.16)");

    for (let index = -1; index < 7; index += 1) {
      const y = Math.round(index * 128 + middleOffset);
      pixelRect(32, y, 3, 48, "#6a392b");
      pixelRect(CONFIG.width - 35, y + 38, 3, 48, "#6a392b");
      pixelRect(36, y + 8, 12, 3, "rgba(255, 85, 72, 0.32)");
      pixelRect(CONFIG.width - 48, y + 46, 12, 3, "rgba(80, 230, 207, 0.2)");
    }

    const vanishingY = 66;
    ctx.strokeStyle = "rgba(231, 170, 88, 0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(22, CONFIG.height);
    ctx.lineTo(CONFIG.centerX - 24, vanishingY);
    ctx.moveTo(CONFIG.width - 22, CONFIG.height);
    ctx.lineTo(CONFIG.centerX + 24, vanishingY);
    ctx.stroke();

    for (let index = 0; index < state.debris.length; index += 1) {
      const debris = state.debris[index];
      pixelRect(debris.x, debris.y, debris.size, debris.size * 1.8, debris.tone);
    }
  }

  function getPerspective(screenY) {
    return clamp(0.46 + (screenY / CONFIG.height) * 0.94, 0.42, 1.4);
  }

  function drawStepSegment(centerX, screenY, width, scale, colors, collapse) {
    const skew = 9 * scale;
    const topDepth = 7 * scale;
    const faceDepth = 13 * scale * (1 - collapse * 0.55);
    const drop = collapse * 18;
    const y = screenY + drop;
    drawQuad(
      centerX - width / 2,
      y,
      centerX + width / 2,
      y,
      centerX + width / 2 + skew,
      y + topDepth,
      centerX - width / 2 + skew,
      y + topDepth,
      colors.top
    );
    drawQuad(
      centerX - width / 2 + skew,
      y + topDepth,
      centerX + width / 2 + skew,
      y + topDepth,
      centerX + width / 2 + skew,
      y + topDepth + faceDepth,
      centerX - width / 2 + skew,
      y + topDepth + faceDepth,
      colors.face
    );
    pixelRect(centerX - width / 2 + 2, y, Math.max(1, width - 4), Math.max(1, scale), colors.edge);
  }

  function drawStep(step) {
    const screenY = step.y - state.cameraY;
    if (screenY < -55 || screenY > CONFIG.height + 60) {
      return;
    }

    const scale = getPerspective(screenY);
    const stepX = getStepX(step);
    const centerX = CONFIG.centerX + stepX * scale * 0.93;
    const width = step.width * scale;
    let colors = { top: "#b9824f", face: "#593025", edge: "#e3bd78" };
    if (step.type === STEP_TYPES.unstable) {
      colors = { top: "#916143", face: "#47242a", edge: "#d29a5b" };
    } else if (step.type === STEP_TYPES.moving) {
      colors = { top: "#987350", face: "#3f3131", edge: "#d7b77d" };
    } else if (step.type === STEP_TYPES.broken) {
      colors = { top: "#81503d", face: "#3a1d24", edge: "#b77652" };
    }

    if (step.type === STEP_TYPES.broken) {
      const gap = 30 * scale;
      const segmentWidth = Math.max(12, (width - gap) / 2);
      drawStepSegment(centerX - (gap + segmentWidth) / 2, screenY, segmentWidth, scale, colors, step.collapse);
      drawStepSegment(centerX + (gap + segmentWidth) / 2, screenY, segmentWidth, scale, colors, step.collapse);
      pixelRect(centerX - gap / 2 + 2, screenY + 5 * scale, gap - 4, 4 * scale, "rgba(0, 0, 0, 0.62)");
    } else {
      drawStepSegment(centerX, screenY, width, scale, colors, step.collapse);
    }

    if (step.type === STEP_TYPES.unstable) {
      pixelRect(centerX - 18 * scale, screenY + 3 * scale, 14 * scale, 2 * scale, "#321721");
      pixelRect(centerX + 4 * scale, screenY + 5 * scale, 19 * scale, 2 * scale, "#321721");
    }

    if (step.type === STEP_TYPES.moving) {
      const arrowY = screenY + 3 * scale;
      pixelRect(centerX - 12 * scale, arrowY, 24 * scale, 2 * scale, "rgba(80, 230, 207, 0.38)");
      pixelRect(centerX - 14 * scale, arrowY - 2 * scale, 4 * scale, 6 * scale, "rgba(80, 230, 207, 0.38)");
      pixelRect(centerX + 10 * scale, arrowY - 2 * scale, 4 * scale, 6 * scale, "rgba(80, 230, 207, 0.38)");
    }

    if (step.hazard) {
      const hazardX = centerX + step.hazardX * scale;
      const hazardY = screenY - 13 * scale;
      pixelRect(hazardX - 14 * scale, hazardY, 28 * scale, 15 * scale, COLORS.dangerDark);
      pixelRect(hazardX - 12 * scale, hazardY + 2 * scale, 24 * scale, 3 * scale, COLORS.danger);
      pixelRect(hazardX - 9 * scale, hazardY + 8 * scale, 13 * scale, 2 * scale, "#f0a093");
      pixelRect(hazardX + 7 * scale, hazardY + 8 * scale, 3 * scale, 3 * scale, "#ffd0c6");
    }

    if (step.pickup && !step.taken) {
      const pickupX = centerX + step.pickupX * scale;
      const pickupY = screenY - 15 * scale + Math.sin(state.time * 5 + step.phase) * 2;
      ctx.globalAlpha = 0.22;
      pixelRect(pickupX - 9 * scale, pickupY - 9 * scale, 18 * scale, 18 * scale, COLORS.signal);
      ctx.globalAlpha = 1;
      drawQuad(pickupX, pickupY - 8 * scale, pickupX + 7 * scale, pickupY, pickupX, pickupY + 8 * scale, pickupX - 7 * scale, pickupY, COLORS.signal);
      pixelRect(pickupX - 2 * scale, pickupY - 2 * scale, 4 * scale, 4 * scale, "#effffb");
    }

    if (step.fragment && screenY > 70 && screenY < CONFIG.height - 80) {
      ctx.save();
      ctx.globalAlpha = clamp(0.07 + scale * 0.03, 0.07, 0.14);
      ctx.fillStyle = COLORS.paper;
      ctx.font = `${Math.max(7, Math.round(8 * scale))}px "Courier New"`;
      ctx.fillText(step.fragment, clamp(centerX - width / 2, 10, CONFIG.width - 150), screenY - 20 * scale);
      ctx.restore();
    }
  }

  function drawMonster() {
    const closeness = 1 - clamp(state.lead / CONFIG.maxLead, 0, 1);
    const eased = closeness * closeness;
    const y = lerp(66, CONFIG.playerY - 74, eased);
    const size = lerp(72, 214, eased);
    const path = getPathPoint(Math.max(0, state.progress - Math.max(1.2, state.lead * 0.72)));
    const x = CONFIG.centerX + lerp(path.x * 0.5, state.player.x * 0.22, eased);
    const jitter = closeness > 0.62 && !reducedMotion ? Math.sin(state.time * 31) * closeness * 2 : 0;
    const left = x - size / 2 + jitter;
    const top = y - size * 0.34;

    ctx.save();
    ctx.globalAlpha = 0.52 + closeness * 0.42;
    pixelRect(left - 18, top + size * 0.28, size + 36, size * 0.5, "rgba(20, 7, 14, 0.76)");

    for (let index = 0; index < 7; index += 1) {
      const cardWidth = size * randomCardWidth(index);
      const cardHeight = size * (0.105 + (index % 3) * 0.018);
      const cardX = left + ((index * 37) % Math.max(1, size - cardWidth));
      const cardY = top + ((index * 29) % Math.max(1, size * 0.62));
      pixelRect(cardX, cardY, cardWidth, cardHeight, index % 3 === 0 ? "#5a1820" : "#2b1118");
      pixelRect(cardX + 3, cardY + 3, cardWidth * 0.62, Math.max(2, cardHeight * 0.16), index % 2 ? "#b9734d" : "#d9b57c");
      pixelRect(cardX + 3, cardY + cardHeight * 0.56, cardWidth * 0.38, Math.max(2, cardHeight * 0.12), "#7e4c45");
    }

    const eyeY = top + size * 0.38;
    const eyeGap = size * 0.19;
    const eyeSize = Math.max(9, size * 0.11);
    pixelRect(x - eyeGap - eyeSize / 2, eyeY, eyeSize, eyeSize * 0.72, COLORS.paper);
    pixelRect(x + eyeGap - eyeSize / 2, eyeY, eyeSize, eyeSize * 0.72, COLORS.paper);
    pixelRect(x - eyeGap - 1, eyeY + 2, Math.max(3, eyeSize * 0.34), Math.max(4, eyeSize * 0.46), COLORS.danger);
    pixelRect(x + eyeGap - 1, eyeY + 2, Math.max(3, eyeSize * 0.34), Math.max(4, eyeSize * 0.46), COLORS.danger);

    pixelRect(x - size * 0.22, top + size * 0.58, size * 0.44, Math.max(8, size * 0.1), COLORS.ink);
    for (let index = 0; index < 5; index += 1) {
      pixelRect(x - size * 0.18 + index * size * 0.085, top + size * 0.58, Math.max(2, size * 0.035), Math.max(4, size * 0.06), COLORS.paper);
    }

    const badgeSize = Math.max(16, size * 0.16);
    pixelRect(left + size * 0.72, top - badgeSize * 0.25, badgeSize, badgeSize, COLORS.danger);
    ctx.fillStyle = "#fff2dc";
    ctx.font = `bold ${Math.max(8, Math.round(badgeSize * 0.42))}px "Courier New"`;
    ctx.fillText("99+", left + size * 0.74, top + badgeSize * 0.37);

    drawQuad(
      left + size * 0.08,
      top + size * 0.12,
      left + size * 0.24,
      top + size * 0.31,
      left + size * 0.16,
      top + size * 0.3,
      left + size * 0.13,
      top + size * 0.41,
      COLORS.paper
    );
    ctx.restore();
  }

  function randomCardWidth(index) {
    return 0.34 + ((index * 17) % 22) / 100;
  }

  function drawPlayer() {
    const player = state.player;
    if (player.invulnerable > 0 && Math.floor(state.time * 18) % 2 === 0) {
      return;
    }

    const x = CONFIG.centerX + player.x;
    const walkCycle = Math.sin(state.time * 13) * player.moving;
    const landingSquash = player.landing > 0 ? Math.sin((player.landing / 0.16) * Math.PI) * 3 : 0;
    const fallOffset = player.falling > 0 ? Math.sin((1 - player.falling / 0.38) * Math.PI) * 12 : 0;
    const y = CONFIG.playerY - 31 + landingSquash + fallOffset;

    if (player.dashActive) {
      for (let index = 1; index <= 3; index += 1) {
        ctx.globalAlpha = 0.22 / index;
        pixelRect(x - player.facing * index * 11 - 7, y + 12, 13, 18, COLORS.signal);
      }
      ctx.globalAlpha = 1;
    }

    pixelRect(x - 10, CONFIG.playerY + 3, 20, 4, "rgba(0, 0, 0, 0.55)");
    pixelRect(x - 6, y + 5, 12, 10, "#d4a06c");
    pixelRect(x - 7, y + 3, 14, 5, "#21151a");
    pixelRect(x - 8, y + 15, 16, 17, "#20413f");
    pixelRect(x - 6, y + 18, 12, 4, COLORS.signalDark);
    pixelRect(x - 11, y + 17 + walkCycle * 2, 4, 13, "#d4a06c");
    pixelRect(x + 7, y + 17 - walkCycle * 2, 4, 13, "#d4a06c");
    pixelRect(x - 6, y + 31, 5, 9 + walkCycle * 2, "#12151a");
    pixelRect(x + 1, y + 31, 5, 9 - walkCycle * 2, "#12151a");
    pixelRect(x - 7 + player.facing * 2, y + 9, 2, 2, COLORS.ink);
    pixelRect(x + 1 + player.facing * 2, y + 9, 2, 2, COLORS.ink);
    pixelRect(x - 3, y, 6, 4, COLORS.signal);
  }

  function drawParticles() {
    for (let index = 0; index < state.particles.length; index += 1) {
      const particle = state.particles[index];
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      pixelRect(particle.x, particle.y, particle.size, particle.size, particle.color);
    }
    ctx.globalAlpha = 1;
  }

  function drawPhrase() {
    if (state.phrase.life <= 0) {
      return;
    }
    const alpha = clamp(Math.min(state.phrase.life, 2.2 - state.phrase.life) * 0.42, 0, 0.55);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "bold 11px \"Courier New\"";
    ctx.fillStyle = state.lead < 5 ? COLORS.danger : COLORS.paper;
    ctx.fillText(state.phrase.text, state.phrase.x, state.phrase.y);
    pixelRect(state.phrase.x, state.phrase.y + 5, 42, 1, state.lead < 5 ? COLORS.danger : COLORS.amber);
    ctx.restore();
  }

  function drawForegroundEffects() {
    ctx.fillStyle = fogGradient;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    ctx.fillStyle = vignetteGradient;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    const closeness = 1 - clamp(state.lead / CONFIG.maxLead, 0, 1);
    if (closeness > 0.56 || state.glitch > 0) {
      const intensity = Math.max(state.glitch, (closeness - 0.56) * 0.82);
      const strips = reducedMotion ? 1 : 2 + Math.floor(intensity * 6);
      ctx.save();
      ctx.globalAlpha = clamp(intensity, 0.08, 0.62);
      for (let index = 0; index < strips; index += 1) {
        const y = Math.floor(randomRange(28, CONFIG.height - 24));
        const height = randomChoice([1, 2, 3, 5]);
        pixelRect(randomRange(0, 70), y, randomRange(90, CONFIG.width), height, index % 2 ? COLORS.danger : COLORS.signal);
      }
      ctx.restore();
    }

    if (state.warningFlash > 0) {
      ctx.globalAlpha = clamp(state.warningFlash * 0.8, 0, 0.18);
      pixelRect(0, 0, CONFIG.width, CONFIG.height, state.lead < 4 ? COLORS.danger : COLORS.signal);
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    const shakeX = state.shake > 0 && !reducedMotion ? randomRange(-state.shake, state.shake) : 0;
    const shakeY = state.shake > 0 && !reducedMotion ? randomRange(-state.shake * 0.5, state.shake * 0.5) : 0;
    ctx.save();
    ctx.translate(Math.round(shakeX), Math.round(shakeY));
    drawBackground();

    const start = Math.max(0, Math.floor(state.progress) - 12);
    const end = Math.floor(state.progress) + CONFIG.maxStepsAhead;
    ensureSteps(end + 2);
    for (let index = start; index <= end; index += 1) {
      drawStep(getStep(index));
    }

    drawMonster();
    drawPlayer();
    drawParticles();
    drawPhrase();
    drawForegroundEffects();
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Entrada por teclado y controles táctiles
  // ---------------------------------------------------------------------------

  function setInput(direction, active, button) {
    input[direction] = active;
    if (button) {
      button.classList.toggle("is-active", active);
    }
  }

  function bindPointer(button, direction) {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      setInput(direction, true, button);
    });

    const release = (event) => {
      event.preventDefault();
      setInput(direction, false, button);
    };

    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  }

  const blockedKeys = new Set([
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Space",
    "ShiftLeft",
    "ShiftRight",
    "KeyA",
    "KeyD"
  ]);

  document.addEventListener("keydown", (event) => {
    if (blockedKeys.has(event.code)) {
      event.preventDefault();
    }

    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      input.left = true;
    } else if (event.code === "ArrowRight" || event.code === "KeyD") {
      input.right = true;
    } else if (event.code === "ShiftLeft" || event.code === "ShiftRight" || event.code === "Space") {
      input.dash = true;
    } else if (event.code === "Escape") {
      event.preventDefault();
      if (state.mode === "playing") {
        pauseGame();
      } else if (state.mode === "paused") {
        resumeGame();
      }
    } else if (event.code === "Enter" && state.mode === "menu") {
      startGame();
    } else if (event.code === "KeyR" && state.mode === "over") {
      startGame();
    }
  }, { passive: false });

  document.addEventListener("keyup", (event) => {
    if (blockedKeys.has(event.code)) {
      event.preventDefault();
    }
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      input.left = false;
    } else if (event.code === "ArrowRight" || event.code === "KeyD") {
      input.right = false;
    } else if (event.code === "ShiftLeft" || event.code === "ShiftRight" || event.code === "Space") {
      input.dash = false;
    }
  }, { passive: false });

  bindPointer(ui.leftButton, "left");
  bindPointer(ui.rightButton, "right");
  bindPointer(ui.dashButton, "dash");

  ui.startButton.addEventListener("click", startGame);
  ui.restartButton.addEventListener("click", startGame);
  ui.resumeButton.addEventListener("click", resumeGame);
  ui.pauseExitButton.addEventListener("click", showMenu);
  ui.pauseButton.addEventListener("click", () => {
    if (state.mode === "playing") {
      pauseGame();
    } else if (state.mode === "paused") {
      resumeGame();
    }
  });
  ui.soundButton.addEventListener("click", () => {
    soundChoiceMade = true;
    if (sound) {
      sound.toggle();
    }
    syncSoundButton();
  });

  // ---------------------------------------------------------------------------
  // Loop de juego con delta fijo y pausa de pestaña
  // ---------------------------------------------------------------------------

  let animationFrameId = 0;
  let lastFrameTime = performance.now();
  let accumulator = 0;

  function loop(now) {
    animationFrameId = 0;
    const frameDelta = Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000));
    lastFrameTime = now;
    accumulator = Math.min(0.12, accumulator + frameDelta);

    while (accumulator >= CONFIG.fixedStep) {
      updateGame(CONFIG.fixedStep);
      accumulator -= CONFIG.fixedStep;
    }

    draw();
    if (!document.hidden) {
      animationFrameId = requestAnimationFrame(loop);
    }
  }

  function startLoop() {
    if (animationFrameId || document.hidden) {
      return;
    }
    lastFrameTime = performance.now();
    accumulator = 0;
    animationFrameId = requestAnimationFrame(loop);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
      pauseGame(true);
      return;
    }
    startLoop();
  });

  window.addEventListener("blur", clearInput);

  resetWorld();
  syncSoundButton();
  draw();
  startLoop();

  window.__escapeScroll = Object.freeze({
    getState: () => ({
      mode: state.mode,
      depth: state.depth,
      lead: state.lead,
      energy: state.energy,
      best: state.best
    })
  });
})();

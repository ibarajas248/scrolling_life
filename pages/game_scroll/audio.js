(() => {
  "use strict";

  class ScrollSound {
    constructor() {
      this.context = null;
      this.master = null;
      this.ambientGain = null;
      this.threatFilter = null;
      this.enabled = false;
      this.started = false;
    }

    unlock() {
      if (!this.context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          return false;
        }

        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.context.destination);
        this.buildAmbience();
      }

      if (this.context.state === "suspended") {
        this.context.resume();
      }

      return true;
    }

    buildAmbience() {
      if (!this.context || this.started) {
        return;
      }

      const ctx = this.context;
      this.started = true;
      this.ambientGain = ctx.createGain();
      this.ambientGain.gain.value = 0.18;
      this.threatFilter = ctx.createBiquadFilter();
      this.threatFilter.type = "lowpass";
      this.threatFilter.frequency.value = 780;
      this.threatFilter.Q.value = 1.6;
      this.threatFilter.connect(this.ambientGain);
      this.ambientGain.connect(this.master);

      const droneA = ctx.createOscillator();
      const droneAGain = ctx.createGain();
      droneA.type = "sawtooth";
      droneA.frequency.value = 43;
      droneAGain.gain.value = 0.055;
      droneA.connect(droneAGain);
      droneAGain.connect(this.threatFilter);
      droneA.start();

      const droneB = ctx.createOscillator();
      const droneBGain = ctx.createGain();
      droneB.type = "sine";
      droneB.frequency.value = 67;
      droneBGain.gain.value = 0.075;
      droneB.connect(droneBGain);
      droneBGain.connect(this.threatFilter);
      droneB.start();

      const noiseLength = Math.floor(ctx.sampleRate * 2);
      const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < noiseLength; i += 1) {
        const white = Math.random() * 2 - 1;
        last = last * 0.985 + white * 0.015;
        noiseData[i] = last * 1.7;
      }
      const noise = ctx.createBufferSource();
      const noiseGain = ctx.createGain();
      noise.buffer = noiseBuffer;
      noise.loop = true;
      noiseGain.gain.value = 0.1;
      noise.connect(noiseGain);
      noiseGain.connect(this.threatFilter);
      noise.start();
    }

    setEnabled(enabled) {
      if (enabled && !this.unlock()) {
        return false;
      }

      this.enabled = Boolean(enabled);
      if (this.master && this.context) {
        const now = this.context.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setTargetAtTime(this.enabled ? 0.62 : 0, now, 0.04);
      }
      return this.enabled;
    }

    toggle() {
      return this.setEnabled(!this.enabled);
    }

    setThreat(amount) {
      if (!this.enabled || !this.context || !this.threatFilter || !this.ambientGain) {
        return;
      }
      const closeness = Math.max(0, Math.min(1, amount));
      const now = this.context.currentTime;
      this.threatFilter.frequency.setTargetAtTime(760 + closeness * 1750, now, 0.08);
      this.threatFilter.detune.setTargetAtTime(closeness * 115, now, 0.1);
      this.ambientGain.gain.setTargetAtTime(0.16 + closeness * 0.2, now, 0.08);
    }

    tone(frequency, duration, options = {}) {
      if (!this.enabled || !this.context || !this.master) {
        return;
      }

      const ctx = this.context;
      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = options.type || "square";
      oscillator.frequency.setValueAtTime(frequency, now);
      if (options.endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.endFrequency), now + duration);
      }
      gain.gain.setValueAtTime(options.volume || 0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(this.master);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    }

    step(type = "normal") {
      const tones = {
        normal: [105, 0.045],
        unstable: [82, 0.08],
        broken: [64, 0.1],
        moving: [124, 0.05]
      };
      const [frequency, duration] = tones[type] || tones.normal;
      this.tone(frequency, duration, { volume: 0.052, type: "square", endFrequency: frequency * 0.72 });
    }

    dash() {
      this.tone(190, 0.2, { volume: 0.085, type: "sawtooth", endFrequency: 520 });
    }

    pickup() {
      this.tone(520, 0.16, { volume: 0.09, type: "square", endFrequency: 880 });
      window.setTimeout(() => this.tone(760, 0.13, { volume: 0.065, type: "sine", endFrequency: 980 }), 70);
    }

    hit() {
      this.tone(118, 0.28, { volume: 0.12, type: "sawtooth", endFrequency: 36 });
    }

    gameOver() {
      this.tone(86, 0.7, { volume: 0.13, type: "sawtooth", endFrequency: 24 });
    }

    pause() {
      this.tone(230, 0.09, { volume: 0.05, type: "square", endFrequency: 170 });
    }
  }

  window.ScrollSound = ScrollSound;
})();

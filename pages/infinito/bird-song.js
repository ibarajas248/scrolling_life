(() => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  let audio;
  let timer;
  let unlocking = false;
  const interval = 40000;

  const sing = () => {
    if (document.hidden || audio?.state !== 'running') return;

    // Short rising whistles and a descending trill, with a soft retro timbre.
    const notes = [
      [0, 1800, 2900, 0.13],
      [0.19, 2100, 3400, 0.12],
      [0.39, 2500, 3800, 0.17],
      [0.76, 3200, 2400, 0.1],
      [0.9, 2900, 2200, 0.1],
      [1.04, 2600, 1800, 0.16],
      [1.34, 1900, 3000, 0.2],
    ];
    const start = audio.currentTime + 0.03;
    notes.forEach(([offset, from, to, duration]) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const at = start + offset;
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(from, at);
      oscillator.frequency.exponentialRampToValueAtTime(to, at + duration * 0.7);
      oscillator.frequency.exponentialRampToValueAtTime(to * 0.82, at + duration);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.045, at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
      gain.gain.setValueAtTime(0, at + duration + 0.01);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(at);
      oscillator.stop(at + duration + 0.02);
    });
  };

  const unlock = async (event) => {
    if (event.type === 'keydown' && (event.repeat || ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key))) return;
    if (unlocking || audio?.state === 'running') return;
    unlocking = true;
    try {
      audio ||= new AudioContext();
      await audio.resume();
      if (audio.state === 'running' && !timer) {
        sing();
        timer = window.setInterval(sing, interval);
      }
    } catch {
      // Retry on the next interaction if the browser has not allowed audio yet.
    } finally {
      unlocking = false;
    }
  };

  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('keydown', unlock);
  window.addEventListener('pagehide', () => {
    window.clearInterval(timer);
    timer = undefined;
    if (audio) void audio.close().catch(() => {});
    audio = undefined;
  });
})();

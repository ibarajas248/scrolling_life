/** Marco lógico del celular (9:16, resolución de presentación). */
export const PHONE_WIDTH = 1080;
export const PHONE_HEIGHT = 1920;

export function createPhoneStage() {
  const shell = document.createElement('div');
  shell.id = 'phone-shell';

  const stage = document.createElement('div');
  stage.id = 'phone-stage';

  shell.appendChild(stage);
  document.body.appendChild(shell);

  function fit() {
    const scale = Math.min(
      (shell.clientWidth - 32) / PHONE_WIDTH,
      (shell.clientHeight - 32) / PHONE_HEIGHT,
    );
    stage.style.transform = `scale(${scale})`;
  }

  window.addEventListener('resize', fit);
  new ResizeObserver(fit).observe(shell);
  fit();

  return { shell, stage, fit };
}

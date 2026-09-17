/**
 * Cambia la expresión intercambiando el PNG completo (sin modificar la ilustración).
 * @param {object} faceParts
 * @param {'neutral'|'feliz'|'triste'|'enojado'|'sorprendido'} state
 */
export function setExpression(faceParts, state) {
  const key = faceParts.textures[state] ? state : 'neutral';
  // Siempre aplicar el mapa del video actual (1 emoción = 1 PNG)
  faceParts.material.map = faceParts.textures[key];
  faceParts.material.needsUpdate = true;
  faceParts.current = key;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { articleUrl, allowedResource, parseRobots, retryDelay } from '../policy.mjs';

test('only canonical Spanish article URLs; fragments normalize, namespaces and actions fail closed', () => {
  assert.equal(articleUrl('/wiki/Arte#Historia'), 'https://es.wikipedia.org/wiki/Arte');
  for (const url of ['/w/index.php?title=Arte', '/wiki/Arte?oldid=2', '/wiki/Especial:Aleatoria', '/wiki/Archivo%3AImagen.jpg',
    'https://en.wikipedia.org/wiki/Art', 'https://evil.example/wiki/Arte', '/wiki/A%2FB', '/wiki/%ZZ', '/wiki/']) assert.equal(articleUrl(url), null, url);
});
test('subresources cannot become a general web proxy or navigate other namespaces', () => {
  assert.ok(allowedResource('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/X.jpg/320px-X.jpg', 'image'));
  assert.ok(allowedResource('https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/X.jpg/320px-X.jpg?utm_source=es.wikipedia.org', 'image'));
  assert.ok(allowedResource('https://es.wikipedia.org/w/load.php?modules=skins.vector.styles', 'stylesheet'));
  assert.ok(!allowedResource('https://es.wikipedia.org/w/api.php?action=query', 'xhr'));
  assert.ok(!allowedResource('https://upload.wikimedia.org/wikipedia/commons/a/a1/X.jpg', 'document'));
  assert.ok(!allowedResource('https://evil.example/x.png', 'image'));
  assert.ok(!allowedResource('https://es.wikipedia.org:8443/wiki/Arte', 'document'));
});
test('robots wildcard, specific rules and query allowances are enforced', () => {
  const rules = parseRobots('https://es.wikipedia.org', 'User-agent: *\nDisallow: /w/\nAllow: /w/load.php?\nDisallow: /wiki/Privado*\n');
  assert.equal(rules.isAllowed('https://es.wikipedia.org/wiki/Arte', 'ScrollingLifeBot/1.0'), true);
  assert.equal(rules.isAllowed('https://es.wikipedia.org/wiki/Privado_X', 'ScrollingLifeBot/1.0'), false);
  assert.equal(rules.isAllowed('https://es.wikipedia.org/w/load.php?modules=x', 'ScrollingLifeBot/1.0'), true);
  assert.throws(() => parseRobots('https://es.wikipedia.org', '<html>Blocked</html>'));
});
test('Retry-After seconds/date never shortened by a backoff cap', () => {
  assert.equal(retryDelay(429, '7200'), 7_200_000);
  assert.equal(retryDelay(429, new Date(8_000_000).toUTCString(), 0, 0), 8_000_000);
  assert.equal(retryDelay(503, null), 900_000);
  assert.equal(retryDelay(403, null, 2), 3_600_000);
  assert.equal(retryDelay(429, 'bad'), 60_000);
});

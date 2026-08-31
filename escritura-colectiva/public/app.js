const API_ROOT = './api';
const MAX_TEXT_LENGTH = 2400;

const writerForm = document.getElementById('writerForm');
const authorInput = document.getElementById('authorInput');
const textInput = document.getElementById('textInput');
const textCounter = document.getElementById('textCounter');
const fragmentList = document.getElementById('fragmentList');
const fragmentTemplate = document.getElementById('fragmentTemplate');
const fragmentCount = document.getElementById('fragmentCount');
const emptyState = document.getElementById('emptyState');
const connectionStatus = document.getElementById('connectionStatus');
const statusCopy = connectionStatus?.querySelector('[data-status-copy]');

let fragments = [];
let loading = false;
let eventSource = null;
let fallbackPoll = null;

const apiUrl = (path) => `${API_ROOT}${path}`;

const setStatus = (state, copy) => {
  if (!connectionStatus || !statusCopy) return;
  connectionStatus.dataset.state = state;
  statusCopy.textContent = copy;
};

const storedAuthor = () => {
  try {
    return window.localStorage.getItem('collective-scroll-author') || '';
  } catch {
    return '';
  }
};

const rememberAuthor = (author) => {
  try {
    window.localStorage.setItem('collective-scroll-author', author);
  } catch {
    return;
  }
};

const trackInteraction = (eventType, details = {}) => {
  if (typeof window.ScrollingLifeTrack === 'function') {
    window.ScrollingLifeTrack(eventType, {
      app: 'escritura-colectiva',
      ...details,
    });
  }
};

const formatTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const updateCounter = () => {
  textCounter.textContent = `${textInput.value.length} / ${MAX_TEXT_LENGTH}`;
};

const requestJson = async (path, options = {}) => {
  const response = await fetch(apiUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'No se pudo completar la accion.');
  }
  return payload;
};

const loadFragments = async ({ quiet = false } = {}) => {
  if (loading) return;
  loading = true;
  if (!quiet) setStatus('syncing', 'sincronizando');

  try {
    const payload = await requestJson('/fragments', { method: 'GET', headers: {} });
    fragments = Array.isArray(payload.fragments) ? payload.fragments : [];
    renderFragments();
    setStatus('live', 'en vivo');
  } catch (error) {
    console.error(error);
    setStatus('offline', 'sin conexion');
  } finally {
    loading = false;
  }
};

const renderFragments = () => {
  fragmentList.replaceChildren();
  fragmentCount.textContent = String(fragments.length);
  emptyState.hidden = fragments.length > 0;

  const fragmentNodes = fragments.map((fragment) => createFragmentNode(fragment));
  fragmentList.append(...fragmentNodes);
};

const createFragmentNode = (fragment) => {
  const node = fragmentTemplate.content.firstElementChild.cloneNode(true);
  const card = node.querySelector('.fragment-card');
  const author = node.querySelector('[data-fragment-author]');
  const time = node.querySelector('[data-fragment-time]');
  const text = node.querySelector('[data-fragment-text]');
  const editButton = node.querySelector('[data-edit-fragment]');
  const deleteButton = node.querySelector('[data-delete-fragment]');
  const editForm = node.querySelector('[data-edit-form]');
  const editText = node.querySelector('[data-edit-text]');
  const cancelEdit = node.querySelector('[data-cancel-edit]');

  node.dataset.fragmentId = fragment.id;
  author.textContent = fragment.author || 'anonimo';
  time.dateTime = fragment.createdAt;
  time.textContent = formatTime(fragment.createdAt);
  text.textContent = fragment.text;
  editText.value = fragment.text;

  editButton.addEventListener('click', () => {
    card.classList.add('is-editing');
    text.hidden = true;
    editForm.hidden = false;
    editText.focus();
  });

  cancelEdit.addEventListener('click', () => {
    editText.value = fragment.text;
    editForm.hidden = true;
    text.hidden = false;
    card.classList.remove('is-editing');
  });

  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const nextText = editText.value.trim();
    if (!nextText) return;

    setStatus('syncing', 'guardando');
    try {
      const updated = await requestJson(`/fragments/${encodeURIComponent(fragment.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ text: nextText }),
      });
      trackInteraction('collective_fragment_updated', {
        fragmentId: updated.fragment?.id || fragment.id,
        textLength: nextText.length,
      });
      await loadFragments({ quiet: true });
    } catch (error) {
      console.error(error);
      window.alert(error.message);
      setStatus('live', 'en vivo');
    }
  });

  deleteButton.addEventListener('click', async () => {
    const confirmed = window.confirm('Borrar este fragmento del scroll?');
    if (!confirmed) return;

    setStatus('syncing', 'borrando');
    try {
      const deleted = await requestJson(`/fragments/${encodeURIComponent(fragment.id)}`, {
        method: 'DELETE',
        headers: {},
      });
      trackInteraction('collective_fragment_deleted', {
        fragmentId: deleted.id || fragment.id,
      });
      await loadFragments({ quiet: true });
    } catch (error) {
      console.error(error);
      window.alert(error.message);
      setStatus('live', 'en vivo');
    }
  });

  return node;
};

const submitFragment = async (event) => {
  event.preventDefault();
  const text = textInput.value.trim();
  const author = authorInput.value.trim() || 'anonimo';
  if (!text) return;

  const submitButton = writerForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setStatus('syncing', 'publicando');

  try {
    rememberAuthor(author);
    const created = await requestJson('/fragments', {
      method: 'POST',
      body: JSON.stringify({ author, text }),
    });
    trackInteraction('collective_fragment_created', {
      fragmentId: created.fragment?.id || '',
      textLength: text.length,
      authorLength: author.length,
    });
    textInput.value = '';
    updateCounter();
    await loadFragments({ quiet: true });
  } catch (error) {
    console.error(error);
    window.alert(error.message);
    setStatus('live', 'en vivo');
  } finally {
    submitButton.disabled = false;
    textInput.focus();
  }
};

const connectEvents = () => {
  if (!('EventSource' in window)) {
    fallbackPoll = window.setInterval(() => loadFragments({ quiet: true }), 4000);
    return;
  }

  eventSource = new EventSource(apiUrl('/events'));

  eventSource.addEventListener('open', () => {
    setStatus('live', 'en vivo');
  });

  eventSource.addEventListener('message', (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.action && payload.action !== 'hello') {
        loadFragments({ quiet: true });
      }
      setStatus('live', 'en vivo');
    } catch (error) {
      console.error(error);
    }
  });

  eventSource.addEventListener('error', () => {
    setStatus('offline', 'reconectando');
  });
};

authorInput.value = storedAuthor();
textInput.addEventListener('input', updateCounter);
writerForm.addEventListener('submit', submitFragment);
window.addEventListener('beforeunload', () => {
  eventSource?.close();
  if (fallbackPoll) {
    window.clearInterval(fallbackPoll);
  }
});

updateCounter();
loadFragments();
connectEvents();

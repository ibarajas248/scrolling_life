const CSV_URL = '../../assets/data/commons_gif_index.csv';
const SAMPLE_CSV_URL = '../../assets/data/commons_gif_index_sample.csv';

const elements = {
  totalRows: document.getElementById('totalRows'),
  visibleRows: document.getElementById('visibleRows'),
  pageRows: document.getElementById('pageRows'),
  sourceMode: document.getElementById('sourceMode'),
  statusLine: document.getElementById('statusLine'),
  searchInput: document.getElementById('searchInput'),
  licenseFilter: document.getElementById('licenseFilter'),
  sizeFilter: document.getElementById('sizeFilter'),
  sortSelect: document.getElementById('sortSelect'),
  pageSizeSelect: document.getElementById('pageSizeSelect'),
  prevButton: document.getElementById('prevButton'),
  randomButton: document.getElementById('randomButton'),
  nextButton: document.getElementById('nextButton'),
  catalogGrid: document.getElementById('catalogGrid'),
  rangeLabel: document.getElementById('rangeLabel'),
  focusImage: document.getElementById('focusImage'),
  focusEmpty: document.getElementById('focusEmpty'),
  focusTitle: document.getElementById('focusTitle'),
  focusLicense: document.getElementById('focusLicense'),
  focusSize: document.getElementById('focusSize'),
  focusDimensions: document.getElementById('focusDimensions'),
  focusArtist: document.getElementById('focusArtist'),
  sourceLink: document.getElementById('sourceLink'),
  originalLink: document.getElementById('originalLink'),
  copyButton: document.getElementById('copyButton')
};

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

const state = {
  rows: [],
  filteredRows: [],
  page: 0,
  pageSize: Number(elements.pageSizeSelect.value),
  activeOriginalUrl: '',
  sourceLabel: 'csv'
};

const formatNumber = (value) => new Intl.NumberFormat('es-CO').format(value);

const stripFilePrefix = (title) => title.replace(/^File:/i, '').replace(/_/g, ' ');

const compactText = (value, fallback = '-') => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
};

const formatSize = (row) => {
  const sizeMb = Number(row.size_mb);
  if (Number.isFinite(sizeMb) && sizeMb > 0) {
    return `${sizeMb.toLocaleString('es-CO', { maximumFractionDigits: 2 })} MB`;
  }

  const bytes = Number(row.size_bytes);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '-';
  }

  return `${(bytes / 1048576).toLocaleString('es-CO', { maximumFractionDigits: 2 })} MB`;
};

const parseCsv = (text) => {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      row.push(current);
      if (row.some((cell) => cell.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim().length > 0)) {
    rows.push(row);
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, '').trim());
  return rows.map((cells) => {
    const entry = {};
    headers.forEach((header, index) => {
      entry[header] = cells[index] ?? '';
    });
    return entry;
  });
};

const normalizeRow = (row, index) => {
  const title = compactText(row.title || row.file_name, `GIF ${index + 1}`);
  const fileName = compactText(row.file_name || title, title);
  const originalUrl = compactText(row.original_url, '');
  const previewUrl = compactText(row.preview_url || row.thumb_url || originalUrl, originalUrl);
  const license = compactText(row.license, 'licencia libre');
  const artist = compactText(row.artist || row.credit, 'Wikimedia Commons');
  const sourcePage = compactText(row.source_page, 'https://commons.wikimedia.org/');
  const sizeBytes = Number(row.size_bytes) || 0;
  const sizeMb = Number(row.size_mb) || (sizeBytes > 0 ? sizeBytes / 1048576 : 0);
  const width = Number(row.width) || 0;
  const height = Number(row.height) || 0;
  const searchable = [
    title,
    fileName,
    license,
    artist,
    row.credit,
    sourcePage
  ].join(' ').toLowerCase();

  return {
    ...row,
    index: Number(row.index) || index + 1,
    title,
    displayTitle: stripFilePrefix(title),
    file_name: fileName,
    source_page: sourcePage,
    preview_url: previewUrl,
    original_url: originalUrl,
    license,
    license_url: compactText(row.license_url, ''),
    artist,
    credit: compactText(row.credit, ''),
    size_bytes: sizeBytes,
    size_mb: sizeMb,
    width,
    height,
    searchable
  };
};

const setStatus = (message) => {
  elements.statusLine.textContent = message;
};

const fetchCsv = async (url) => {
  const response = await fetch(`${url}?ts=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`CSV no disponible: ${response.status}`);
  }
  return response.text();
};

const loadRows = async () => {
  try {
    const csv = await fetchCsv(CSV_URL);
    state.sourceLabel = 'principal';
    return parseCsv(csv);
  } catch (primaryError) {
    console.warn('CSV principal no disponible, usando muestra local.', primaryError);
    const sampleCsv = await fetchCsv(SAMPLE_CSV_URL);
    state.sourceLabel = 'muestra';
    return parseCsv(sampleCsv);
  }
};

const updateLicenseOptions = () => {
  const licenses = [...new Set(state.rows.map((row) => row.license).filter(Boolean))]
    .sort((a, b) => collator.compare(a, b));

  const current = elements.licenseFilter.value;
  elements.licenseFilter.innerHTML = '<option value="">todas</option>';

  licenses.forEach((license) => {
    const option = document.createElement('option');
    option.value = license;
    option.textContent = license;
    elements.licenseFilter.append(option);
  });

  if (licenses.includes(current)) {
    elements.licenseFilter.value = current;
  }
};

const matchesSize = (row, sizeFilter) => {
  if (!sizeFilter) return true;

  const size = Number(row.size_mb) || 0;
  if (sizeFilter === 'tiny') return size < 1;
  if (sizeFilter === 'small') return size >= 1 && size < 5;
  if (sizeFilter === 'medium') return size >= 5 && size < 20;
  if (sizeFilter === 'heavy') return size >= 20;
  return true;
};

const sortRows = (rows) => {
  const sortMode = elements.sortSelect.value;
  const sorted = [...rows];

  if (sortMode === 'title') {
    sorted.sort((a, b) => collator.compare(a.displayTitle, b.displayTitle));
  } else if (sortMode === 'size-desc') {
    sorted.sort((a, b) => b.size_mb - a.size_mb);
  } else if (sortMode === 'size-asc') {
    sorted.sort((a, b) => a.size_mb - b.size_mb);
  } else {
    sorted.sort((a, b) => a.index - b.index);
  }

  return sorted;
};

const applyFilters = ({ keepPage = false } = {}) => {
  const query = elements.searchInput.value.trim().toLowerCase();
  const license = elements.licenseFilter.value;
  const sizeFilter = elements.sizeFilter.value;

  state.filteredRows = sortRows(state.rows.filter((row) => {
    const matchesQuery = !query || row.searchable.includes(query);
    const matchesLicense = !license || row.license === license;
    return matchesQuery && matchesLicense && matchesSize(row, sizeFilter);
  }));

  state.pageSize = Number(elements.pageSizeSelect.value) || 72;
  const maxPage = Math.max(0, Math.ceil(state.filteredRows.length / state.pageSize) - 1);
  state.page = keepPage ? Math.min(state.page, maxPage) : 0;
  if (!state.filteredRows.some((row) => row.original_url === state.activeOriginalUrl)) {
    state.activeOriginalUrl = '';
  }

  render();
};

const createCard = (row) => {
  const card = document.createElement('article');
  card.className = 'gif-card';
  if (row.original_url === state.activeOriginalUrl) {
    card.classList.add('is-active');
  }

  const button = document.createElement('button');
  button.className = 'thumb-button';
  button.type = 'button';
  button.setAttribute('aria-label', `Seleccionar ${row.displayTitle}`);

  const thumbShell = document.createElement('span');
  thumbShell.className = 'thumb-shell';

  const image = document.createElement('img');
  image.src = row.preview_url;
  image.alt = row.displayTitle;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  image.addEventListener('error', () => {
    thumbShell.classList.add('is-broken');
  }, { once: true });

  thumbShell.append(image);
  button.append(thumbShell);
  button.addEventListener('click', () => {
    setActiveRow(row);
  });

  const copy = document.createElement('div');
  copy.className = 'card-copy';

  const title = document.createElement('p');
  title.className = 'card-title';
  title.textContent = row.displayTitle;

  const meta = document.createElement('p');
  meta.className = 'card-meta';

  const license = document.createElement('span');
  license.className = 'card-license';
  license.textContent = row.license;

  const size = document.createElement('span');
  size.textContent = formatSize(row);

  meta.append(license, size);
  copy.append(title, meta);
  card.append(button, copy);

  return card;
};

const renderGrid = () => {
  elements.catalogGrid.innerHTML = '';

  if (state.filteredRows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-grid';
    empty.textContent = 'sin resultados';
    elements.catalogGrid.append(empty);
    elements.rangeLabel.textContent = '0-0';
    return;
  }

  const start = state.page * state.pageSize;
  const end = Math.min(start + state.pageSize, state.filteredRows.length);
  const fragment = document.createDocumentFragment();
  state.filteredRows.slice(start, end).forEach((row) => {
    fragment.append(createCard(row));
  });

  elements.catalogGrid.append(fragment);
  elements.rangeLabel.textContent = `${formatNumber(start + 1)}-${formatNumber(end)}`;
};

const setActiveRow = (row) => {
  if (!row) return;

  state.activeOriginalUrl = row.original_url;
  elements.focusImage.src = row.preview_url || row.original_url;
  elements.focusImage.alt = row.displayTitle;
  elements.focusImage.parentElement.classList.add('has-image');
  elements.focusTitle.textContent = row.displayTitle;
  elements.focusLicense.textContent = row.license;
  elements.focusSize.textContent = formatSize(row);
  elements.focusDimensions.textContent = row.width && row.height ? `${row.width} x ${row.height}` : '-';
  elements.focusArtist.textContent = row.artist;
  elements.sourceLink.href = row.source_page;
  elements.originalLink.href = row.original_url || row.source_page;

  renderGrid();
};

const render = () => {
  const totalPages = Math.max(1, Math.ceil(state.filteredRows.length / state.pageSize));
  const pageLabel = state.filteredRows.length > 0 ? `${state.page + 1}/${totalPages}` : '0/0';

  elements.totalRows.textContent = formatNumber(state.rows.length);
  elements.visibleRows.textContent = formatNumber(state.filteredRows.length);
  elements.pageRows.textContent = pageLabel;
  elements.sourceMode.textContent = state.sourceLabel;
  elements.prevButton.disabled = state.page <= 0;
  elements.nextButton.disabled = state.page >= totalPages - 1 || state.filteredRows.length === 0;

  renderGrid();

  if (!state.activeOriginalUrl && state.filteredRows.length > 0) {
    setActiveRow(state.filteredRows[0]);
  }
};

const goToPage = (direction) => {
  const totalPages = Math.max(1, Math.ceil(state.filteredRows.length / state.pageSize));
  state.page = Math.min(totalPages - 1, Math.max(0, state.page + direction));
  render();
};

const selectRandom = () => {
  if (state.filteredRows.length === 0) return;

  const index = Math.floor(Math.random() * state.filteredRows.length);
  const row = state.filteredRows[index];
  state.page = Math.floor(index / state.pageSize);
  setActiveRow(row);
};

const copyActiveUrl = async () => {
  const activeRow = state.rows.find((row) => row.original_url === state.activeOriginalUrl);
  if (!activeRow) return;

  try {
    await navigator.clipboard.writeText(activeRow.original_url);
    setStatus('URL copiada.');
  } catch (error) {
    console.warn('No se pudo copiar con Clipboard API.', error);
    setStatus(activeRow.original_url);
  }
};

const init = async () => {
  try {
    const rawRows = await loadRows();
    state.rows = rawRows
      .map(normalizeRow)
      .filter((row) => row.original_url && row.preview_url);

    updateLicenseOptions();
    applyFilters();

    const statusPrefix = state.sourceLabel === 'muestra' ? 'Muestra local cargada' : 'CSV principal cargado';
    setStatus(`${statusPrefix}: ${formatNumber(state.rows.length)} GIFs indexados.`);
  } catch (error) {
    console.error(error);
    setStatus('No se pudo cargar el CSV.');
    elements.sourceMode.textContent = 'error';
    elements.catalogGrid.innerHTML = '<div class="empty-grid">csv no disponible</div>';
  }
};

elements.searchInput.addEventListener('input', () => applyFilters());
elements.licenseFilter.addEventListener('change', () => applyFilters());
elements.sizeFilter.addEventListener('change', () => applyFilters());
elements.sortSelect.addEventListener('change', () => applyFilters());
elements.pageSizeSelect.addEventListener('change', () => applyFilters());
elements.prevButton.addEventListener('click', () => goToPage(-1));
elements.nextButton.addEventListener('click', () => goToPage(1));
elements.randomButton.addEventListener('click', selectRandom);
elements.copyButton.addEventListener('click', copyActiveUrl);

init();

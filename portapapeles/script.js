(() => {
  const canvas = document.querySelector('#canvas');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const base = local ? `${location.protocol}//${location.hostname}:8095` : '';
  const endpoint = `${base}/api/lienzo`;
  const items = new Map();
  const undoKey = 'portapapeles-own-uploads';
  let undoStack = [];
  try { undoStack = JSON.parse(localStorage.getItem(undoKey) || '[]'); } catch {}
  if (!Array.isArray(undoStack)) undoStack = [];
  undoStack = undoStack.filter(entry => entry && typeof entry.id === 'string' && typeof entry.token === 'string');
  const saveUndo = () => { try { localStorage.setItem(undoKey, JSON.stringify(undoStack)); } catch {} };
  let initialPosition = true;
  let revision = 0;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  let height = innerHeight * 3, anchor = null, dragging = null, busy = false;
  let queue = Promise.resolve();
  const widthOf = item => Math.min(360, item.width, innerWidth * .7);
  const position = item => ({ left: item.x * Math.max(1, innerWidth - widthOf(item)), top: item.y });
  function extend(y = scrollY + innerHeight * 3) {
    height = Math.max(height, y);
    canvas.style.height = `${height}px`;
  }
  function draw(entry) {
    const {item, img} = entry, p = position(item);
    img.style.width = `${widthOf(item)}px`;
    img.style.left = `${p.left}px`;
    img.style.top = `${p.top}px`;
    extend(item.y + widthOf(item) * item.height / item.width + innerHeight * 2);
  }
  async function request(url, options) {
    const response = await fetch(url, {cache: 'no-store', ...options});
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || 'No se pudo guardar.');
      error.status = response.status;
      throw error;
    }
    return data;
  }
  async function sync() {
    const atRevision = revision;
    const data = await request(endpoint);
    if (dragging || busy || atRevision !== revision) return;
    const live = new Set(data.images.map(item => item.id));
    for (const [id, entry] of items) if (!live.has(id)) { entry.img.remove(); items.delete(id); }
    for (const item of data.images) {
      let entry = items.get(item.id);
      if (!entry) {
        const img = new Image();
        img.alt = ''; img.draggable = false; img.decoding = 'async'; img.loading = 'lazy';
        img.src = `${endpoint}/images/${item.id}.webp`;
        img.addEventListener('pointerdown', event => startDrag(event, item.id));
        entry = {item, img}; items.set(item.id, entry); canvas.append(img);
      } else entry.item = item;
      draw(entry);
    }
    undoStack = undoStack.filter(entry => live.has(entry.id));
    saveUndo();
    if (initialPosition) {
      initialPosition = false;
      const latest = data.images.at(-1);
      if (latest) {
        const renderedHeight = widthOf(latest) * latest.height / latest.width;
        scrollTo(0, Math.max(0, latest.y - (innerHeight - Math.min(renderedHeight, innerHeight)) / 2));
      } else scrollTo(0, 0);
    }
  }
  function startDrag(event, id) {
    if (event.button !== 0 || busy || dragging) return;
    const entry = items.get(id), p = position(entry.item);
    dragging = {entry, original: {...entry.item}, offsetX: event.clientX-p.left, offsetY: event.clientY+scrollY-p.top, x:event.clientX, y:event.clientY, pointer:event.pointerId};
    entry.img.setPointerCapture(event.pointerId);
    entry.img.classList.add('dragging');
    event.preventDefault();
  }
  function moveDrag() {
    if (!dragging) return;
    const {entry, offsetX, offsetY, x, y} = dragging;
    const available = Math.max(1, innerWidth-widthOf(entry.item));
    entry.item.x = Math.max(0, Math.min(1, (x-offsetX)/available));
    entry.item.y = Math.max(0, y+scrollY-offsetY);
    draw(entry);
  }
  document.addEventListener('pointermove', event => {
    if (!dragging) return;
    dragging.x=event.clientX; dragging.y=event.clientY; moveDrag();
  });
  async function endDrag(event) {
    if (!dragging || event.pointerId !== dragging.pointer) return;
    const current=dragging; dragging=null;
    current.entry.img.classList.remove('dragging');
    current.entry.img.releasePointerCapture(event.pointerId);
    if (event.type === 'pointercancel') { current.entry.item=current.original; draw(current.entry); return; }
    busy=true;
    revision++;
    try {
      await request(endpoint,{method:'PATCH',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(current.entry.item)});
    } catch(error) { current.entry.item=current.original; draw(current.entry); alert(error.message); }
    finally { busy=false; }
  }
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerdown', event => {
    if (event.target===canvas) anchor={x:event.clientX, y:event.clientY+scrollY};
  });
  async function compress(file) {
    const bitmap=await createImageBitmap(file);
    try {
      const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
      const surface=document.createElement('canvas');
      surface.width=Math.max(1,Math.round(bitmap.width*scale)); surface.height=Math.max(1,Math.round(bitmap.height*scale));
      surface.getContext('2d').drawImage(bitmap,0,0,surface.width,surface.height);
      const blob=await new Promise(resolve=>surface.toBlob(resolve,'image/webp',.62));
      if(!blob || blob.size>2_000_000) throw new Error('No se pudo comprimir esta imagen.');
      return {blob,width:surface.width};
    } finally { bitmap.close(); }
  }
  document.addEventListener('paste', event => {
    const files=[...event.clipboardData.items].filter(item=>item.kind==='file' && item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);
    if(!files.length) return;
    event.preventDefault();
    const destination=anchor && anchor.y>=scrollY && anchor.y<=scrollY+innerHeight ? {...anchor} : {x:innerWidth/2,y:scrollY+innerHeight*.3};
    queue=queue.then(async()=>{
      busy=true;
      try {
        for(let i=0;i<files.length;i++) {
          const {blob,width}=await compress(files[i]);
          const w=Math.min(360,width,innerWidth*.7);
          const x=Math.max(0,Math.min(1,(destination.x-w/2+i*24)/Math.max(1,innerWidth-w)));
          revision++;
          const result = await request(`${endpoint}?x=${x}&y=${Math.max(0,destination.y+i*24)}`,{method:'POST',headers:{'Content-Type':blob.type},body:blob});
          if (result.image.deleteToken) {
            undoStack.push({id: result.image.id, token: result.image.deleteToken});
            saveUndo();
          }
        }
      } finally { busy=false; await sync(); }
    }).catch(error=>alert(`No se pudo pegar: ${error.message}`));
  });
  document.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey || event.key.toLowerCase() !== 'z') return;
    if (event.target.closest('input, textarea, [contenteditable="true"]')) return;
    event.preventDefault();
    if (dragging || busy || event.repeat || !undoStack.length) return;
    busy = true;
    revision++;
    queue = queue.then(async () => {
      try {
        while (undoStack.length) {
          const entry = undoStack.at(-1);
          try {
            await request(endpoint, {method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify(entry)});
            undoStack.pop(); saveUndo();
            items.get(entry.id)?.img.remove(); items.delete(entry.id);
            break;
          } catch (error) {
            if (error.status === 404 || error.status === 403) { undoStack.pop(); saveUndo(); continue; }
            throw error;
          }
        }
      } finally { busy = false; await sync(); }
    }).catch(error => alert(`No se pudo deshacer: ${error.message}`));
  });
  addEventListener('scroll',()=>extend(),{passive:true});
  addEventListener('resize',()=>{ for(const entry of items.values()) draw(entry); extend(); });
  function tick() {
    if(dragging) {
      const speed=dragging.y>innerHeight-70?14:dragging.y<70?-14:0;
      if(speed) { extend(); scrollBy(0,speed); moveDrag(); }
    }
    requestAnimationFrame(tick);
  }
  extend(); tick();
  sync().catch(error=>{ console.error(error); alert('No se pudo cargar el archivo de imágenes. Recarga para volver a intentarlo.'); });
  setInterval(()=>{ if(!busy && !dragging && !document.hidden) sync().catch(console.error); },5000);
})();

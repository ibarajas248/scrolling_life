/* LOGIC / DREAM — interfaz sin dependencias. Todo el estado permanece en memoria.
 * No se usan fetch, cookies, almacenamiento remoto ni ejecución de código importado.
 */
(function () {
  'use strict';
  const $=id=>document.getElementById(id), $$=sel=>Array.from(document.querySelectorAll(sel));
  function hiddenControl(id,tag='div',value=''){
    let el=$(id);
    if(el)return el;
    el=document.createElement(tag);el.id=id;el.hidden=true;
    if(value!==''&&'value'in el)el.value=value;
    document.body.append(el);return el;
  }
  hiddenControl('prompt','textarea','la máquina sueña con ');
  hiddenControl('normalization-note');hiddenControl('generation-note');hiddenControl('generated-count');
  hiddenControl('compute-time');hiddenControl('multiply-count');hiddenControl('play-label','span');
  hiddenControl('play-icon','span');hiddenControl('run-status','span');hiddenControl('play','button');
  hiddenControl('step','button');hiddenControl('reset','button');hiddenControl('clear-prompt','button');
  hiddenControl('copy-text','button');hiddenControl('speed','input','5').type='range';hiddenControl('speed-label','output');
  const limitEl=hiddenControl('limit','select');if(!limitEl.options.length)limitEl.add(new Option('∞','Infinity',true,true));
  hiddenControl('temperature','input','.75').type='range';hiddenControl('temperature-label','output');
  const topKEl=hiddenControl('top-k','select');if(!topKEl.options.length)topKEl.add(new Option('Todos','0',true,true));
  hiddenControl('random-seed','input','248').type='number';hiddenControl('new-seed','button');
  const layerEl=hiddenControl('layer-select','select');if(!layerEl.options.length){layerEl.add(new Option('01','0',true,true));layerEl.add(new Option('02','1'));}
  hiddenControl('follow-last','button');hiddenControl('session-file','input').type='file';
  hiddenControl('inspect-body');hiddenControl('model-card-body');hiddenControl('param-short');
  hiddenControl('process-mode','span');hiddenControl('process-caption','span');hiddenControl('process-pulse','span');
  hiddenControl('export-menu');hiddenControl('export-toggle','button');hiddenControl('import-session','button');
  hiddenControl('prediction');hiddenControl('toast');hiddenControl('a11y-status');
  const E=window.DreamEngine, data=window.LOGIC_DREAM_MODEL;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const displayGlyph=c=>c===' '?'␣':c==='\n'?'↵':c;
  const charName=c=>c===' '?'espacio':c==='\n'?'salto de línea':c;
  const fmt=(x,n=4)=>Number.isFinite(x)?(Math.abs(x)<.5*10**-n?0:x).toFixed(n):x===-Infinity?'−∞':'—';
  const pct=x=>x===0?'0.00':x<.0001?'<0.01':(100*x).toFixed(2);
  const num=x=>Math.round(x).toLocaleString('es-CO'), clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const compact=x=>x>=1e6?(x/1e6).toFixed(2)+' M':x>=1e3?(x/1e3).toFixed(1)+' k':String(x);
  const colors={bg:'#020842',grid:'#17409f',off:'#061765',on:'#69dce6',cyan:'#21bfd3',purple:'#d45bd1',quiet:'#78a9cc',text:'#cce8f5',hot:'#a8eef3',deep:'#001057'};
  let M, rng, timer=null, debounce=null, resizeTimer=null, toastTimer=null, watchdog=null, lastTickAt=0;
  const S={prompt:$('prompt').value,generated:'',playing:false,view:'attention',layer:0,head:0,q:0,key:0,follow:true,keyAuto:true,vecDim:0,opType:'q',opDim:7,term:0,termAuto:true,allTerms:false,circuitRow:0,circuitBit:0,circuitAuto:true,kmap:'carry',history:[],temperature:.75,topK:0,seed:248,speed:5,limit:Infinity,trace:null,enc:null,dist:null,inferenceMs:0,heatGeom:null,visualMode:'attention'};
  const hasLimit=()=>Number.isFinite(S.limit);
  const limitReached=()=>hasLimit()&&S.generated.length>=S.limit;
  const limitLabel=()=>hasLimit()?S.limit:'∞';
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3800);}
  function announce(message){$('a11y-status').textContent=message;}
  function valColor(value,scale=1){
    const strength=Math.min(1,Math.abs(value)/Math.max(1e-8,scale));
    const c=value>=0?[105,220,230]:[212,91,209],base=[6,23,101];
    const f=.14+.70*strength;return `rgb(${base.map((v,i)=>Math.round(v+(c[i]-v)*f)).join(',')})`;
  }
  function magnitude(a){let max=.001;for(const v of a)max=Math.max(max,Math.abs(v));return max;}
  function textSeed(){return M.normalize(S.prompt).text;}
  function encodedText(){return textSeed()+S.generated;}
  function recompute(){
    S.enc=M.encode(encodedText());const start=performance.now();S.trace=M.forward(S.enc.ids);S.inferenceMs=performance.now()-start;
    const t=S.trace;
    S.q=S.follow?t.N-1:clamp(S.q,0,t.N-1);S.key=clamp(S.key,0,t.N-1);
    if(S.keyAuto){const a=t.layers[S.layer].attention,off=S.head*t.N*t.N+S.q*t.N;let best=0;for(let k=1;k<=S.q;k++)if(a[off+k]>a[off+best])best=k;S.key=best;}
    S.dist=E.distribution(t.logits,S.temperature,S.topK);
    renderAll();
  }
  function isNetart(){return document.body.classList.contains('netart-mode');}
  function renderAll(){
    renderConsole();renderProcessVisual();
    if(isNetart())return;
    renderPipeline();renderProbabilities();renderInspector();renderArchitecture();
  }
  function setStatus(){
    $('play-label').textContent=S.playing?'Pausar':'Generar';$('play-icon').textContent=S.playing?'Ⅱ':'▶';
    $('run-status').textContent=S.playing?'GENERANDO EN TU NAVEGADOR':limitReached()?'LÍMITE ALCANZADO':'LISTO PARA EXPLORAR';
    $('run-status').classList.toggle('running',S.playing);document.body.classList.toggle('is-running',S.playing);
    $('step').disabled=S.playing||limitReached();$('play').disabled=!S.playing&&limitReached();
    $('generated-count').textContent=S.generated.length+' / '+limitLabel();
  }
  function renderConsole(){
    const norm=M.normalize(S.prompt),n=S.enc;
    $('output').innerHTML=`<span class="seed-text">${esc(norm.text)}</span><span>${esc(S.generated.slice(0,-1))}</span>${S.generated?`<span class="latest">${esc(S.generated.slice(-1))}</span>`:''}<span class="cursor" aria-hidden="true"></span>`;
    $('output').scrollTop=$('output').scrollHeight;
    const notes=[];
    if(norm.unknown)notes.push(`${norm.unknown} carácter${norm.unknown===1?'':'es'} no conocido${norm.unknown===1?'':'s'} → «?»: ${norm.replaced.slice(0,5).join(' ')}`);
    if(norm.text!==S.prompt&&!norm.unknown)notes.push('Entrada normalizada a minúsculas y Unicode NFC.');
    if(!norm.text&&!S.generated)notes.push('Sin semilla: se usa ↵ como carácter de inicio.');
    if(n.offset)notes.push(`Se usan las últimas 64 posiciones; ${n.offset} quedaron fuera del contexto.`);
    if(!notes.length)notes.push(`${Array.from(norm.text).length} / 256 caracteres de entrada · minúsculas · sin red.`);
    $('normalization-note').textContent=notes.join(' ');$('normalization-note').classList.toggle('warn',!!norm.unknown||n.offset>0);
    $('generation-note').textContent=S.playing?'Cada nuevo carácter vuelve a entrar al modelo. La escritura sigue sin límite.':limitReached()?'Límite alcanzado. Amplía el límite o reinicia.':'Cada nuevo carácter vuelve a entrar al modelo.';
    $('compute-time').textContent=fmt(S.inferenceMs,1);$('compute-time').title='Tiempo medido de la inferencia, sin el renderizado.';
    $('multiply-count').textContent=compact(S.trace.multiplications);$('multiply-count').title='Multiplicaciones en matrices densas y atención causal. No incluye normalizaciones ni softmax.';
    setStatus();
  }
  function renderPipeline(){
    const t=S.trace,last=t.N-1,L=t.layers[S.layer];
    $('pipeline-context').textContent=`${t.N} / ${M.config.context} posiciones`;
    $('pipeline-options').textContent=`${t.V} caracteres posibles`;
    $('preview-tokens').textContent=S.enc.chars.slice(-5).map(displayGlyph).join(' ');
    const vec=t.x0.slice(last*t.D,last*t.D+24),mlp=L.hidden.slice(last*t.F,last*t.F+24);
    $('preview-vectors').innerHTML=Array.from(vec,v=>`<i style="background:${valColor(v,magnitude(vec))}"></i>`).join('');
    $('preview-mlp').innerHTML=Array.from(mlp,v=>`<i style="background:${valColor(v,magnitude(mlp))}"></i>`).join('');
    const a=Array.from(L.attention.slice(S.head*t.N*t.N+last*t.N,S.head*t.N*t.N+(last+1)*t.N));
    const av=a.length>12?a.slice(-12):a,amax=Math.max(...av,.001);
    $('preview-attention').innerHTML=av.map(v=>`<i style="height:${2+25*v/amax}px;background:${valColor(v,amax)}"></i>`).join('');
    const ps=S.dist.order.slice(0,8).map(i=>S.dist.probabilities[i]),max=Math.max(...ps,.001);
    $('preview-probs').innerHTML=ps.map(v=>`<i style="height:${2+25*v/max}px;background:${valColor(v,max)}"></i>`).join('');
    $('preview-sample').textContent=S.history.length?displayGlyph(S.history.at(-1).char):'_';
    $$('#pipeline button').forEach(b=>b.classList.toggle('active',b.dataset.stage===S.view||(S.view==='circuits'&&b.dataset.stage==='operations')));
  }
  function randomVisualMode(){
    const modes=['attention','probabilities','vectors','operations','logits','entropy','context','activations'];
    if(!S.history.length||S.history.length%8===0)S.visualMode=modes[Math.floor(Math.random()*modes.length)];
  }
  function renderProcessVisual(){
    if(!$('process-visual'))return;
    randomVisualMode();
    const mode=S.visualMode,t=S.trace,last=t.N-1,L=t.layers[S.layer];
    const modeLabels={attention:'atención real',probabilities:'probabilidades reales',vectors:'vectores reales',operations:'operaciones reales',logits:'logits reales',entropy:'entropía real',context:'contexto real',activations:'activaciones reales'};
    let body='',caption='Gráfico técnico calculado desde el estado real del modelo.';
    if(mode==='attention'){
      const a=Array.from(L.attention.slice(S.head*t.N*t.N,S.head*t.N*t.N+t.N*t.N)),cell=6,ox=48,oy=32;
      const cells=[];for(let q=0;q<t.N;q++)for(let k=0;k<t.N;k++){const v=a[q*t.N+k],x=ox+k*cell,y=oy+q*cell;cells.push(k>q?`<rect x="${x}" y="${y}" width="${cell-.4}" height="${cell-.4}" fill="${colors.deep}"/><path d="M${x+1} ${y+cell-1}L${x+cell-1} ${y+1}" stroke="${colors.grid}" stroke-width=".5"/>`:`<rect x="${x}" y="${y}" width="${cell-.4}" height="${cell-.4}" fill="${valColor(v,1)}" opacity="${.20+Math.sqrt(v)*.80}"/>`);}
      let sum=0;for(let k=0;k<=last;k++)sum+=L.attention[S.head*t.N*t.N+last*t.N+k];
      body=`<svg viewBox="0 0 500 340" role="img" aria-label="Matriz de atención causal real"><g font-family="monospace"><text x="22" y="20" fill="${colors.on}" font-size="12">MATRIZ CAUSAL · CAPA ${S.layer+1} · CABEZA ${S.head+1}</text>${cells.join('')}<rect x="${ox}" y="${oy+last*cell}" width="${t.N*cell}" height="${cell}" fill="none" stroke="${colors.hot}"/><text x="22" y="310" fill="${colors.quiet}" font-size="11">Q ↓ K → · fila actual = ${fmt(sum,4)} · futuro bloqueado</text></g></svg>`;
      caption='Atención real: pesos softmax QK sobre el contexto actual.';
    }else if(mode==='probabilities'){
      const bars=S.dist.order.slice(0,10).map((id,i)=>{const p=S.dist.probabilities[id],w=Math.max(2,p*330),y=42+i*25;return `<text x="26" y="${y+10}" fill="${colors.text}" font-size="13">${esc(displayGlyph(M.vocab[id]))}</text><rect x="64" y="${y}" width="${w}" height="14" fill="${i?colors.cyan+'aa':colors.hot}"/><text x="${Math.min(455,76+w)}" y="${y+11}" fill="${colors.text}" font-size="10">${pct(p)}% · z=${fmt(t.logits[id],2)}</text>`;}).join('');
      body=`<svg viewBox="0 0 500 340" role="img" aria-label="Probabilidades y logits reales"><g font-family="monospace"><text x="22" y="22" fill="${colors.on}" font-size="12">SOFTMAX · T=${fmt(S.temperature,2)} · TOP-K ${S.topK||'todos'}</text>${bars}<text x="22" y="320" fill="${colors.quiet}" font-size="11">H=${fmt(S.dist.entropy,2)} bits · siguiente carácter desde la última posición</text></g></svg>`;
      caption='Probabilidades reales: logits normalizados para escoger el próximo carácter.';
    }else if(mode==='vectors'){
      const vec=t.x0.slice(last*t.D,last*t.D+64),mag=magnitude(vec);
      const cells=Array.from(vec,(v,i)=>`<rect x="${34+(i%16)*26}" y="${44+Math.floor(i/16)*38}" width="18" height="24" fill="${valColor(v,mag)}"/><text x="${43+(i%16)*26}" y="${82+Math.floor(i/16)*38}" fill="${colors.quiet}" font-size="6" text-anchor="middle">${i}</text>`).join('');
      const strips=[['LN',L.ln1,t.D],['Q',L.q,t.D],['K',L.k,t.D],['V',L.v,t.D]].map(([name,arr,len],r)=>{const values=arr.slice(last*len,last*len+32),scale=magnitude(values);return values.map((v,i)=>`<rect x="${34+i*13}" y="${235+r*20}" width="10" height="12" fill="${valColor(v,scale)}"/>`).join('')+`<text x="455" y="${245+r*20}" fill="${colors.cyan}" font-size="9">${name}</text>`;}).join('');
      body=`<svg viewBox="0 0 500 340" role="img" aria-label="Vectores reales del último carácter"><g font-family="monospace"><text x="22" y="22" fill="${colors.on}" font-size="12">VECTOR X0 · 64 COMPONENTES · POS ${last}</text>${cells}${strips}</g></svg>`;
      caption='Vectores reales: embedding + posición, y activaciones LN/Q/K/V.';
    }else if(mode==='operations'){
      const old=S.opType;S.opType=['q','score','fc1','logit'][Math.floor((S.history.length/8)%4)];const op=currentOperation();S.opType=old;
      const scale=Math.max(.001,...op.products.map(v=>Math.abs(v))),terms=op.products.map((p,i)=>({p,i})).sort((a,b)=>Math.abs(b.p)-Math.abs(a.p)).slice(0,18);
      const bars=terms.map((x,j)=>{const w=Math.abs(x.p)/scale*170,y=48+j*14,left=x.p<0?246-w:246;return `<rect x="${left}" y="${y}" width="${w}" height="9" fill="${x.p<0?colors.purple:colors.on}"/><text x="22" y="${y+8}" fill="${colors.quiet}" font-size="8">i${x.i}</text><text x="430" y="${y+8}" fill="${colors.text}" font-size="8">${fmt(x.p,4)}</text>`;}).join('');
      body=`<svg viewBox="0 0 500 340" role="img" aria-label="Productos reales de una operación interna"><g font-family="monospace"><text x="22" y="22" fill="${colors.on}" font-size="12">${esc(op.title)}</text><path d="M246 38V310" stroke="${colors.cyan}" opacity=".58"/>${bars}<text x="22" y="324" fill="${colors.quiet}" font-size="10">Σ=${fmt(op.sum,4)} · b=${fmt(op.bias,4)} · salida=${fmt(op.result,4)}</text></g></svg>`;
      caption='Operación real: productos xᵢwᵢ que se suman en una capa.';
    }else if(mode==='logits'){
      const min=Math.min(...t.logits),max=Math.max(...t.logits),span=Math.max(.001,max-min);
      const points=Array.from(t.logits,(z,i)=>`${22+i*(456/(t.V-1))},${278-(z-min)/span*210}`).join(' ');
      const labels=S.dist.order.slice(0,8).map(id=>{const x=22+id*(456/(t.V-1)),y=278-(t.logits[id]-min)/span*210;return `<circle cx="${x}" cy="${y}" r="4" fill="${colors.hot}"/><text x="${x}" y="${y-9}" fill="${colors.text}" font-size="9" text-anchor="middle">${esc(displayGlyph(M.vocab[id]))}</text>`;}).join('');
      body=`<svg viewBox="0 0 500 340" role="img" aria-label="Espectro real de logits"><g font-family="monospace"><text x="22" y="22" fill="${colors.on}" font-size="12">ESPECTRO DE LOGITS · VOCAB ${t.V}</text><path d="M22 278H478M22 68V278" stroke="${colors.grid}"/><polyline points="${points}" fill="none" stroke="${colors.cyan}" stroke-width="2"/>${labels}<text x="22" y="318" fill="${colors.quiet}" font-size="10">min=${fmt(min,2)} · max=${fmt(max,2)} · antes de softmax</text></g></svg>`;
      caption='Logits reales: puntajes sin normalizar para todos los caracteres posibles.';
    }else if(mode==='entropy'){
      const hist=S.history.slice(-70),values=hist.map(h=>-h.probabilities.reduce((a,p)=>a+(p>0?p*Math.log2(p):0),0));
      const maxH=Math.max(1,...values),pts=values.map((v,i)=>`${26+i*(438/Math.max(1,values.length-1))},${280-v/maxH*210}`).join(' ');
      const chars=hist.slice(-28).map((h,i)=>`<text x="${28+i*16}" y="315" fill="${i%2?colors.cyan:colors.hot}" font-size="9">${esc(displayGlyph(h.char))}</text>`).join('');
      body=`<svg viewBox="0 0 500 340" role="img" aria-label="Entropía real del historial de generación"><g font-family="monospace"><text x="22" y="22" fill="${colors.on}" font-size="12">ENTROPÍA POR PASO · ÚLTIMOS ${hist.length}</text><path d="M26 280H464M26 70V280" stroke="${colors.grid}"/><polyline points="${pts}" fill="none" stroke="${colors.hot}" stroke-width="2.2"/><text x="34" y="64" fill="${colors.quiet}" font-size="9">más incertidumbre</text><text x="34" y="294" fill="${colors.quiet}" font-size="9">menos</text>${chars}</g></svg>`;
      caption='Entropía real: cuánta incertidumbre tuvo la distribución en pasos recientes.';
    }else if(mode==='context'){
      const chars=S.enc.chars,ids=t.ids,cell=30;
      const cells=chars.map((c,i)=>{const x=24+(i%16)*cell,y=44+Math.floor(i/16)*55,on=i===last;return `<rect x="${x}" y="${y}" width="24" height="34" fill="${on?colors.hot:colors.off}" stroke="${on?colors.hot:colors.grid}"/><text x="${x+12}" y="${y+16}" fill="${on?colors.deep:colors.text}" font-size="13" text-anchor="middle">${esc(displayGlyph(c))}</text><text x="${x+12}" y="${y+29}" fill="${on?colors.deep:colors.cyan}" font-size="7" text-anchor="middle">${ids[i]}</text>`;}).join('');
      body=`<svg viewBox="0 0 500 340" role="img" aria-label="Contexto real de tokens e identificadores"><g font-family="monospace"><text x="22" y="22" fill="${colors.on}" font-size="12">CONTEXTO · ${t.N} / ${M.config.context} POSICIONES</text>${cells}<text x="22" y="318" fill="${colors.quiet}" font-size="10">cada celda = carácter + ID del vocabulario · última celda alimenta la salida</text></g></svg>`;
      caption='Contexto real: caracteres codificados que entran al Transformer.';
    }else if(mode==='activations'){
      const layers=t.layers.map((layer,li)=>[['Q',layer.q,t.D],['K',layer.k,t.D],['V',layer.v,t.D],['FF',layer.hidden,t.F]].map(([name,arr,len],ri)=>{const vals=arr.slice(last*len,last*len+Math.min(48,len)),sc=magnitude(vals),y=48+li*132+ri*25;return `<text x="22" y="${y+9}" fill="${colors.cyan}" font-size="9">L${li+1} ${name}</text>${Array.from(vals,(v,i)=>`<rect x="${62+i*8}" y="${y}" width="6" height="14" fill="${valColor(v,sc)}"/>`).join('')}`;}).join('')).join('');
      body=`<svg viewBox="0 0 500 340" role="img" aria-label="Activaciones reales por capa"><g font-family="monospace"><text x="22" y="22" fill="${colors.on}" font-size="12">ACTIVACIONES · CAPAS 1-2 · POS ${last}</text>${layers}<text x="22" y="318" fill="${colors.quiet}" font-size="10">color por magnitud/signo · muestras de Q K V y feed-forward</text></g></svg>`;
      caption='Activaciones reales: señales internas por capa para el último carácter.';
    }else{
      S.visualMode='probabilities';renderProcessVisual();return;
    }
    $('process-visual').innerHTML=body;
    $('process-mode').textContent=modeLabels[mode]||mode;
    $('process-caption').textContent=caption;
    $('process-pulse').textContent=S.history.length?displayGlyph(S.history.at(-1).char):'∞';
  }
  function renderProbabilities(){
    const t=S.trace,p=S.dist.probabilities,order=S.dist.order.slice(0,8);let shown=0;
    $('probability-bars').innerHTML=order.map((id,rank)=>{shown+=p[id];return `<div class="prob-row" title="${esc(charName(M.vocab[id]))}; logit ${fmt(t.logits[id],6)}; probabilidad ${fmt(p[id],8)}"><span class="prob-char">${esc(displayGlyph(M.vocab[id]))}</span><div class="prob-track"><div class="prob-fill" style="width:${p[id]*100}%"></div><span class="logit-tip">z = ${fmt(t.logits[id],3)}</span></div><span class="prob-value">${pct(p[id])}%</span></div>`;}).join('');
    $('other-probability').textContent=`Otros ${t.V-order.length}: ${pct(Math.max(0,1-shown))}%`;
    $('entropy').textContent=fmt(S.dist.entropy,2);$('temperature-label').textContent=fmt(S.temperature,2);
    $('sampling-explanation').textContent=S.temperature===0?'T = 0: se elige el logit máximo, sin sorteo.':S.topK===1?'Top-k = 1: solo queda el candidato más probable.':`Softmax(z / ${fmt(S.temperature,2)})${S.topK?`, renormalizado sobre ${S.topK} candidatos`:''}. Los pesos no cambian.`;
    const last=S.history.at(-1);
    if(last){
      const sorted=last.probabilities.map((p,i)=>({p,i})).filter(x=>x.p>0);let x=0;
      const rects=sorted.map(({p,i})=>{let rect=`<rect x="${x*300}" y="1" width="${p*300+.1}" height="7" fill="${i===last.id?'#c9f89b':valColor((i%6+1)/6,1)}"/>`;x+=p;return rect;}).join('');
      $('last-sample').innerHTML=`<div class="overline">ÚLTIMO MUESTREO · PASO ${S.history.length}</div><div class="sample-record"><div class="sample-token">${esc(displayGlyph(last.char))}</div><p>Elegido con <b>${pct(last.p)}%</b><br>${last.deterministic?'argmax · elección determinista':`u = ${fmt(last.u,5)} · semilla ${last.seed}`}</p></div><svg class="roulette" viewBox="0 0 300 28" role="img" aria-label="Distribución del paso anterior y posición del muestreo">${rects}${!last.deterministic?`<path d="M${last.u*300} 1v15" stroke="#eefadc" stroke-width="1.5"/><path d="M${last.u*300-3} 20l3-5 3 5" fill="#eefadc"/>`:''}<text x="0" y="27">0</text><text x="300" y="27" text-anchor="end">1</text></svg><div class="micro-note">Distribución anterior, antes de añadir este carácter.</div>`;
    }else $('last-sample').innerHTML='<div class="overline">ÚLTIMO MUESTREO</div><div class="sample-empty"><span>_</span><p>Una posibilidad se convierte en carácter.<br>Pulsa <strong>Un carácter</strong> para verlo.</p></div>';
    $('history-count').textContent=S.history.length;
    $('history').innerHTML=S.history.length?S.history.slice(-20).map(h=>`<span title="${esc(charName(h.char))}: ${pct(h.p)}%">${esc(displayGlyph(h.char))}</span>`).join(''):'<span class="muted">Aquí aparecerán los últimos 20 caracteres.</span>';
  }
  function renderInspector(){
    const t=S.trace;
    $$('.tabs button').forEach(b=>{const active=b.dataset.view===S.view;b.setAttribute('aria-selected',active);b.tabIndex=active?0:-1;});
    $('inspect-body').setAttribute('aria-labelledby','tab-'+S.view);
    $('layer-select').value=String(S.layer);
    const headRelevant=S.view==='attention'||(['operations','circuits'].includes(S.view)&&['score','mix'].includes(S.opType));
    $('head-picker').hidden=!headRelevant;$('layer-select').disabled=['operations','circuits'].includes(S.view)&&S.opType==='logit';
    $$('#head-picker button').forEach(b=>{const on=Number(b.dataset.head)===S.head;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});
    const b=document.querySelector('.inspector .badge');b.innerHTML=`<i class="dot"></i> ${S.view==='circuits'?'COPIA DIDÁCTICA':'VALORES REALES'}`;b.style.color=S.view==='circuits'?'var(--amber)':'';
    $('token-label').textContent=`POS. ${S.q} · ID ${t.ids[S.q]}${S.enc.offset?` · +${S.enc.offset} fuera`:''}`;
    $('token-ribbon').innerHTML=S.enc.chars.map((c,i)=>`<button class="token${i===S.q?' selected':''}${i===S.key?' key':''}${S.view==='attention'&&i>S.q?' future':''}" data-token="${i}" title="Posición ${i}, ${esc(charName(c))}, ID ${t.ids[i]}${S.enc.offset?`, posición absoluta ${i+S.enc.offset}`:''}" aria-label="Inspeccionar ${esc(charName(c))}, posición ${i}" aria-pressed="${i===S.q}">${esc(displayGlyph(c))}<small>${String(i).padStart(2,'0')}</small></button>`).join('');
    $('follow-last').classList.toggle('active',S.follow);$('follow-last').setAttribute('aria-pressed',S.follow);
    if(S.follow)$('token-ribbon').scrollLeft=$('token-ribbon').scrollWidth;
    if(S.view==='attention')renderAttention();else if(S.view==='vectors')renderVectors();else if(S.view==='operations')renderOperations();else renderCircuits();
    const note=S.view==='circuits'?'Circuito funcional didáctico: copia cuantizada Q3.4. No participa en la generación ni representa el hardware real.':S.q!==t.N-1?`Inspeccionas la posición ${S.q}. La distribución de salida sigue correspondiendo a la última posición (${t.N-1}).`:'La atención muestra una parte del cálculo; no explica por sí sola el comportamiento completo del modelo.';
    $('inspector-foot').textContent=note;
  }
  function pickQuery(q){S.q=q;S.follow=q===S.trace.N-1;S.keyAuto=true;const t=S.trace;const off=S.head*t.N*t.N+S.q*t.N;const a=t.layers[S.layer].attention;let k=0;for(let i=1;i<=q;i++)if(a[off+i]>a[off+k])k=i;S.key=k;renderInspector();}
  function pickKey(k){S.key=k;S.keyAuto=false;renderInspector();}
  function attentionConnections(){
    const t=S.trace,row=t.layers[S.layer].attention,off=S.head*t.N*t.N+S.q*t.N;
    const keys=Array.from({length:S.q+1},(_,i)=>i).sort((a,b)=>row[off+b]-row[off+a]).slice(0,8).sort((a,b)=>a-b),W=680,H=113;
    const start=40,space=(W-80)/Math.max(1,keys.length-1),cx=W/2;
    const paths=keys.map((k,j)=>{const x=keys.length===1?cx:start+j*space,p=row[off+k],selected=k===S.key;return `<path d="M${cx} 24 C${cx} 60,${x} 33,${x} 82" fill="none" stroke="${selected?colors.cyan:colors.on}" stroke-width="${.7+4.2*Math.sqrt(p)}" opacity="${.15+.75*Math.sqrt(p)}"/><g data-att-key="${k}" role="button" tabindex="0" aria-label="Clave ${k}, atención ${pct(p)} por ciento" style="cursor:pointer"><rect x="${x-14}" y="81" width="28" height="27" rx="4" fill="${selected?'#1a3730':'#17271a'}" stroke="${selected?colors.cyan:'#4b683b'}"/><text x="${x}" y="99" text-anchor="middle" fill="${selected?colors.cyan:colors.text}">${esc(displayGlyph(S.enc.chars[k]))}</text><text x="${x}" y="74" text-anchor="middle" fill="#8ba27d" style="font-size:8px">${pct(p)}%</text></g>`;}).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Conexiones de mayor peso para la consulta seleccionada">${paths}<rect x="${cx-16}" y="0" width="32" height="27" rx="4" fill="#263e1d" stroke="${colors.on}"/><text x="${cx}" y="19" text-anchor="middle" fill="${colors.on}">${esc(displayGlyph(S.enc.chars[S.q]))}</text><text x="${cx+27}" y="18" fill="#91a982" style="font-size:8px">CONSULTA · POS. ${S.q}</text><text x="8" y="13" fill="#728b66" style="font-size:7px">H${S.head+1} / CAPA ${S.layer+1}</text></svg>`;
  }
  function renderAttention(){
    const t=S.trace,L=t.layers[S.layer],idx=S.head*t.N*t.N+S.q*t.N+S.key,masked=S.key>S.q,p=L.attention[idx],score=L.scores[idx];
    let sum=0;for(let k=0;k<=S.q;k++)sum+=L.attention[S.head*t.N*t.N+S.q*t.N+k];
    $('inspect-body').innerHTML=`<div class="view-intro"><div><h3>¿A qué caracteres atiende?</h3><p>El grosor representa el peso de cada conexión, no su significado.</p></div><span class="tag">${t.N} × ${t.N}</span></div><div class="attention-connections">${attentionConnections()}</div><div class="heat-layout"><div><div class="heat-caption"><span>MATRIZ CAUSAL · Q ↓ K →</span><b>Σ fila = ${fmt(sum,4)}</b></div><canvas id="attention-canvas" class="heatmap" tabindex="0" role="img" aria-label="Matriz de atención. Pulsa una celda o usa las flechas para mover la selección."></canvas><div class="heat-legend"><span>0</span><i></i><span>1</span><span>╱ futuro bloqueado</span></div></div><div class="attention-detail"><div class="overline">CONEXIÓN SELECCIONADA</div><div class="pair-display"><div class="pair-char"><strong>${esc(displayGlyph(S.enc.chars[S.q]))}</strong><span>Q [${S.q}]</span></div><span class="pair-arrow">→</span><div class="pair-char key"><strong>${esc(displayGlyph(S.enc.chars[S.key]))}</strong><span>K [${S.key}]</span></div></div>${masked?'<div class="mask-message">Esta posición está en el futuro. La máscara impone −∞ antes del softmax: su peso es exactamente 0.</div>':`<div class="metric-line"><span>Q · K</span><b>${fmt(score*Math.sqrt(t.K),4)}</b></div><div class="metric-line"><span>÷ √${t.K}</span><b>${fmt(score,4)}</b></div>`}<div class="metric-line large"><span>ATENCIÓN α</span><b>${pct(p)}%</b></div><button class="detail-btn" id="inspect-qk" ${masked?'disabled':''}>Desglosar Q · K ↗</button></div></div><div class="view-bottom"><span class="equation-inline">Atención = softmax(QKᵀ / √${t.K} + máscara) V</span><span>Arriba: hasta 8 conexiones. Flechas = cambiar Q / K.</span></div>`;
    drawHeatmap();
  }
  function drawHeatmap(){
    const canvas=$('attention-canvas');if(!canvas)return;
    const box=canvas.getBoundingClientRect(),w=Math.max(20,box.width-2),h=Math.max(20,box.height-2),dpr=Math.min(2,window.devicePixelRatio||1);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
    ctx.fillStyle=colors.bg;ctx.fillRect(0,0,w,h);
    const t=S.trace,N=t.N,cell=Math.min((w-35)/N,(h-30)/N),ox=25+(w-35-cell*N)/2,oy=20+(h-30-cell*N)/2;
    const a=t.layers[S.layer].attention,off=S.head*N*N;
    for(let q=0;q<N;q++)for(let k=0;k<N;k++){
      const x=ox+k*cell,y=oy+q*cell,v=a[off+q*N+k];
      if(k>q){ctx.fillStyle='#101c15';ctx.fillRect(x,y,cell,cell);if(cell>5){ctx.strokeStyle='#213228';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x+2,y+cell-2);ctx.lineTo(x+cell-2,y+2);ctx.stroke();}}
      else{ctx.fillStyle=valColor(v,1);ctx.fillRect(x+.5,y+.5,Math.max(1,cell-1),Math.max(1,cell-1));}
    }
    ctx.strokeStyle='#c9f89b66';ctx.lineWidth=1;ctx.strokeRect(ox,oy+S.q*cell,cell*N,cell);
    ctx.strokeStyle=colors.cyan;ctx.lineWidth=Math.max(1,Math.min(2,cell/5));ctx.strokeRect(ox+S.key*cell+.5,oy+S.q*cell+.5,cell-1,cell-1);
    ctx.fillStyle='#8fa681';ctx.textAlign='center';ctx.font='8px Consolas,monospace';
    const skip=N<=24?1:N<=40?2:4;
    for(let i=0;i<N;i+=skip){const label=N<=24?displayGlyph(S.enc.chars[i]):String(i);ctx.fillText(label,ox+(i+.5)*cell,oy-6);ctx.fillText(label,ox-11,oy+(i+.5)*cell+3);}
    S.heatGeom={ox,oy,cell,w,h};
  }
  function renderVectors(){
    const t=S.trace,d=S.vecDim,off=S.q*t.D,L=t.layers[S.layer],vectors=[t.e.slice(off,off+t.D),t.p.slice(off,off+t.D),t.x0.slice(off,off+t.D)],names=['EMBEDDING E[token]','POSICIÓN P[pos]','ENTRADA X = E + P'];
    const scale=magnitude(Float32Array.from(vectors.flatMap(x=>Array.from(x))));
    const cards=vectors.map((v,j)=>`<div class="vector-card"><div class="overline">${names[j]} <span>64</span></div><div class="vector-grid">${Array.from(v,(x,i)=>`<button class="vector-cell${i===d?' selected':''}" data-dimension="${i}" style="background:${valColor(x,scale)}" title="${names[j]}, dimensión ${i}: ${fmt(x,7)}" aria-label="Dimensión ${i}, valor ${fmt(x,5)}"></button>`).join('')}</div><p>${j===0?`ID ${t.ids[S.q]} · ${esc(charName(S.enc.chars[S.q]))}`:j===1?`posición aprendida ${S.q}`:'suma elemento a elemento'}</p></div>`);
    const strips=[['LN',L.ln1,t.D],['Q',L.q,t.D],['K',L.k,t.D],['V',L.v,t.D],['FF',L.hidden,t.F]].map(([name,arr,len])=>{const v=arr.slice(S.q*len,(S.q+1)*len),sc=magnitude(v);return `<div class="activation-row"><span>${name}</span><div class="activation-strip" style="grid-template-columns:repeat(${len},1fr)">${Array.from(v,(x,i)=>`<i style="background:${valColor(x,sc)}" title="${name}[${i}] = ${fmt(x,6)}"></i>`).join('')}</div><output>${fmt(v[d],4)}</output></div>`;}).join('');
    $('inspect-body').innerHTML=`<div class="view-intro"><div><h3>Una letra se convierte en 64 números.</h3><p>El token tiene un vector aprendido; su posición añade otro.</p></div><span class="tag">ID ${t.ids[S.q]}</span></div><div class="vector-cards">${cards[0]}<div class="vector-symbol">+</div>${cards[1]}<div class="vector-symbol">=</div>${cards[2]}</div><div class="vector-equation"><div><div class="overline">COMPONENTE [${d}] · POSICIÓN ${S.q}</div><strong><span class="purple">${fmt(vectors[0][d],4)}</span> + <span class="cyan">${fmt(vectors[1][d],4)}</span> = <span class="accent">${fmt(vectors[2][d],4)}</span></strong></div><label class="channel-control">DIMENSIÓN <input id="vector-dimension" type="range" min="0" max="63" value="${d}"><output>${d}</output></label></div><div class="activation-section"><div class="activation-head"><span>DESPUÉS, EN LA CAPA ${S.layer+1}</span><span class="micro-note"><span class="purple">− negativo</span> / <span class="accent">+ positivo</span></span></div>${strips}<p>Cada tira muestra todos sus componentes (LN/Q/K/V: 64; FF: 128). A la derecha: componente [${d}]. El color se escala por tira; la magnitud se consulta al pasar el cursor. FF se muestra después de ReLU.</p><button class="detail-btn" id="vector-to-math">Seguir este vector hasta una multiplicación ↗</button></div>`;
  }
  function operationMax(type){const t=S.trace;return type==='fc1'?t.F-1:type==='logit'?t.V-1:type==='score'?0:type==='mix'?t.K-1:t.D-1;}
  function currentOperation(){
    const t=S.trace,L=t.layers[S.layer],D=t.D,F=t.F,pre=`blocks.${S.layer}.`,r=S.q,kind=S.opType;
    S.opDim=clamp(S.opDim,0,operationMax(kind));const d=S.opDim;
    let xs,ws,bias=0,result=0,scale=1,title='',expression='',note='',outLabel='',row=r;
    const take=(arr,n,pos=r)=>Array.from(arr.slice(pos*n,(pos+1)*n));
    if(['q','k','v'].includes(kind)){
      const j=['q','k','v'].indexOf(kind),out=j*D+d;xs=take(L.ln1,D);ws=Array.from(M.tensor(pre+'qkv.weight').slice(out*D,(out+1)*D));bias=M.tensor(pre+'qkv.bias')[out];result=L[kind][r*D+d];title=`Proyección ${kind.toUpperCase()} · salida [${d}]`;expression=`${kind.toUpperCase()}[${d}] = Σ xᵢwᵢ + b`;note=`La entrada se normaliza con LayerNorm. Los 64 componentes se reparten en cuatro cabezas de 16; la salida [${d}] pertenece a la cabeza ${Math.floor(d/t.K)+1}. Cada salida tiene sus propios pesos.`;outLabel=kind.toUpperCase()+'['+d+']';
    }else if(kind==='score'){
      const k=Math.min(S.key,r),off=S.head*t.K;xs=Array.from(L.q.slice(r*D+off,r*D+off+t.K));ws=Array.from(L.k.slice(k*D+off,k*D+off+t.K));scale=1/Math.sqrt(t.K);result=L.scores[S.head*t.N*t.N+r*t.N+k];title=`Atención · Q[${r}] · K[${k}]`;expression=`s = Σ qᵢkᵢ / √${t.K}`;note='Este producto usa 16 componentes de la cabeza seleccionada. Después se aplica la máscara causal y softmax sobre la fila.';outLabel='puntuación s';
    }else if(kind==='mix'){
      const off=S.head*t.N*t.N+r*t.N;xs=Array.from(L.attention.slice(off,off+r+1));ws=Array.from({length:r+1},(_,k)=>L.v[k*D+S.head*t.K+d]);result=L.context[r*D+S.head*t.K+d];title=`Mezcla de V · cabeza ${S.head+1} · [${d}]`;expression=`c[${d}] = Σ αᵢVᵢ[${d}]`;note='La atención combina los valores de posiciones permitidas. Los coeficientes α suman 1.';outLabel='contexto ['+d+']';
    }else if(kind==='proj'){
      xs=take(L.context,D);ws=Array.from(M.tensor(pre+'proj.weight').slice(d*D,(d+1)*D));bias=M.tensor(pre+'proj.bias')[d];result=L.projected[r*D+d];title=`Salida de atención · [${d}]`;expression=`o[${d}] = Σ cᵢwᵢ + b`;note='Concatena las cuatro cabezas y proyecta a 64 componentes. Luego se suma la conexión residual.';outLabel='salida ['+d+']';
    }else if(kind==='fc1'){
      xs=take(L.ln2,D);ws=Array.from(M.tensor(pre+'fc1.weight').slice(d*D,(d+1)*D));bias=M.tensor(pre+'fc1.bias')[d];result=L.hiddenPre[r*F+d];title=`FFN · expansión 64 → 128 · [${d}]`;expression=`h[${d}] = Σ xᵢwᵢ + b`;note=`Después: ReLU(${fmt(result,5)}) = ${fmt(L.hidden[r*F+d],5)}. Los valores negativos se sustituyen por cero.`;outLabel='antes de ReLU';
    }else if(kind==='fc2'){
      xs=take(L.hidden,F);ws=Array.from(M.tensor(pre+'fc2.weight').slice(d*F,(d+1)*F));bias=M.tensor(pre+'fc2.bias')[d];result=L.mlpOut[r*D+d];title=`FFN · contracción 128 → 64 · [${d}]`;expression=`y[${d}] = Σ hᵢwᵢ + b`;note='Combina las 128 activaciones posteriores a ReLU. Luego se añade la segunda conexión residual del bloque.';outLabel='salida FFN ['+d+']';
    }else{
      row=t.N-1;xs=take(t.norm,D,row);ws=Array.from(M.tensor('head.weight').slice(d*D,(d+1)*D));bias=M.tensor('head.bias')[d];result=t.logits[d];title=`Logit de salida · «${displayGlyph(M.vocab[d])}»`;expression=`z[${d}] = Σ xᵢwᵢ + b`;note=`Desde la última posición (${row}). Es un logit, no una probabilidad. Softmax con temperatura produce la distribución de salida.`;outLabel='logit «'+displayGlyph(M.vocab[d])+'»';
    }
    const products=xs.map((v,i)=>v*ws[i]),sum=products.reduce((a,b)=>a+b,0),reconstructed=(sum+bias)*scale;
    S.term=clamp(S.term,0,products.length-1);if(S.termAuto){let best=0;for(let i=1;i<products.length;i++)if(Math.abs(products[i])>Math.abs(products[best]))best=i;S.term=best;}
    return {kind,row,xs,ws,bias,result,scale,title,expression,note,outLabel,products,sum,reconstructed,n:xs.length,dim:d};
  }
  function operationOptions(){return [['q','Proyección Q'],['k','Proyección K'],['v','Proyección V'],['score','Q · K / √d (atención)'],['mix','Mezcla de valores Σ α·V'],['proj','Salida de atención'],['fc1','FFN · expansión 64 → 128'],['fc2','FFN · contracción 128 → 64'],['logit','Logit de salida (último)']].map(([id,title])=>`<option value="${id}" ${id===S.opType?'selected':''}>${title}</option>`).join('');}
  function operationFlow(op){
    const candidates=Array.from({length:Math.min(4,op.n)},(_,i)=>i);if(!candidates.includes(S.term))candidates[candidates.length-1]=S.term;
    let sub=0;const rows=candidates.map((i,j)=>{sub+=op.products[i];const y=23+j*37,on=i===S.term,c=on?colors.on:'#5b754a';return `<g data-term-select="${i}" style="cursor:pointer"><text x="9" y="${y+4}" fill="#718867" style="font-size:8px">[${i}]</text><rect x="47" y="${y-12}" width="95" height="25" rx="3" fill="#16241a" stroke="${on?'#839877':'#314331'}"/><text x="95" y="${y+4}" fill="${colors.purple}" text-anchor="middle">${fmt(op.xs[i],4)}</text><text x="158" y="${y+4}" fill="#788d6c">×</text><rect x="180" y="${y-12}" width="95" height="25" rx="3" fill="#13241d" stroke="#355344"/><text x="227" y="${y+4}" fill="${colors.cyan}" text-anchor="middle">${fmt(op.ws[i],4)}</text><path d="M275 ${y}H300" stroke="${c}" fill="none"/><text x="340" y="${y+4}" text-anchor="middle" fill="${on?colors.on:'#b6c9a5'}">${fmt(op.products[i],5)}</text><path d="M386 ${y}H${410+j*8}V79H455" stroke="${c}" fill="none" stroke-width="${on?1.6:1}"/></g>`;}).join('');
    return `<svg viewBox="0 0 665 177" role="img" aria-label="Multiplicaciones y suma de la operación seleccionada">${rows}<circle cx="477" cy="79" r="22" fill="#263b1d" stroke="#a6ce7b"/><text x="477" y="86" text-anchor="middle" fill="${colors.on}" style="font-size:24px">Σ</text><path d="M499 79H529" stroke="${colors.on}"/><text x="588" y="76" text-anchor="middle" fill="${colors.on}" style="font-size:17px">${fmt(op.result,4)}</text><text x="588" y="95" text-anchor="middle" fill="#839a74" style="font-size:8px">${esc(op.outLabel)}</text><path d="M477 139V103" stroke="#657e4f" stroke-dasharray="3 3"/><text x="463" y="154" fill="#91a17f" text-anchor="middle" style="font-size:8px">${op.n-candidates.length} productos más + sesgo${op.scale!==1?' · luego ÷ √16':''}</text><text x="9" y="173" fill="#6c8261" style="font-size:7px">PULSA UN PRODUCTO PARA SELECCIONARLO</text></svg>`;
  }
  function renderOperations(){
    const op=currentOperation(),items=S.allTerms?Array.from({length:op.n},(_,i)=>i):Array.from(new Set([...Array.from({length:Math.min(6,op.n)},(_,i)=>i),S.term])).sort((a,b)=>a-b);
    const termRows=items.map(i=>`<tr class="term-row${i===S.term?' selected':''}"><td>${String(i).padStart(2,'0')}</td><td class="purple">${fmt(op.xs[i],5)}</td><td class="cyan">${fmt(op.ws[i],5)}</td><td>${fmt(op.products[i],6)}</td><td><button data-circuit-term="${i}" title="Abrir la copia cuantizada de este producto">Bits ↗</button></td></tr>`).join('');
    $('inspect-body').innerHTML=`<div class="view-intro"><div><h3>La red también es multiplicar y sumar.</h3><p>Despliega una operación calculada para este contexto.</p></div></div><div class="operation-settings"><label>OPERACIÓN <select id="operation-type">${operationOptions()}</select></label>${S.opType!=='score'?`<label class="channel-control">SALIDA <input id="operation-dimension" type="range" min="0" max="${operationMax(S.opType)}" value="${S.opDim}"><output>${S.opDim}${S.opType==='logit'?' · '+esc(displayGlyph(M.vocab[S.opDim])):''}</output></label>`:`<span class="micro-note">Q[${S.q}] · K[${Math.min(S.key,S.q)}] · cabeza ${S.head+1}</span>`}</div><div class="operation-formula"><div><strong>${esc(op.expression)}</strong><p>${esc(op.title)} · ${op.n} productos</p></div><div class="result-badge"><b>${fmt(op.result,5)}</b><span>${esc(op.outLabel)}</span></div></div><div class="operation-flow">${operationFlow(op)}</div><div class="terms-header"><span>PRODUCTOS INDIVIDUALES · ${op.n} TÉRMINOS</span><button id="toggle-terms">${S.allTerms?'Contraer ↑':'Ver todos ↓'}</button></div><div class="terms-scroll"><table><thead><tr><th>i</th><th>ENTRADA xᵢ</th><th>${S.opType==='score'?'CLAVE kᵢ':S.opType==='mix'?'VALOR Vᵢ':'PESO wᵢ'}</th><th>PRODUCTO</th><th>CIRCUITO</th></tr></thead><tbody>${termRows}</tbody></table></div><div class="sum-footer">Σ productos = <b>${fmt(op.sum,6)}</b> &nbsp; · &nbsp; sesgo = <b>${fmt(op.bias,6)}</b>${op.scale!==1?` &nbsp; · &nbsp; escala = <b>1 / √${S.trace.K}</b>`:''}<br>Resultado almacenado: <b>${fmt(op.result,7)}</b> · diferencia por redondeo: ${op.reconstructed-op.result===0?'0':(op.reconstructed-op.result).toExponential(1)}</div><div class="operation-note">${esc(op.note)} Los valores visibles están redondeados; el cálculo utiliza más precisión.</div>`;
  }
  function binaryBits(n,bits=8){return Array.from({length:bits},(_,j)=>{const bit=(n>>>(bits-1-j))&1;return `<span class="${bit?'high':''}" title="bit ${bits-1-j}">${bit}</span>`;}).join('');}
  function gateShape(type,x,y,w=58,h=42,on=false){
    const klass='gate'+(on?' on':'');let p='';
    if(type==='AND')p=`M${x} ${y}h${w-h/2}a${h/2} ${h/2} 0 0 1 0 ${h}H${x}Z`;
    else p=`M${x} ${y}Q${x+18} ${y+h/2} ${x} ${y+h}Q${x+35} ${y+h} ${x+w} ${y+h/2}Q${x+35} ${y} ${x} ${y}Z`;
    return `<path class="${klass}" d="${p}"/>${type==='XOR'?`<path d="M${x-6} ${y}Q${x+12} ${y+h/2} ${x-6} ${y+h}" fill="none" stroke="${on?colors.on:'#6b8654'}" stroke-width="1.4"/>`:''}<text x="${x+w*.45}" y="${y+h/2+3}" text-anchor="middle" class="label" style="font-size:8px">${type}</text>`;
  }
  function gatesSVG(f){
    const wire=(d,on)=>`<path class="wire${on?' on':''}" d="${d}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" class="gates-svg" id="sum-gates" viewBox="0 0 680 205" role="img" aria-label="Sumador completo, bit ${S.circuitBit}: A=${f.a}, B=${f.b}, acarreo de entrada=${f.carry}, suma=${f.sum}, acarreo de salida=${f.out}"><rect width="680" height="205" fill="transparent"/>${wire('M50 31H88V40H130',f.a)}${wire('M50 71H103V63H130',f.b)}${wire('M69 31V108H132',f.a)}${wire('M87 71V130H132',f.b)}${wire('M50 170H265V64H331',f.carry)}${wire('M265 156H331',f.carry)}${wire('M188 52H227V40H331',f.xor)}${wire('M214 52V134H331',f.xor)}${wire('M188 119H453V146H501',f.g1)}${wire('M389 145H422V168H501',f.g2)}${wire('M389 51H602',f.sum)}${wire('M559 157H602',f.out)}${gateShape('XOR',130,31,58,42,!!f.xor)}${gateShape('XOR',331,30,58,42,!!f.sum)}${gateShape('AND',132,98,56,42,!!f.g1)}${gateShape('AND',331,124,58,42,!!f.g2)}${gateShape('OR',501,136,58,42,!!f.out)}<circle cx="69" cy="31" r="2.3" fill="${f.a?colors.on:'#526b43'}"/><circle cx="87" cy="71" r="2.3" fill="${f.b?colors.on:'#526b43'}"/><circle cx="214" cy="52" r="2.3" fill="${f.xor?colors.on:'#526b43'}"/><circle cx="265" cy="156" r="2.3" fill="${f.carry?colors.on:'#526b43'}"/><text x="6" y="35" class="input">A <tspan fill="${f.a?colors.on:colors.quiet}">${f.a}</tspan></text><text x="6" y="75" class="input">B <tspan fill="${f.b?colors.on:colors.quiet}">${f.b}</tspan></text><text x="3" y="174" class="input">Cᵢ ${f.carry}</text><text x="218" y="27" class="label">A ⊕ B = ${f.xor}</text><text x="198" y="109" class="label">AB = ${f.g1}</text><text x="398" y="190" class="label">Cᵢ(A ⊕ B) = ${f.g2}</text><text x="611" y="47" class="label">SUMA</text><text x="615" y="71" class="output">${f.sum}</text><text x="600" y="150" class="label">Cₒ SALIDA</text><text x="615" y="175" class="output">${f.out}</text><text x="7" y="202" class="label" style="font-size:7px">A: bit del acumulador · B: bit del producto parcial · Cᵢ: acarreo del bit anterior</text></svg>`;
  }
  function kmapSVG(f){
    const gray=[0,1,3,2],useCarry=S.kmap==='carry';let s='';
    s+='<text x="14" y="23" text-anchor="middle" class="axis">A\\BC</text>';
    gray.forEach((bc,j)=>s+=`<text x="${78+j*64}" y="23" text-anchor="middle" class="axis">${bc.toString(2).padStart(2,'0')}</text>`);
    for(let a=0;a<2;a++){
      s+=`<text x="14" y="${65+a*47}" text-anchor="middle" class="axis">${a}</text>`;
      for(let j=0;j<4;j++){
        const b=(gray[j]>>1)&1,c=gray[j]&1,fo=E.fullAdder(a,b,c),one=useCarry?fo.out:fo.sum,selected=a===f.a&&b===f.b&&c===f.carry,x=48+j*64,y=40+a*47;
        s+=`<rect x="${x}" y="${y}" width="60" height="43" rx="4" fill="${one?'#2c401d':'#142118'}" stroke="${selected?'#f2ffe2':one?'#526d38':'#2d3f2c'}" stroke-width="${selected?2:1}"/><text x="${x+30}" y="${y+28}" text-anchor="middle" fill="${one?colors.on:'#758d64'}" style="font-size:20px">${one}</text><text x="${x+54}" y="${y+39}" text-anchor="end" fill="#7a8f6a" style="font-size:7px">${a*4+b*2+c}</text>`;
      }
    }
    if(useCarry){s+=`<rect x="184" y="45" width="44" height="80" rx="11" fill="none" stroke="${colors.purple}" opacity=".85"/><rect x="115" y="92" width="116" height="31" rx="10" fill="none" stroke="${colors.cyan}" opacity=".9"/><rect x="179" y="96" width="120" height="25" rx="9" fill="none" stroke="#efc48e" opacity=".9"/>`;}
    else{for(let a=0;a<2;a++)for(let j=0;j<4;j++){const b=gray[j]>>1,c=gray[j]&1;if(E.fullAdder(a,b,c).sum)s+=`<rect x="${53+j*64}" y="${45+a*47}" width="50" height="33" rx="10" fill="none" stroke="${colors.purple}"/>`;}}
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 310 137" role="img" aria-label="Mapa de Karnaugh de ${useCarry?'acarreo':'suma'}, filas A, columnas BC en orden Gray" style="width:100%;max-width:335px;display:block;font-family:Consolas,monospace"><style>.axis{font-size:9px;fill:#9eb68c}</style>${s}</svg>`;
  }
  function renderCircuits(){
    const op=currentOperation(),a=E.quantize(op.xs[S.term]),b=E.quantize(op.ws[S.term]),mul=E.shiftMultiply(a.q,b.q);
    if(S.circuitAuto){
      S.circuitRow=Math.max(0,...mul.rows.filter(r=>r.enabled).map(r=>r.index));
      const candidates=mul.rows[S.circuitRow].adder.stages;let bit=candidates.findIndex(f=>f.a+f.b+f.carry>=2);if(bit<0)bit=candidates.findIndex(f=>f.a+f.b+f.carry>0);S.circuitBit=Math.max(0,bit);
    }
    const row=mul.rows[S.circuitRow],f=row.adder.stages[S.circuitBit],qResult=mul.signed/256,truth=[];
    for(let A=0;A<2;A++)for(let B=0;B<2;B++)for(let C=0;C<2;C++){const z=E.fullAdder(A,B,C),on=A===f.a&&B===f.b&&C===f.carry;truth.push(`<tr class="${on?'active':''}"><td>${A}</td><td>${B}</td><td>${C}</td><td>${z.sum}</td><td>${z.out}</td></tr>`);}
    const card=(q,name)=>`<div class="quant-card"><div class="quant-head"><span>${name} REAL</span><span>Q3.4 · 8 BITS</span></div><div class="quant-values">${fmt(q.value,4)} <span>→</span> ${q.q}</div><div class="binary-bits">${binaryBits(q.q&255)}</div><div class="micro-note">≈ ${fmt(q.decoded,4)}${q.clipped?' · SATURADO':''}<br>entero con signo / 16</div></div>`;
    const ripples=row.adder.stages.map(z=>`<button class="ripple-bit${z.sum?' high':''}${z.bit===S.circuitBit?' selected':''}" data-adder-bit="${z.bit}" title="Bit ${z.bit}: ${z.a} + ${z.b} + ${z.carry} = ${z.sum}, acarreo ${z.out}"><span>b${z.bit}</span><strong>${z.sum}</strong><span>C:${z.out}</span></button>`).join('');
    $('inspect-body').innerHTML=`<div class="view-intro"><div><h3>Un producto, llevado hasta sus bits.</h3><p>Una copia cuantizada de la operación que seleccionaste.</p></div><span class="tag" style="color:var(--amber)">DIDÁCTICO</span></div><div class="warn-note">La inferencia usa coma flotante. Aquí redondeamos y limitamos los operandos a enteros de 8 bits, con escala 16. Este circuito no modifica la generación${a.clipped||b.clipped?'; al menos un operando se saturó al rango permitido':''}.</div><div class="circuit-source"><span>${esc(op.title)} · término [${S.term}]</span><button id="back-to-operation">Cambiar producto ↗</button></div><div class="quant-grid">${card(a,'xᵢ')}<div class="vector-symbol">×</div>${card(b,S.opType==='score'?'kᵢ':S.opType==='mix'?'Vᵢ':'wᵢ')}</div><div class="quant-result"><div class="mono"><strong>${a.q} × ${b.q} = ${mul.signed}</strong><div class="micro-note">${mul.signed} / 256 ≈ ${fmt(qResult,5)}</div></div><span>Producto real: ${fmt(op.products[S.term],6)}<br>Error de cuantización: ${fmt(qResult-op.products[S.term],6)}</span></div><div class="circuit-controls"><label>SUMA PARCIAL <select id="partial-row">${mul.rows.map(r=>`<option value="${r.index}" ${r.index===S.circuitRow?'selected':''}>Fila ${r.index} · b${r.index}=${r.enabled}${r.index===7?' (signo)':''}</option>`).join('')}</select></label><label class="channel-control">BIT <input id="circuit-bit" type="range" min="0" max="15" value="${S.circuitBit}"><output>${S.circuitBit}</output></label><button class="tiny-btn" id="next-partial">Siguiente suma ↦</button></div><div class="partial-equation">b = Σ bᵢ2ⁱ − b₇·128. Fila ${S.circuitRow}: <b>${row.enabled} × ${a.q} × (${row.weight}) = ${row.signedPartial}</b><br>Acumulador (patrón sin signo): <b>${row.before} + ${row.partial} ≡ ${row.after}</b> (módulo 65 536).</div><div class="ripple-scroll"><div class="ripple-row">${ripples}</div></div><div class="ripple-legend"><span>16 SUMADORES · MSB ← LSB</span><span>Pulsa un bit para abrir sus puertas.</span></div><div class="gates-box"><div class="gates-caption"><span>SUMADOR COMPLETO · BIT ${S.circuitBit}</span><b>${f.a} + ${f.b} + ${f.carry} = ${f.sum} + 2·${f.out}</b></div>${gatesSVG(f)}</div><div class="logic-bottom"><div><h4>Tabla de verdad</h4><table class="truth-table"><thead><tr><th>A</th><th>B</th><th>Cᵢ</th><th>S</th><th>Cₒ</th></tr></thead><tbody>${truth.join('')}</tbody></table><div class="kmap-note">La fila iluminada corresponde al bit ${S.circuitBit} de esta suma parcial.</div></div><div><h4>Mapa de Karnaugh <select class="kmap-select" id="kmap-output"><option value="carry" ${S.kmap==='carry'?'selected':''}>Acarreo Cₒ</option><option value="sum" ${S.kmap==='sum'?'selected':''}>Suma S</option></select></h4>${kmapSVG(f)}<div class="kmap-formula">${S.kmap==='carry'?'<span class="amber">AB</span> + <span class="cyan">ACᵢ</span> + <span class="purple">BCᵢ</span> = Cₒ':'S = A ⊕ B ⊕ Cᵢ'}</div><div class="kmap-note">${S.kmap==='carry'?'Tres grupos de dos celdas. Las superposiciones están permitidas.':'Unos aislados: A̅B̅Cᵢ + A̅BC̅ᵢ + AB̅C̅ᵢ + ABCᵢ.'}<br>Columnas BCᵢ: 00, 01, 11, 10 (Gray). ⊕ es XOR. Contorno blanco: entrada actual.</div></div></div><div class="bit-choice-note">8 productos parciales → sumas de 16 bits → complemento a dos. Resultado verificado: ${mul.signed===mul.expected?'✓':'✗'} ${mul.signed} = ${a.q} × ${b.q}.</div>`;
  }
  function renderArchitecture(){
    const chip=(x,y,w,h,label,sub,view,op='',layer='')=>`<g class="arch-node" data-arch-view="${view}" ${op?`data-arch-op="${op}"`:''} ${layer!==''?`data-arch-layer="${layer}"`:''} role="button" tabindex="0" aria-label="Inspeccionar ${esc(label)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#16231b" stroke="#43593b"/><text x="${x+w/2}" y="${y+h/2-1}" fill="#c1d5ad" text-anchor="middle" style="font-size:9px">${label}</text><text x="${x+w/2}" y="${y+h/2+12}" fill="#7e9571" text-anchor="middle" style="font-size:6px">${sub}</text></g>`;
    const line=(x1,y1,x2,y2)=>`<path d="M${x1} ${y1}H${x2}" stroke="#78945d" fill="none"/>`;
    function block(x,i){const c=i===S.layer?'#6a8c50':'#364b31';let b=`<rect x="${x}" y="18" width="320" height="126" rx="6" fill="#101b1355" stroke="${c}" stroke-dasharray="4 4"/><text x="${x+12}" y="35" fill="#a7c58c" style="font-size:7px">BLOQUE ${i+1} · 4 CABEZAS × 16 COMPONENTES</text><path d="M${x+3} 91H${x+318}" stroke="#698650" fill="none"/>`;
      b+=chip(x+10,70,34,40,'LN','norm','vectors','',i)+chip(x+57,70,73,40,'Atención','Q · K → αV','attention','',i);
      b+=`<circle cx="${x+148}" cy="90" r="9" fill="#1f3118" stroke="#7b985e"/><text x="${x+148}" y="94" text-anchor="middle" fill="#bdd79f" style="font-size:12px">+</text>`;
      b+=chip(x+166,70,34,40,'LN','norm','vectors','',i)+chip(x+214,70,69,40,'FFN','64 → 128 → 64','operations','fc1',i);
      b+=`<circle cx="${x+304}" cy="90" r="9" fill="#1f3118" stroke="#7b985e"/><text x="${x+304}" y="94" text-anchor="middle" fill="#bdd79f" style="font-size:12px">+</text><path d="M${x+4} 90V49H${x+148}V81 M${x+158} 90V129H${x+304}V99" stroke="#5c7b46" fill="none"/><text x="${x+60}" y="61" fill="#6e895d" style="font-size:6px">RESIDUAL</text><text x="${x+205}" y="140" fill="#6e895d" style="font-size:6px">RESIDUAL</text>`;return b;}
    $('architecture-svg').innerHTML=`<svg viewBox="0 0 1180 159" role="img" aria-label="Arquitectura completa: embeddings, dos bloques de Transformer causal con conexiones residuales, normalización final, logits y softmax">${line(10,90,1170,90)}${chip(2,69,63,42,'Tokens',`${S.trace.N} × 1`,'vectors')}${chip(82,69,101,42,'Embedding + P',`${S.trace.N} × 64`,'vectors')}${block(205,0)}${block(546,1)}${chip(887,69,44,42,'LN','final','operations','logit')}${chip(948,69,84,42,'Logits',`${S.trace.V} salidas`,'operations','logit')}${chip(1049,69,108,42,'Softmax + sorteo','siguiente carácter','probabilities')}<text x="35" y="138" fill="#759064" style="font-size:7px">→ Se conserva el contexto, se añade el carácter y se repite el recorrido.</text></svg>`;
  }
  function renderModelCard(){
    const meta=data.meta,c=M.config,training=data.training,last=training.at(-1),W=550,H=221,left=43,top=25,plotW=485,plotH=157,maxLoss=4;
    const x=i=>left+i/meta.steps*plotW,y=v=>top+plotH-v/maxLoss*plotH;
    const line=key=>training.map((t,i)=>(i?'L':'M')+x(t.step).toFixed(2)+' '+y(t[key]).toFixed(2)).join(' ');
    const grids=[0,1,2,3,4].map(v=>`<path d="M${left} ${y(v)}H${left+plotW}" stroke="#293c2b"/><text x="${left-12}" y="${y(v)+3}" text-anchor="end">${v}</text>`).join('');
    $('model-card-body').innerHTML=`<div><h3>${esc(meta.name)} · Transformer de caracteres</h3><div class="model-stats"><div>PARÁMETROS ENTRENADOS<b>${num(meta.parameters)}</b></div><div>VOCABULARIO<b>${M.vocab.length} caracteres</b></div><div>VENTANA DE CONTEXTO<b>${c.context} posiciones</b></div><div>DIMENSIÓN INTERNA<b>${c.dim} componentes</b></div><div>CAPAS / CABEZAS POR CAPA<b>${c.layers} / ${c.heads}</b></div><div>RED FEED-FORWARD<b>64 → 128 → 64</b></div></div><p>${esc(meta.architecture)}</p><p>Entrenado con <b>${num(meta.corpus.train_characters)} caracteres</b> de texto sintético original, en ${num(meta.corpus.train_lines)} líneas (incluye repeticiones de frases originales). ${num(meta.corpus.validation_lines)} líneas reservadas para validación. No se utilizó un corpus general ni se descargaron obras de terceros.</p><div class="vocab" title="Caracteres conocidos por el modelo">${M.vocab.map(c=>esc(displayGlyph(c))).join(' ')}</div><p>Las mayúsculas se normalizan. Todo carácter fuera de este vocabulario se sustituye por «?». Los pesos no se actualizan mientras escribes.</p></div><div><h3>Registro del entrenamiento ya realizado</h3><svg class="training-plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pérdida de entrenamiento y validación durante los 2600 pasos. Curva histórica, no entrenamiento en vivo."><text x="${left}" y="12">ENTROPÍA CRUZADA · NATS / CARÁCTER</text>${grids}<path d="${line('train_loss')}" stroke="#c9f89b" stroke-width="2" fill="none"/><path d="${line('validation_loss')}" stroke="#8ae0d5" stroke-width="1.5" fill="none"/>${[0,1000,2000,2600].map(v=>`<text x="${x(v)}" y="${top+plotH+18}" text-anchor="middle">${v}</text>`).join('')}<text x="${left+plotW}" y="${H-2}" text-anchor="end">PASOS DE OPTIMIZACIÓN</text></svg><div class="train-legend"><span><i></i> entrenamiento ${fmt(last.train_loss,3)}</span><span><i></i> validación ${fmt(last.validation_loss,3)}</span></div><p><b>${num(meta.steps)} pasos</b> · lotes de ${meta.batch} × ${c.context} caracteres · ${num(meta.training_tokens_presented)} tokens presentados · semilla de entrenamiento ${meta.seed}. Optimización AdamW. Pesos incluidos en el proyecto.</p><p>La validación comparte el mismo tipo de plantillas; esta pérdida baja <b>no es evidencia de dominio general del español</b>. El modelo puede memorizar patrones, repetir fragmentos, cometer errores y producir texto incoherente.</p><p>${esc(meta.numeric)} En las pruebas incluidas se compararon logits con PyTorch y se verificaron exhaustivamente las 65 536 multiplicaciones posibles de dos enteros de 8 bits con signo.</p><p>El ZIP contiene el corpus, código de entrenamiento, pesos, pruebas y documentación. No necesitas Python para usar la página.</p></div>`;
  }
  function changeView(view,scroll=false){
    if(!['attention','vectors','operations','circuits'].includes(view))return;
    S.view=view;renderInspector();renderPipeline();
    if(scroll)document.querySelector('.inspector').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function setOperation(type){S.opType=type;S.opDim=clamp(S.opDim,0,operationMax(type));S.termAuto=true;S.circuitAuto=true;if(type==='score')S.key=Math.min(S.key,S.q);changeView('operations');}
  function pause(){S.playing=false;clearTimeout(timer);timer=null;setStatus();}
  function keepWriting(){
    clearInterval(watchdog);
    watchdog=setInterval(()=>{
      if(!isNetart()||!S.playing||limitReached())return;
      if(!timer&&performance.now()-lastTickAt>1200)tick();
    },1200);
  }
  function oneStep(){
    clearTimeout(debounce);debounce=null;
    if(limitReached()){pause();return;}
    lastTickAt=performance.now();
    const d=S.dist,deterministic=S.temperature===0||S.topK===1;
    const sampled=deterministic?{id:d.order[0],u:null,p:d.probabilities[d.order[0]]}:rng.sample(d.probabilities);
    const char=M.vocab[sampled.id];
    S.history.push({...sampled,char,probabilities:Array.from(d.probabilities),seed:S.seed,deterministic,temperature:S.temperature,topK:S.topK});S.generated+=char;
    recompute();
    if(limitReached()){pause();announce('Generación terminada. '+S.generated.length+' caracteres.');}
  }
  function tick(){if(!S.playing)return;timer=null;oneStep();if(S.playing)timer=setTimeout(tick,1000/S.speed);}
  function playPause(){
    if(S.playing){pause();announce('Generación pausada.');return;}
    if(limitReached()){toast('Amplía el límite o reinicia la generación.');return;}
    if(debounce){clearTimeout(debounce);debounce=null;commitPrompt();}
    S.playing=true;setStatus();announce('Generación iniciada.');keepWriting();tick();
  }
  function resetGeneration(){pause();S.generated='';S.history=[];rng.reset(S.seed);S.follow=true;S.keyAuto=true;recompute();}
  function commitPrompt(){
    pause();S.prompt=Array.from($('prompt').value).slice(0,256).join('');if($('prompt').value!==S.prompt)$('prompt').value=S.prompt;
    S.generated='';S.history=[];rng.reset(S.seed);S.follow=true;S.keyAuto=true;S.circuitAuto=true;recompute();
  }
  function copyText(){
    const text=encodedText();
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(()=>toast('Texto copiado.')).catch(()=>copyFallback(text));
    else copyFallback(text);
  }
  function copyFallback(text){
    const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;left:-9999px';document.body.append(ta);ta.select();
    try{const ok=document.execCommand('copy');toast(ok?'Texto copiado.':'Usa Exportar → Texto generado.');}catch(e){toast('Usa Exportar → Texto generado.');}finally{ta.remove();}
  }
  function download(filename,content,type){
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  function session(){return {format:'logic-dream-session-v1',modelName:data.meta.name,prompt:S.prompt,generated:S.generated,temperature:S.temperature,topK:S.topK,seed:S.seed,rngState:rng.state,speed:S.speed,limit:hasLimit()?S.limit:'infinite',view:S.view,layer:S.layer,head:S.head,history:S.history};}
  function exportData(kind){
    $('export-menu').hidden=true;$('export-toggle').setAttribute('aria-expanded','false');
    if(kind==='text')download('logic-dream-texto.txt',encodedText(),'text/plain;charset=utf-8');
    else if(kind==='session')download('logic-dream-sesion.json',JSON.stringify(session(),null,2),'application/json');
    else if(kind==='trace'){
      const payload={format:'logic-dream-trace-v1',note:'Valores internos reales de la inferencia. Los scores null representan -Infinity por la máscara causal. Circuito: copia cuantizada Q3.4, no usada para generar.',session:session(),model:{config:data.config,vocab:M.vocab,meta:data.meta},context:S.enc,trace:S.trace,distribution:S.dist,inspection:{layer:S.layer,head:S.head,query:S.q,key:S.key,operation:currentOperation()}};
      download('logic-dream-traza.json',JSON.stringify(payload,(k,v)=>ArrayBuffer.isView(v)?Array.from(v):v,2),'application/json');
    }else if(kind==='attention'){
      const t=S.trace,a=t.layers[S.layer].attention,rows=['capa,cabeza,consulta_pos,consulta_id,clave_pos,clave_id,peso,enmascarado'];
      for(let q=0;q<t.N;q++)for(let k=0;k<t.N;k++)rows.push([S.layer+1,S.head+1,q,t.ids[q],k,t.ids[k],a[S.head*t.N*t.N+q*t.N+k],k>q?1:0].join(','));
      download('logic-dream-atencion.csv','\uFEFF'+rows.join('\n'),'text/csv;charset=utf-8');
    }else if(kind==='circuit'){
      const op=currentOperation(),a=E.quantize(op.xs[S.term]),b=E.quantize(op.ws[S.term]),mul=E.shiftMultiply(a.q,b.q),row=mul.rows[S.circuitRow],f=row.adder.stages[S.circuitBit];
      let svg=gatesSVG(f).replace('fill="transparent"','fill="#101b13"');
      const style='<style>text{font-family:Consolas,monospace;font-size:11px;fill:#9baea4}.label{font-size:9px}.input{font-size:14px}.output{font-size:21px;fill:#c9f89b}.gate{fill:#182719;stroke:#6b8654;stroke-width:1.4}.gate.on{fill:#2a4020;stroke:#c9f89b}.wire{stroke:#3d5636;stroke-width:1.6;fill:none}.wire.on{stroke:#c9f89b}</style>';
      svg=svg.replace('</svg>',style+'</svg>');download('logic-dream-sumador.svg',svg,'image/svg+xml');
    }
  }
  function validateSession(o){
    if(!o||o.format!=='logic-dream-session-v1'||typeof o.prompt!=='string'||typeof o.generated!=='string')throw new Error('No es una sesión de LOGIC / DREAM.');
    if(Array.from(o.prompt).length>256||o.generated.length>256)throw new Error('La sesión excede el tamaño permitido.');
    if(M.normalize(o.generated).text!==o.generated)throw new Error('La salida contiene caracteres ajenos al modelo.');
    for(const [key,min,max] of [['temperature',0,1.5],['topK',0,M.vocab.length],['seed',1,4294967295],['rngState',1,4294967295],['speed',1,12],['layer',0,1],['head',0,3]])if(typeof o[key]!=='number'||!Number.isFinite(o[key])||o[key]<min||o[key]>max)throw new Error('Parámetro no válido: '+key);
    const importedLimit=o.limit==='infinite'?Infinity:o.limit;
    if(typeof importedLimit!=='number'||(!Number.isFinite(importedLimit)&&importedLimit!==Infinity)||(Number.isFinite(importedLimit)&&(importedLimit<32||importedLimit>256)))throw new Error('Parámetro no válido: limit');
    if(![32,64,128,256,Infinity].includes(importedLimit)||![0,1,3,5,10,20].includes(o.topK)||!['attention','vectors','operations','circuits'].includes(o.view))throw new Error('Ajustes de sesión incompatibles.');
    if(![o.seed,o.rngState,o.speed,o.layer,o.head].every(Number.isInteger))throw new Error('Parámetros enteros inválidos.');
    if(!Array.isArray(o.history)||o.history.length!==o.generated.length)throw new Error('Historial de generación incompleto.');
    o.history=o.history.map((h,i)=>{
      if(!h||h.char!==o.generated[i]||!Number.isInteger(h.id)||M.vocab[h.id]!==h.char||!Array.isArray(h.probabilities)||h.probabilities.length!==M.vocab.length||h.probabilities.some(p=>typeof p!=='number'||!Number.isFinite(p)||p<0||p>1)||Math.abs(h.probabilities.reduce((a,b)=>a+b,0)-1)>1e-5||typeof h.p!=='number'||Math.abs(h.p-h.probabilities[h.id])>1e-9||typeof h.deterministic!=='boolean'||!Number.isInteger(h.seed)||h.seed<1||h.seed>4294967295||(!h.deterministic&&(typeof h.u!=='number'||h.u<0||h.u>=1)))throw new Error('Historial de muestreo inválido.');
      return {id:h.id,char:h.char,p:h.p,u:h.deterministic?null:h.u,probabilities:h.probabilities,seed:h.seed,deterministic:h.deterministic,temperature:Number(h.temperature)||0,topK:Number(h.topK)||0};
    });return o;
  }
  async function importSession(file){
    if(!file)return;
    try{
      if(file.size>2_000_000)throw new Error('El archivo es demasiado grande. Máximo 2 MB.');
      const o=validateSession(JSON.parse(await file.text()));pause();clearTimeout(debounce);debounce=null;
      for(const key of ['prompt','generated','temperature','topK','seed','speed','view','layer','head','history'])S[key]=o[key];
      S.limit=importedLimit;
      rng.state=o.rngState>>>0;S.follow=true;S.keyAuto=true;S.termAuto=true;S.circuitAuto=true;
      $('prompt').value=S.prompt;$('temperature').value=S.temperature;$('top-k').value=S.topK;$('random-seed').value=S.seed;$('speed').value=S.speed;$('speed-label').textContent=S.speed+' car/s';$('limit').value=String(S.limit);
      recompute();toast('Sesión abierta. Continúa con el mismo estado aleatorio.');
    }catch(err){toast('No se pudo abrir: '+err.message);}finally{$('session-file').value='';}
  }
  function showGuide(){if(!$('guide').open)$('guide').showModal();}
  function installEvents(){
    $('prompt').addEventListener('input',()=>{pause();clearTimeout(debounce);commitPrompt();});
    $('play').addEventListener('click',playPause);$('step').addEventListener('click',()=>{pause();oneStep();announce('Añadido: '+charName(S.history.at(-1)?.char||''));});
    $('reset').addEventListener('click',resetGeneration);
    $('clear-prompt').addEventListener('click',()=>{$('prompt').value='';commitPrompt();$('prompt').focus();});
    $('speed').addEventListener('input',e=>{S.speed=Number(e.target.value);$('speed-label').textContent=S.speed+' car/s';});
    $('limit').addEventListener('change',e=>{S.limit=Number(e.target.value);if(limitReached())pause();renderConsole();});
    $('temperature').addEventListener('input',e=>{S.temperature=Number(e.target.value);S.dist=E.distribution(S.trace.logits,S.temperature,S.topK);renderProbabilities();renderPipeline();});
    $('top-k').addEventListener('change',e=>{S.topK=Number(e.target.value);S.dist=E.distribution(S.trace.logits,S.temperature,S.topK);renderProbabilities();renderPipeline();});
    $('random-seed').addEventListener('change',e=>{pause();S.seed=clamp(Math.round(Number(e.target.value)||248),1,4294967295);e.target.value=S.seed;rng.reset(S.seed);toast('Nueva semilla aplicada a los próximos pasos.');});
    $('new-seed').addEventListener('click',()=>{pause();const a=new Uint32Array(1);if(window.crypto?.getRandomValues)crypto.getRandomValues(a);else a[0]=Date.now()>>>0;S.seed=a[0]||248;rng.reset(S.seed);$('random-seed').value=S.seed;toast('Semilla '+S.seed+'. Reinicia para repetir desde el comienzo.');});
    $('layer-select').addEventListener('change',e=>{S.layer=Number(e.target.value);S.keyAuto=true;recompute();});
    $('follow-last').addEventListener('click',()=>{S.follow=true;S.keyAuto=true;pickQuery(S.trace.N-1);});
    $('open-guide')?.addEventListener('click',showGuide);$('temp-help')?.addEventListener('click',showGuide);$('close-guide')?.addEventListener('click',()=>$('guide').close());
    $('guide')?.addEventListener('click',e=>{const b=$('guide').getBoundingClientRect();if(e.target===$('guide')&&(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom))$('guide').close();});
    $('show-model')?.addEventListener('click',()=>{$('model-card').open=true;$('model-card').scrollIntoView({behavior:'smooth'});});
    $('copy-text').addEventListener('click',copyText);
    $('export-toggle')?.addEventListener('click',()=>{const hide=!$('export-menu').hidden;$('export-menu').hidden=hide;$('export-toggle').setAttribute('aria-expanded',!hide);});
    $('import-session')?.addEventListener('click',()=>{$('export-menu').hidden=true;$('export-toggle').setAttribute('aria-expanded','false');$('session-file').click();});
    $('session-file').addEventListener('change',e=>importSession(e.target.files[0]));
    document.addEventListener('click',e=>{
      const b=e.target.closest('button,[data-arch-view],[data-att-key],[data-term-select]');
      if(b){
        if(b.hasAttribute('data-prompt')){$('prompt').value=b.dataset.prompt;commitPrompt();}
        else if(b.dataset.view)changeView(b.dataset.view);
        else if(b.dataset.stage){
          const stage=b.dataset.stage;
          if(stage==='probabilities'||stage==='sample'){$('prediction').scrollIntoView({behavior:'smooth',block:'center'});$('prediction').classList.remove('flash');void $('prediction').offsetWidth;$('prediction').classList.add('flash');if(stage==='sample')toast('Pulsa «Un carácter» para realizar el siguiente muestreo.');}
          else {if(stage==='operations')S.opType='fc1';changeView(stage==='tokens'?'vectors':stage,true);}
        }else if(b.hasAttribute('data-head')){S.head=Number(b.dataset.head);S.keyAuto=true;recompute();}
        else if(b.hasAttribute('data-token'))pickQuery(Number(b.dataset.token));
        else if(b.hasAttribute('data-att-key'))pickKey(Number(b.dataset.attKey));
        else if(b.hasAttribute('data-dimension')){S.vecDim=Number(b.dataset.dimension);renderVectors();}
        else if(b.hasAttribute('data-term-select')){S.term=Number(b.dataset.termSelect);S.termAuto=false;renderOperations();}
        else if(b.hasAttribute('data-circuit-term')){S.term=Number(b.dataset.circuitTerm);S.termAuto=false;S.circuitAuto=true;changeView('circuits');}
        else if(b.hasAttribute('data-adder-bit')){S.circuitBit=Number(b.dataset.adderBit);S.circuitAuto=false;renderCircuits();}
        else if(b.dataset.export)exportData(b.dataset.export);
        else if(b.dataset.archView){
          if(b.hasAttribute('data-arch-layer'))S.layer=Number(b.dataset.archLayer);
          if(b.dataset.archView==='probabilities')$('prediction').scrollIntoView({behavior:'smooth',block:'center'});
          else {if(b.dataset.archOp){S.opType=b.dataset.archOp;if(S.opType==='logit')S.opDim=S.dist.order[0];}changeView(b.dataset.archView,true);}
        }
        if(b.id==='inspect-qk'){S.opType='score';S.opDim=0;S.termAuto=true;setOperation('score');}
        else if(b.id==='vector-to-math'){S.opDim=S.vecDim;setOperation('q');}
        else if(b.id==='toggle-terms'){S.allTerms=!S.allTerms;renderOperations();}
        else if(b.id==='back-to-operation')changeView('operations');
        else if(b.id==='next-partial'){S.circuitRow=(S.circuitRow+1)%8;S.circuitAuto=false;renderCircuits();}
      }
      if(e.target.id==='attention-canvas'){
        const box=e.target.getBoundingClientRect(),g=S.heatGeom,k=Math.floor((e.clientX-box.left-1-g.ox)/g.cell),q=Math.floor((e.clientY-box.top-1-g.oy)/g.cell);
        if(q>=0&&q<S.trace.N&&k>=0&&k<S.trace.N){S.q=q;S.key=k;S.follow=q===S.trace.N-1;S.keyAuto=false;renderInspector();$('attention-canvas').focus({preventScroll:true});}
      }
      if(!e.target.closest('.export-wrap')){$('export-menu').hidden=true;$('export-toggle').setAttribute('aria-expanded','false');}
    });
    $('inspect-body').addEventListener('input',e=>{
      if(e.target.id==='vector-dimension'){S.vecDim=Number(e.target.value);e.target.nextElementSibling.textContent=S.vecDim;}
      if(e.target.id==='operation-dimension'){S.opDim=Number(e.target.value);e.target.nextElementSibling.textContent=S.opDim;}
      if(e.target.id==='circuit-bit'){S.circuitBit=Number(e.target.value);S.circuitAuto=false;e.target.nextElementSibling.textContent=S.circuitBit;}
    });
    $('inspect-body').addEventListener('change',e=>{
      if(e.target.id==='vector-dimension')renderVectors();
      else if(e.target.id==='operation-type'){setOperation(e.target.value);}
      else if(e.target.id==='operation-dimension'){S.termAuto=true;S.circuitAuto=true;renderOperations();}
      else if(e.target.id==='partial-row'){S.circuitRow=Number(e.target.value);S.circuitAuto=false;renderCircuits();}
      else if(e.target.id==='circuit-bit')renderCircuits();
      else if(e.target.id==='kmap-output'){S.kmap=e.target.value;renderCircuits();}
    });
    document.addEventListener('keydown',e=>{
      if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!$('guide').open){e.preventDefault();playPause();}
      if(e.altKey&&e.key==='ArrowRight'&&!$('guide').open){e.preventDefault();pause();oneStep();}
      if(e.key==='Escape'){$('export-menu').hidden=true;$('export-toggle').setAttribute('aria-expanded','false');pause();}
      if(e.target.id==='attention-canvas'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
        e.preventDefault();if(e.key==='ArrowLeft')S.key=clamp(S.key-1,0,S.trace.N-1);if(e.key==='ArrowRight')S.key=clamp(S.key+1,0,S.trace.N-1);if(e.key==='ArrowUp')S.q=clamp(S.q-1,0,S.trace.N-1);if(e.key==='ArrowDown')S.q=clamp(S.q+1,0,S.trace.N-1);S.follow=S.q===S.trace.N-1;S.keyAuto=false;renderInspector();$('attention-canvas').focus({preventScroll:true});
      }
      if(e.target.matches('.tabs [role=tab]')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
        e.preventDefault();const tabs=$$('.tabs [role=tab]'),i=tabs.indexOf(e.target),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;changeView(tabs[next].dataset.view);tabs[next].focus();
      }
      if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-att-key],[data-arch-view]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
    });
    window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(S.view==='attention')drawHeatmap();},100);});
  }
  try{
    M=new E.TinyTransformer(data);rng=new E.Sampler(S.seed);$('param-short').textContent=(data.meta.parameters/1000).toFixed(1)+'k';
    recompute();renderModelCard();installEvents();keepWriting();setTimeout(playPause,250);
    // Diagnostic entry point for the included reproducibility tests.
    Object.defineProperty(window,'LogicDream',{value:Object.freeze({getState:()=>({...S}),getModel:()=>M,step:()=>{pause();oneStep();},pause,validateSession,exportSession:session}),writable:false});
  }catch(err){console.error(err);const div=document.createElement('div');div.className='error-banner';div.textContent='No se pudo iniciar el laboratorio: '+err.message;document.body.append(div);}
})();

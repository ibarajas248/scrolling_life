(() => {
  const graph = document.querySelector('.archive-subpages');
  const svg = graph.querySelector('.circuit-traces');
  const nodes = Object.fromEntries(['a','b','c','d','e','f','g'].map(key => [key, graph.querySelector(`.archive-node--${key}`)]));
  const ns = 'http://www.w3.org/2000/svg';
  function draw() {
    const bounds = svg.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    svg.replaceChildren();
    const add = (tag, attrs) => {
      const el = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([key,value]) => el.setAttribute(key,value));
      svg.append(el);
    };
    const path = (d, style='') => add('path',{d,class:`schematic-wire ${style}`});
    const boxes = Object.fromEntries(Object.entries(nodes).map(([key,node]) => {
      const b = node.getBoundingClientRect();
      return [key,{left:b.left-bounds.left,right:b.right-bounds.left,y:b.top-bounds.top+b.height/2}];
    }));
    const mobile = matchMedia('(max-width: 860px)').matches;
    const links = mobile ? [['a','b'],['b','f'],['f','c'],['c','g'],['g','e'],['e','d']] : [['a','b'],['a','f'],['f','c'],['c','d'],['e','b'],['e','d'],['c','g']];
    links.forEach(([from,to],i) => {
      const a=boxes[from], b=boxes[to];
      let x1,x2,rail;
      if (mobile || (from==='a' && to==='f') || (from==='f' && to==='c') || (from==='c' && to==='g') || (from==='e')) {
        const right=mobile ? i%2===0 : from==='e';
        x1=right?a.right:a.left; x2=right?b.right:b.left;
        rail=right?Math.min(bounds.width-10,Math.max(x1,x2)+24):Math.max(10,Math.min(x1,x2)-24);
      } else { x1=a.right; x2=b.left; rail=(x1+x2)/2; }
      const style=i%3===0?'schematic-wire--accent':i%3===1?'schematic-wire--blue':'';
      const y1=a.y,y2=b.y,mid=(y1+y2)/2,sign=Math.sign(y2-y1)||1;
      if(Math.abs(y2-y1)>64) {
        path(`M${x1} ${y1} H${rail} V${mid-sign*20}`,style);
        if(i%2===0) {
          // Resistor zigzag, inserted in series in the vertical wire.
          let d=`M${rail} ${mid-sign*20}`;
          for(let n=0;n<6;n++) d+=` L${rail+(n%2?6:-6)} ${mid+sign*(-15+n*6)}`;
          d+=` L${rail} ${mid+sign*20}`;
          path(d,style);
        } else {
          // Two separated capacitor plates: no conductor through the gap.
          path(`M${rail} ${mid-sign*20} V${mid-sign*4} M${rail-10} ${mid-4} H${rail+10} M${rail-10} ${mid+4} H${rail+10} M${rail} ${mid+sign*4} V${mid+sign*20}`,style);
        }
        path(`M${rail} ${mid+sign*20} V${y2} H${x2}`,style);
      } else {
        const midx=(x1+x2)/2;
        path(`M${x1} ${y1} H${midx-24} l6 -6 l8 12 l8 -12 l8 12 l6 -6 H${rail} V${y2} H${x2}`,style);
      }
      [[x1,y1],[x2,y2]].forEach(([cx,cy])=>add('circle',{cx,cy,r:4,class:'schematic-terminal'}));
      // Junction dot and ground branch outside each node's footprint.
      add('circle',{cx:rail,cy:y1,r:3,class:'schematic-junction'});
      if(!mobile && i===4) {
        const gy=y2+40;
        path(`M${rail} ${y2} V${gy} m-12 0 h24 m-20 5 h16 m-12 5 h8`);
      }
    });
  }
  const observer=new ResizeObserver(draw);
  observer.observe(graph);
  Object.values(nodes).forEach(node=>observer.observe(node));
  document.fonts.ready.then(draw);
  draw();
})();

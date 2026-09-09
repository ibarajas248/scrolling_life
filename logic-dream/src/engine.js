/* LOGIC / DREAM — motor numérico independiente de la interfaz.
 * Pesos PyTorch: matrices [salida, entrada], almacenadas por filas.
 * Inferencia real; no hay plantillas, peticiones de red ni frases de respuesta.
 */
(function (global) {
  'use strict';
  const F32 = Float32Array;
  function softmax(values) {
    let max = -Infinity;
    for (const x of values) if (x > max) max = x;
    const out = new Float64Array(values.length);
    if (!Number.isFinite(max)) throw new Error('Softmax sin valores finitos.');
    let sum = 0;
    for (let i = 0; i < out.length; i++) { out[i] = Math.exp(values[i] - max); sum += out[i]; }
    for (let i = 0; i < out.length; i++) out[i] /= sum;
    return out;
  }
  function linear(x, rows, input, output, w, b) {
    const y = new F32(rows * output);
    for (let r = 0; r < rows; r++) {
      const ro = r * input, yo = r * output;
      for (let o = 0; o < output; o++) {
        let s = b ? b[o] : 0; const wo = o * input;
        for (let i = 0; i < input; i++) s += x[ro + i] * w[wo + i];
        y[yo + o] = s;
      }
    }
    return y;
  }
  function layerNorm(x, rows, dim, gamma, beta, eps) {
    const y = new F32(x.length);
    for (let r = 0; r < rows; r++) {
      const off = r * dim; let mean = 0, variance = 0;
      for (let j = 0; j < dim; j++) mean += x[off + j]; mean /= dim;
      for (let j = 0; j < dim; j++) variance += (x[off + j] - mean) ** 2;
      const inv = 1 / Math.sqrt(variance / dim + eps);
      for (let j = 0; j < dim; j++) y[off + j] = (x[off + j] - mean) * inv * gamma[j] + beta[j];
    }
    return y;
  }
  function add(a, b) { const c = new F32(a.length); for (let i=0;i<c.length;i++) c[i]=a[i]+b[i]; return c; }
  class TinyTransformer {
    constructor(data) {
      if (!data || data.format !== 'logic-dream-f32-le-v1') throw new Error('Formato de pesos incorrecto.');
      this.config=data.config; this.vocab=data.vocab; this.meta=data.meta;
      this.stoi=new Map(this.vocab.map((v,i)=>[v,i])); this.data=data; this.weights={};
      const bin=atob(data.weights), view=new DataView(new ArrayBuffer(bin.length));
      for(let i=0;i<bin.length;i++) view.setUint8(i,bin.charCodeAt(i));
      const vals=new F32(bin.length/4);
      for(let i=0;i<vals.length;i++) vals[i]=view.getFloat32(i*4,true);
      for(const [name, t] of Object.entries(data.tensors)) this.weights[name]=vals.subarray(t.offset,t.offset+t.length);
    }
    tensor(name) { const w=this.weights[name]; if(!w)throw new Error('Tensor ausente: '+name); return w; }
    normalize(text) {
      const input=String(text).normalize('NFC').toLowerCase().replace(/\r\n?/g,'\n').replace(/\t/g,' ');
      let unknown=0; const replaced=new Set();
      const chars=Array.from(input).map(c=>{if(this.stoi.has(c))return c; unknown++;replaced.add(c);return '?';});
      return {text:chars.join(''),chars,unknown,replaced:[...replaced]};
    }
    encode(text) {
      const normalized=this.normalize(text), all=normalized.chars.length?normalized.chars:['\n'];
      const chars=all.slice(-this.config.context);
      return {...normalized, chars, ids:chars.map(c=>this.stoi.get(c)), offset:Math.max(0,all.length-chars.length), total:all.length};
    }
    forward(ids) {
      const c=this.config,D=c.dim,H=c.heads,F=c.hidden,K=D/H,N=ids.length,V=this.vocab.length;
      if(!N || N>c.context || ids.some(id=>!Number.isInteger(id)||id<0||id>=V)) throw new Error('Tokens fuera del rango del modelo.');
      const e=new F32(N*D),p=new F32(N*D),embedding=this.tensor('emb.weight'),position=this.tensor('pos.weight');
      for(let t=0;t<N;t++)for(let d=0;d<D;d++){e[t*D+d]=embedding[ids[t]*D+d];p[t*D+d]=position[t*D+d];}
      const x0=add(e,p); let x=x0; const layers=[];
      for(let l=0;l<c.layers;l++) {
        const pre=`blocks.${l}.`,input=x;
        const ln1=layerNorm(input,N,D,this.tensor(pre+'ln1.weight'),this.tensor(pre+'ln1.bias'),c.eps);
        const qkv=linear(ln1,N,D,3*D,this.tensor(pre+'qkv.weight'),this.tensor(pre+'qkv.bias'));
        const q=new F32(N*D),k=new F32(N*D),v=new F32(N*D);
        for(let t=0;t<N;t++)for(let d=0;d<D;d++){q[t*D+d]=qkv[t*3*D+d];k[t*D+d]=qkv[t*3*D+D+d];v[t*D+d]=qkv[t*3*D+2*D+d];}
        const scores=new F32(H*N*N).fill(-Infinity),attention=new F32(H*N*N),context=new F32(N*D);
        for(let h=0;h<H;h++)for(let t=0;t<N;t++){
          const off=h*N*N+t*N,sc=new Float64Array(t+1);
          for(let s=0;s<=t;s++){
            let z=0;for(let j=0;j<K;j++)z+=q[t*D+h*K+j]*k[s*D+h*K+j];
            scores[off+s]=z/Math.sqrt(K);sc[s]=scores[off+s];
          }
          const a=softmax(sc);for(let s=0;s<=t;s++)attention[off+s]=a[s];
          for(let j=0;j<K;j++){
            let z=0;for(let s=0;s<=t;s++)z+=attention[off+s]*v[s*D+h*K+j];
            context[t*D+h*K+j]=z;
          }
        }
        const projected=linear(context,N,D,D,this.tensor(pre+'proj.weight'),this.tensor(pre+'proj.bias'));
        const residual=add(input,projected);
        const ln2=layerNorm(residual,N,D,this.tensor(pre+'ln2.weight'),this.tensor(pre+'ln2.bias'),c.eps);
        const hiddenPre=linear(ln2,N,D,F,this.tensor(pre+'fc1.weight'),this.tensor(pre+'fc1.bias'));
        const hidden=hiddenPre.map(v=>Math.max(0,v));
        const mlpOut=linear(hidden,N,F,D,this.tensor(pre+'fc2.weight'),this.tensor(pre+'fc2.bias'));
        x=add(residual,mlpOut);
        layers.push({input,ln1,q,k,v,scores,attention,context,projected,residual,ln2,hiddenPre,hidden,mlpOut,output:x});
      }
      const norm=layerNorm(x,N,D,this.tensor('norm.weight'),this.tensor('norm.bias'),c.eps);
      const allLogits=linear(norm,N,D,V,this.tensor('head.weight'),this.tensor('head.bias'));
      const logits=allLogits.slice((N-1)*V,N*V);
      // Count actual multiplications in the dense matrices and causal attention;
      // excludes normalizations, softmax, residual additions and display rendering.
      const multiplications=c.layers*(N*4*D*D+N*2*D*F+D*N*(N+1))+N*D*V;
      return {ids:[...ids],N,D,H,F,K,V,e,p,x0,layers,norm,allLogits,logits,multiplications};
    }
  }
  function distribution(logits,temperature=0.75,topK=0) {
    const order=Array.from(logits,(_,i)=>i).sort((a,b)=>logits[b]-logits[a]||a-b),probabilities=new Float64Array(logits.length);
    const temp=Number(temperature),k=Math.max(0,Math.min(logits.length,Math.floor(Number(topK)||0)));
    if(!Number.isFinite(temp)||temp<0)throw new Error('Temperatura no válida.');
    if(temp===0){probabilities[order[0]]=1;return {probabilities,order,entropy:0,kept:1};}
    const kept=k||logits.length, selected=order.slice(0,kept), p=softmax(selected.map(i=>logits[i]/temp));
    selected.forEach((idx,j)=>{probabilities[idx]=p[j];});
    let entropy=0;for(const p of probabilities)if(p>0)entropy-=p*Math.log2(p);
    return {probabilities,order,entropy,kept};
  }
  class Sampler {
    constructor(seed=248){this.reset(seed);}
    reset(seed){this.state=(Number(seed)>>>0)||0x6d2b79f5;}
    next(){let x=this.state;x^=x<<13;x^=x>>>17;x^=x<<5;this.state=x>>>0;return this.state/4294967296;}
    sample(probabilities){const u=this.next();let sum=0,id=0;for(let i=0;i<probabilities.length;i++){sum+=probabilities[i];if(u<sum){id=i;return {id,u,p:probabilities[i]};}}id=probabilities.length-1;while(id>0&&!probabilities[id])id--;return {id,u,p:probabilities[id]};}
  }
  function fullAdder(a,b,carry){const xor=a^b;return {a,b,carry,xor,sum:xor^carry,g1:a&b,g2:xor&carry,out:(a&b)|(xor&carry)};}
  function ripple(a,b,bits=16){const stages=[];let carry=0,result=0;for(let bit=0;bit<bits;bit++){const f=fullAdder((a>>>bit)&1,(b>>>bit)&1,carry);stages.push({...f,bit});result|=f.sum<<bit;carry=f.out;}return {stages,result:result&((1<<bits)-1),carry};}
  function quantize(value,scale=16){const raw=Math.round(value*scale),q=Math.max(-128,Math.min(127,raw));return {value,q,decoded:q/scale,clipped:q!==raw,error:q/scale-value};}
  function shiftMultiply(a,b){
    if(!Number.isInteger(a)||!Number.isInteger(b)||a< -128||a>127||b< -128||b>127)throw new Error('Se necesitan enteros con signo de 8 bits.');
    const unsignedB=b&255,rows=[];let acc=0;
    // Two's complement: b = sum(bit_i*2^i, i=0..6) - bit_7*128.
    for(let i=0;i<8;i++){
      const enabled=(unsignedB>>>i)&1,weight=i===7?-128:1<<i;
      const signedPartial=enabled?a*weight:0,partial=signedPartial&65535;
      const sum=ripple(acc,partial,16);rows.push({index:i,enabled,weight,signedPartial,partial,before:acc,after:sum.result,adder:sum});acc=sum.result;
    }
    return {a,b,rows,unsigned:acc,signed:acc>=32768?acc-65536:acc,expected:a*b};
  }
  global.DreamEngine={TinyTransformer,Sampler,distribution,softmax,linear,layerNorm,fullAdder,ripple,quantize,shiftMultiply};
})(typeof window!=='undefined'?window:globalThis);

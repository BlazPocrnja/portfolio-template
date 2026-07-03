import{j as C}from"./jsx-runtime.TBa3i5EZ.js";import{r as P}from"./index.CVf8TyFT.js";import{e as F,S as O}from"./gsap.nAyxWsi1.js";import{g as T}from"./index.SFc2wnMY.js";const I=[" ","·.,",":;`-~^","=+<>?!:;","|/\\()[]{}«»","÷×±–—≈≠≤≥∞∆∇","¤†‡§¶©®™°¬","%&#$@¥€£¢"],L={chars:[],pools:[],cols:0,rows:0};function W(e){let t=e;return()=>(t=t*16807%2147483647,t/2147483647)}function z(e,t,f,o){e.beginPath(),e.moveTo(t-o,0),e.lineTo(t-o,f),e.arc(t,f,o,Math.PI,0,!1),e.lineTo(t+o,0),e.arc(t,0,o,0,Math.PI,!1),e.closePath(),e.fill()}function D(e,t,f,o){e.clearRect(0,0,t,f),e.fillStyle="#fff",e.save(),o&&(e.translate(t,0),e.scale(-1,1));const d=t*.5,w=f*.72,v=t*.32,l=f*.26;e.beginPath(),e.ellipse(d,w,v,l,0,0,Math.PI*2),e.fill(),[{dx:-.26,len:.44,wid:.09,rot:-.16},{dx:-.09,len:.56,wid:.1,rot:-.04},{dx:.09,len:.54,wid:.1,rot:.05},{dx:.25,len:.4,wid:.09,rot:.2}].forEach(r=>{const M=d+r.dx*t,m=w-l*.55;e.save(),e.translate(M,m),e.rotate(r.rot),z(e,0,-r.len*f,r.wid*t/2),e.restore()}),e.save(),e.translate(d-v*.9,w-l*.1),e.rotate(-.85),z(e,0,-f*.28,t*.1),e.restore(),e.restore()}function N(e,t,f,o,d){if(!t||!f)return L;const w=W(d),v=f/t,l=Math.max(1,Math.round(o*v)),c=document.createElement("canvas");c.width=o,c.height=l;const r=c.getContext("2d");if(!r)return L;r.drawImage(e,0,0,o,l);let M;try{M=r.getImageData(0,0,o,l).data}catch{return L}const m=[],g=[];for(let s=0;s<l;s++){const i=[],u=[];for(let h=0;h<o;h++){const a=(s*o+h)*4,n=M[a]??0,p=M[a+1]??0,j=M[a+2]??0,y=M[a+3]??0;if(y<15){i.push(" "),u.push(-1);continue}const R=(.299*n+.587*p+.114*j)/255*(y/255),x=Math.min(I.length-1,Math.floor(R*(I.length-1)*.85)),b=I[x]??" ";i.push(b[Math.floor(w()*b.length)]??" "),u.push(x)}m.push(i),g.push(u)}return{chars:m,pools:g,cols:o,rows:l}}function X(e){return e==="<"?"&lt;":e===">"?"&gt;":e==="&"?"&amp;":e}function G(e,t){let o=[],d=[],w=[],v=-1,l=-1,c=!1,r=0;function M(s){if(!(v===s.cols&&l===s.rows)){v=s.cols,l=s.rows,o=[],d=[],w=[];for(let i=0;i<s.rows;i++){const u=[],h=[],a=[];for(let n=0;n<s.cols;n++){const p=Math.abs(Math.sin(n*12.9898+i*78.233)*43758.5453%1);u.push(p*5-2.5),h.push(0),a.push(p>.5?200:100)}o.push(u),d.push(h),w.push(a)}}}function m(){const s=t();if(!s.cols){c=!1;return}const i=performance.now();let u=!1,h="";for(let a=0;a<s.rows;a++){for(let n=0;n<s.cols;n++){const p=s.pools[a]?.[n]??-1;if(p<=0){h+=" ";continue}const j=d[a]?.[n]??0,y=w[a]?.[n]??0,R=i-j;if(j>0&&R<y){u=!0;const x=I.length-1-p,b=I[x]??" ",H=b[Math.floor(Math.random()*b.length)]??" ";h+=`<span class="fa-hit">${X(H)}</span>`}else h+=X(s.chars[a]?.[n]??" ")}h+=`
`}e.innerHTML=h,u?r=requestAnimationFrame(m):(c=!1,e.textContent=s.chars.map(a=>a.join("")).join(`
`))}function g(s){const i=t();if(!i.cols)return;M(i);const u=e.getBoundingClientRect(),h=u.width/i.cols,a=u.height/i.rows,n=(s.clientX-u.left)/h,p=(s.clientY-u.top)/a,j=performance.now(),y=2.5+3,R=Math.max(0,Math.floor(p-y)),x=Math.min(i.rows-1,Math.ceil(p+y)),b=Math.max(0,Math.floor(n-y)),H=Math.min(i.cols-1,Math.ceil(n+y));for(let E=R;E<=x;E++)for(let k=b;k<=H;k++){const q=k-n,A=E-p,S=2.5+(o[E]?.[k]??0);q*q+A*A<S*S&&d[E]&&(d[E][k]=j)}c||(c=!0,m())}return e.addEventListener("mousemove",g),()=>{e.removeEventListener("mousemove",g),cancelAnimationFrame(r)}}const Y=P.forwardRef(function({side:t,src:f},o){const d=P.useRef(null),w=P.useRef(L);return P.useImperativeHandle(o,()=>d.current),P.useEffect(()=>{const v=d.current;if(!v)return;let l=!1,c=null;const r=document.createElement("canvas");r.width=240,r.height=300;const M=r.getContext("2d");function m(n){l||!n.cols||(w.current=n,v.textContent=n.chars.map(p=>p.join("")).join(`
`))}function g(){return window.innerWidth<1400?44:56}function s(){M&&(D(M,r.width,r.height,t==="right"),m(N(r,r.width,r.height,g(),t==="left"?11:97)))}function i(){if(c){const n=N(c,c.naturalWidth,c.naturalHeight,g(),t==="left"?11:97);if(n.cols){m(n);return}c=null}s()}if(f){const n=new Image;n.crossOrigin="anonymous",n.onload=()=>{l||(c=n,i())},n.onerror=()=>{l||i()},n.src=f}else i();let u=0;const h=()=>{window.clearTimeout(u),u=window.setTimeout(i,150)};window.addEventListener("resize",h);const a=G(v,()=>w.current);return()=>{l=!0,a(),window.removeEventListener("resize",h),window.clearTimeout(u)}},[t,f]),C.jsx("pre",{ref:d,className:`footer-ascii footer-ascii-${t}`,"aria-hidden":"true"})});function J({leftSrc:e,rightSrc:t}){const f=P.useRef(null),o=P.useRef(null),d=P.useRef(null),w=P.useRef(null),v=P.useRef(null);return P.useEffect(()=>{F();const l=f.current,c=o.current,r=d.current;if(!l||!c||!r)return;T.set(c,{xPercent:-100}),T.set(r,{xPercent:100});const M=O.create({trigger:l,start:"top bottom",end:"top 40%",scrub:!0,onUpdate:R=>{T.set(c,{xPercent:-100*(1-R.progress)}),T.set(r,{xPercent:100*(1-R.progress)})}}),m=w.current,g=v.current,s=m?T.quickTo(m,"x",{duration:.7,ease:"power3.out"}):null,i=m?T.quickTo(m,"y",{duration:.7,ease:"power3.out"}):null,u=m?T.quickTo(m,"rotation",{duration:.7,ease:"power3.out"}):null,h=g?T.quickTo(g,"x",{duration:.7,ease:"power3.out"}):null,a=g?T.quickTo(g,"y",{duration:.7,ease:"power3.out"}):null,n=g?T.quickTo(g,"rotation",{duration:.7,ease:"power3.out"}):null;let p=!1;const j=R=>{if(!p)return;const x=(R.clientX/window.innerWidth-.5)*2,b=(R.clientY/window.innerHeight-.5)*2;s?.(Math.min(0,x*-40-12)),h?.(Math.max(0,x*40+12)),i?.(b*-22),a?.(b*-22),u?.(x*4),n?.(-x*4)};window.addEventListener("mousemove",j,{passive:!0});const y=new IntersectionObserver(R=>{p=!!R[0]?.isIntersecting},{threshold:.05});return y.observe(l),()=>{M.kill(),y.disconnect(),window.removeEventListener("mousemove",j)}},[]),C.jsxs("div",{ref:f,className:"footer-ascii-wrap",children:[C.jsx("div",{ref:o,className:"footer-ascii-panel left",children:C.jsx(Y,{ref:w,side:"left",src:e})}),C.jsx("div",{ref:d,className:"footer-ascii-panel right",children:C.jsx(Y,{ref:v,side:"right",src:t})}),C.jsx("style",{dangerouslySetInnerHTML:{__html:`
        .footer-ascii-wrap {
          position: absolute;
          inset: 0;
          display: flex;
          justify-content: space-between;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }
        .footer-ascii-panel {
          display: flex;
          align-items: center;
          height: 100%;
          will-change: transform;
        }
        .footer-ascii-panel.left {
          justify-content: flex-start;
        }
        .footer-ascii-panel.right {
          justify-content: flex-end;
        }
        .footer-ascii {
          font-family: Consolas, Menlo, monospace;
          font-size: clamp(0.32rem, 0.45vw, 0.55rem);
          line-height: 1.1;
          letter-spacing: 0.4em;
          color: var(--accent);
          opacity: 0.85;
          white-space: pre;
          user-select: none;
          pointer-events: auto;
          cursor: default;
          margin: 0;
          will-change: transform;
        }
        .fa-hit {
          color: var(--bg);
          background: var(--accent);
        }
        @media (max-width: 1200px) {
          .footer-ascii-panel.right {
            display: none;
          }
        }
        @media (max-width: 640px) {
          .footer-ascii-wrap {
            display: none;
          }
        }
      `}})]})}export{J as default};

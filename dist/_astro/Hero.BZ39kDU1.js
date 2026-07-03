import{j as e}from"./jsx-runtime.TBa3i5EZ.js";import{r as a}from"./index.CVf8TyFT.js";import{e as S,S as T}from"./gsap.nAyxWsi1.js";import{H as d}from"./HoverLink.B0IyrS8h.js";import{g as _}from"./index.SFc2wnMY.js";const v=[{label:"GitHub",href:"https://github.com/your-handle"},{label:"LinkedIn",href:"https://linkedin.com/in/your-handle"},{label:"Behance",href:"https://behance.net/your-handle"}],z=[{label:"Work",href:"/work"},{label:"Info",href:"/info"},{label:"Contact",href:"/contact"}],N=10,j=300,w=-3200,A=700,y=Array.from({length:N},(s,o)=>({startZ:w-o*j,size:200+o*46,shape:o%2===0?"is-square":"is-circle"})),I=A-(w-(N-1)*j),F=.12;function L(){const s=a.useRef(null),o=a.useRef(null),m=a.useRef(null),f=a.useRef([]),[i,R]=a.useState(!0);return a.useEffect(()=>{s.current&&_.fromTo(s.current,{opacity:0,y:16},{opacity:1,y:0,duration:1,delay:.6,ease:"power3.out"})},[]),a.useEffect(()=>{R(!window.matchMedia("(prefers-reduced-motion: reduce)").matches)},[]),a.useEffect(()=>{if(!i)return;S();const r=o.current,t=m.current;if(!r||!t)return;const l=f.current.filter(c=>c!==null),k=T.create({trigger:r,start:"top top",end:"bottom bottom",scrub:!0,onUpdate:c=>{const h=c.progress;l.forEach((g,u)=>{const x=y[u].startZ,n=x+h*I;let b=Math.min(1,Math.max(0,(n-x)/300));n>-150&&(b*=Math.max(0,1-(n+150)/500));const E=(u%2?1:-1)*h*30;g.style.transform=`translate3d(-50%, -50%, ${n.toFixed(1)}px) rotateZ(${E.toFixed(2)}deg)`,g.style.opacity=b.toFixed(3)});const p=Math.min(1,h/F);t.style.opacity=(1-p).toFixed(3),t.style.filter=p>0?`blur(${(p*6).toFixed(1)}px)`:"none"}});return()=>{k.kill()}},[i]),e.jsxs("div",{ref:o,className:`hero-scroll-wrap${i?"":" is-compact"}`,children:[e.jsxs("section",{className:"hero",children:[e.jsx("div",{className:"hero-canvas","aria-hidden":"true",children:e.jsxs("div",{className:"hero-scene",children:[e.jsx("div",{className:"hero-scene-glow"}),y.map((r,t)=>e.jsx("div",{ref:l=>{f.current[t]=l},className:`hero-ring ${r.shape}`,style:{width:`${r.size}px`,height:`${r.size}px`}},t))]})}),e.jsxs("div",{ref:m,className:"hero-content",children:[e.jsxs("div",{ref:s,className:"hero-tagline",children:["Quiet creator, ",e.jsx("span",{className:"other-accent",children:"bringing ideas to life"}),",",e.jsx("br",{}),"through motion, detail and softness."]}),e.jsxs("div",{className:"hero-bottom",children:[e.jsx("div",{className:"hero-name",children:"Your Name."}),e.jsx("div",{className:"hero-line"}),e.jsxs("div",{className:"hero-bar",children:[e.jsx("div",{className:"hero-bar-left",children:e.jsx(d,{label:"v1.0"})}),e.jsx("nav",{className:"hero-bar-center","aria-label":"Social links",children:v.map((r,t)=>e.jsxs("span",{style:{display:"flex",gap:"0.5em"},children:[e.jsx("a",{href:r.href,target:"_blank",rel:"noopener noreferrer",children:e.jsx(d,{label:r.label})}),t<v.length-1&&e.jsx("span",{className:"sep",children:"/"})]},r.label))}),e.jsx("nav",{className:"hero-bar-right","aria-label":"Main navigation",children:z.map(r=>e.jsx("a",{href:r.href,children:e.jsx(d,{label:r.label})},r.label))})]})]})]})]}),e.jsx("style",{dangerouslySetInnerHTML:{__html:`
        .hero-scroll-wrap {
          position: relative;
          height: 400vh;
        }
        .hero-scroll-wrap.is-compact {
          height: 100vh;
        }
        .hero {
          position: sticky;
          top: 0;
          height: 100vh;
          min-height: 560px;
          overflow: hidden;
        }
        .hero-scroll-wrap.is-compact .hero {
          position: relative;
        }
        .hero-canvas {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: radial-gradient(circle at 50% 35%, var(--bg-elevated), var(--bg) 70%);
        }
        .hero-scene {
          position: absolute;
          inset: 0;
          perspective: 900px;
          overflow: hidden;
        }
        .hero-scene-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 62%);
        }
        .hero-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          border: 1px solid var(--accent);
          opacity: 0;
          will-change: transform, opacity;
        }
        .hero-ring.is-circle {
          border-radius: 50%;
          border-color: var(--fg);
        }
        .hero-ring.is-square {
          border-radius: 10px;
        }
        .hero-content {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          will-change: opacity, filter;
        }
        .hero-content > * {
          pointer-events: auto;
        }
        .hero-tagline {
          position: absolute;
          top: var(--container-pad);
          left: var(--container-pad);
          font-family: var(--font-display);
          font-size: clamp(0.75rem, 1vw, 0.95rem);
          font-weight: 600;
          line-height: 1.6;
          letter-spacing: -0.005em;
          max-width: 26ch;
        }
        .hero-bottom {
          position: absolute;
          left: var(--container-pad);
          right: var(--container-pad);
          bottom: var(--container-pad);
        }
        .hero-name {
          font-family: var(--font-display);
          font-size: clamp(2.5rem, 9vw, 6.5rem);
          font-weight: 700;
          letter-spacing: -0.03em;
          line-height: 0.9;
          margin-bottom: clamp(1.5rem, 4vw, 3rem);
        }
        .hero-line {
          height: 1px;
          background: var(--line);
          margin-bottom: 1rem;
        }
        .hero-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .hero-bar-center {
          display: flex;
          gap: 0.5em;
        }
        .hero-bar-right {
          display: flex;
          gap: 1.5em;
        }
        .sep {
          color: var(--fg-dim);
        }
        @media (max-width: 640px) {
          .hero-tagline {
            max-width: calc(100% - 2 * var(--container-pad));
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-ring {
            display: none;
          }
        }
      `}})]})}export{L as default};

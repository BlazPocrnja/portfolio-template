import{j as e}from"./jsx-runtime.TBa3i5EZ.js";import{r as n}from"./index.CVf8TyFT.js";import{g as s}from"./index.SFc2wnMY.js";import{H as t}from"./HoverLink.B0IyrS8h.js";const i=[{label:"GitHub",href:"https://github.com/your-handle"},{label:"LinkedIn",href:"https://linkedin.com/in/your-handle"},{label:"Behance",href:"https://behance.net/your-handle"}],o=[{label:"Work",href:"/work"},{label:"Info",href:"/info"},{label:"Contact",href:"/contact"}];function p(){const r=n.useRef(null);return n.useEffect(()=>{r.current&&s.fromTo(r.current,{opacity:0,y:16},{opacity:1,y:0,duration:1,delay:.6,ease:"power3.out"})},[]),e.jsxs("section",{className:"hero",children:[e.jsx("div",{className:"hero-canvas","aria-hidden":"true",children:e.jsx("div",{className:"hero-canvas-placeholder",children:"Hero canvas / WebGL slot"})}),e.jsxs("div",{className:"hero-content",children:[e.jsxs("div",{ref:r,className:"hero-tagline",children:["Quiet creator, ",e.jsx("span",{className:"other-accent",children:"bringing ideas to life"}),",",e.jsx("br",{}),"through motion, detail and softness."]}),e.jsx("div",{className:"hero-line"}),e.jsxs("div",{className:"hero-bar",children:[e.jsx("div",{className:"hero-bar-left",children:e.jsx(t,{label:"v1.0"})}),e.jsx("nav",{className:"hero-bar-center","aria-label":"Social links",children:i.map((a,l)=>e.jsxs("span",{style:{display:"flex",gap:"0.5em"},children:[e.jsx("a",{href:a.href,target:"_blank",rel:"noopener noreferrer",children:e.jsx(t,{label:a.label})}),l<i.length-1&&e.jsx("span",{className:"sep",children:"/"})]},a.label))}),e.jsx("nav",{className:"hero-bar-right","aria-label":"Main navigation",children:o.map(a=>e.jsx("a",{href:a.href,children:e.jsx(t,{label:a.label})},a.label))})]})]}),e.jsx("style",{children:`
        .hero {
          position: relative;
          height: 100vh;
          min-height: 560px;
          display: flex;
          align-items: flex-end;
          overflow: hidden;
        }
        .hero-canvas {
          position: absolute;
          inset: 0;
          z-index: 0;
        }
        .hero-canvas-placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 50% 35%, var(--bg-elevated), var(--bg) 70%);
          color: var(--fg-dim);
          font-size: 0.8rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .hero-content {
          position: relative;
          z-index: 1;
          width: 100%;
          padding: var(--container-pad);
          padding-bottom: clamp(1.5rem, 4vw, 3rem);
        }
        .hero-tagline {
          font-family: var(--font-display);
          font-size: clamp(1.4rem, 3.4vw, 2.6rem);
          font-weight: 600;
          letter-spacing: -0.01em;
          max-width: 22ch;
          margin-bottom: 1.5rem;
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
      `})]})}export{p as default};

import{j as e}from"./jsx-runtime.TBa3i5EZ.js";import{r as i}from"./index.CVf8TyFT.js";import{g as s}from"./index.SFc2wnMY.js";import{H as d}from"./HoverLink.B0IyrS8h.js";function v({projects:l}){const o=i.useRef(null),[t,a]=i.useState(null),n=i.useRef(null),c=i.useRef(null);i.useEffect(()=>{o.current&&(n.current=s.quickTo(o.current,"x",{duration:.5,ease:"power3.out"}),c.current=s.quickTo(o.current,"y",{duration:.5,ease:"power3.out"}))},[]),i.useEffect(()=>{o.current&&s.to(o.current,{opacity:t?1:0,duration:t?.4:.25,ease:t?"power2.out":"power2.in"})},[t]);const p=r=>{n.current?.(r.clientX),c.current?.(r.clientY)};return e.jsxs("div",{className:"projects-list",onMouseMove:p,children:[l.map(r=>e.jsxs("a",{href:`/work/${r.slug}`,className:"proj-item",onMouseEnter:()=>a(r),onMouseLeave:()=>a(null),children:[e.jsx("span",{className:"proj-item-title",children:e.jsx(d,{label:r.title})}),e.jsx("span",{className:"proj-item-date",children:r.date})]},r.slug)),e.jsx("div",{ref:o,className:"proj-preview","aria-hidden":"true",children:t&&e.jsxs("div",{className:"proj-card",children:[e.jsxs("div",{className:"proj-meta",children:[e.jsx("span",{children:t.date}),e.jsx("span",{children:"Preview"})]}),e.jsx("img",{src:t.cover,alt:"",width:480,height:360,loading:"lazy"})]})}),e.jsx("style",{children:`
        .projects-list {
          position: relative;
          border-top: 1px solid var(--line);
        }
        .proj-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.1rem 0.25rem;
          border-bottom: 1px solid var(--line);
          font-family: var(--font-display);
          font-size: clamp(1.25rem, 3vw, 2rem);
          transition: opacity 0.3s;
        }
        .projects-list:hover .proj-item {
          opacity: 0.35;
        }
        .proj-item:hover {
          opacity: 1 !important;
        }
        .proj-item-date {
          font-size: 0.8rem;
          color: var(--fg-dim);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .proj-preview {
          position: fixed;
          top: 0;
          left: 0;
          width: 220px;
          pointer-events: none;
          opacity: 0;
          z-index: 50;
          transform: translate(-50%, -50%);
        }
        .proj-card {
          background: var(--bg-elevated);
          border: 1px solid var(--line);
          overflow: hidden;
          border-radius: 4px;
        }
        .proj-meta {
          display: flex;
          justify-content: space-between;
          padding: 0.4rem 0.6rem;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--fg-dim);
        }
        .proj-card img {
          width: 100%;
          aspect-ratio: 4 / 3;
          object-fit: cover;
        }
        @media (hover: none) {
          .proj-preview { display: none; }
        }
      `})]})}export{v as default};

import{j as e}from"./jsx-runtime.TBa3i5EZ.js";import{r as i}from"./index.CVf8TyFT.js";import{g as l}from"./index.SFc2wnMY.js";function p({text:t,speed:s=60}){const a=i.useRef(null);return i.useEffect(()=>{const r=a.current;if(!r)return;const n=r.scrollWidth/2,o=l.to(r,{x:-n,duration:n/s,ease:"none",repeat:-1});return()=>{o.kill()}},[s]),e.jsxs("div",{className:"marquee",children:[e.jsxs("div",{ref:a,className:"marquee-track",children:[e.jsxs("span",{children:[t," "]}),e.jsxs("span",{"aria-hidden":"true",children:[t," "]})]}),e.jsx("style",{children:`
        .marquee {
          overflow: hidden;
          white-space: nowrap;
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          padding: 0.6rem 0;
        }
        .marquee-track {
          display: inline-flex;
          font-size: 0.8rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--fg-dim);
        }
      `})]})}export{p as default};

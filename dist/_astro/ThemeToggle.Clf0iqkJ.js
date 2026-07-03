import{j as r}from"./jsx-runtime.TBa3i5EZ.js";import{r as a}from"./index.CVf8TyFT.js";import{H as m}from"./HoverLink.B0IyrS8h.js";function i(){return typeof document>"u"?"dark":document.documentElement.getAttribute("data-theme")==="light"?"light":"dark"}function l(){const[t,o]=a.useState("dark");a.useEffect(()=>{o(i())},[]);const n=()=>{const e=t==="dark"?"light":"dark";o(e),document.documentElement.setAttribute("data-theme",e),document.querySelector('meta[name="theme-color"]')?.setAttribute("content",e==="light"?"#f7f6f3":"#0a0a0a");try{localStorage.setItem("theme",e)}catch{}};return r.jsxs("button",{type:"button",className:"theme-toggle chr-hover",onClick:n,"aria-label":`Switch to ${t==="dark"?"light":"dark"} mode`,children:[r.jsx(m,{label:t==="dark"?"Light":"Dark"}),r.jsx("style",{children:`
        .theme-toggle {
          position: fixed;
          top: 1.5rem;
          right: 1.5rem;
          z-index: 300;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 0.5em 0.9em;
          border: 1px solid var(--line);
          border-radius: 50px;
          background: var(--bg);
        }
      `})]})}export{l as default};

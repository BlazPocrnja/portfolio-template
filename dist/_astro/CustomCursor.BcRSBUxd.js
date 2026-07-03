import{j as d}from"./jsx-runtime.TBa3i5EZ.js";import{r as u}from"./index.CVf8TyFT.js";import{g as o}from"./index.SFc2wnMY.js";function v(){const n=u.useRef(null);return u.useEffect(()=>{if(window.matchMedia("(hover: none)").matches)return;const e=n.current;if(!e)return;const a=o.quickTo(e,"x",{duration:.35,ease:"power3.out"}),c=o.quickTo(e,"y",{duration:.35,ease:"power3.out"}),t=i=>{a(i.clientX),c(i.clientY)},r=()=>o.to(e,{scale:.7,duration:.2}),s=()=>o.to(e,{scale:1,duration:.2});return window.addEventListener("mousemove",t,{passive:!0}),window.addEventListener("mousedown",r),window.addEventListener("mouseup",s),()=>{window.removeEventListener("mousemove",t),window.removeEventListener("mousedown",r),window.removeEventListener("mouseup",s)}},[]),d.jsx("div",{ref:n,className:"custom-cursor","aria-hidden":"true",children:d.jsx("style",{children:`
        .custom-cursor {
          position: fixed;
          top: 0;
          left: 0;
          width: 10px;
          height: 10px;
          margin: -5px 0 0 -5px;
          border-radius: 50%;
          background: var(--fg);
          pointer-events: none;
          z-index: 999;
          mix-blend-mode: difference;
        }
        @media (hover: none) {
          .custom-cursor { display: none; }
        }
      `})})}export{v as default};

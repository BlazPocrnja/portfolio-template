import{j as f}from"./jsx-runtime.TBa3i5EZ.js";import{r as l}from"./index.CVf8TyFT.js";import{g as s}from"./index.SFc2wnMY.js";const w='a, button, [role="button"], input, textarea, select, label, summary, .chr-hover';function L(){const i=l.useRef(null);return l.useEffect(()=>{if(window.matchMedia("(hover: none)").matches)return;const t=i.current;if(!t)return;const v=s.quickTo(t,"x",{duration:.35,ease:"power3.out"}),p=s.quickTo(t,"y",{duration:.35,ease:"power3.out"});let n=!1,r=!1;const o=()=>{s.to(t,{scale:r?2.4:n?.7:1,duration:.25,ease:"power3.out"})},u=e=>{v(e.clientX),p(e.clientY)},a=()=>{n=!0,o()},d=()=>{n=!1,o()},c=e=>{e.target instanceof Element&&e.target.closest(w)&&(r=!0,o())},m=e=>{e.target instanceof Element&&e.target.closest(w)&&(r=!1,o())};return window.addEventListener("mousemove",u,{passive:!0}),window.addEventListener("mousedown",a),window.addEventListener("mouseup",d),window.addEventListener("mouseover",c),window.addEventListener("mouseout",m),()=>{window.removeEventListener("mousemove",u),window.removeEventListener("mousedown",a),window.removeEventListener("mouseup",d),window.removeEventListener("mouseover",c),window.removeEventListener("mouseout",m)}},[]),f.jsx("div",{ref:i,className:"custom-cursor","aria-hidden":"true",children:f.jsx("style",{children:`
        .custom-cursor {
          position: fixed;
          top: 0;
          left: 0;
          width: 10px;
          height: 10px;
          margin: -5px 0 0 -5px;
          border-radius: 50%;
          background: #fff;
          pointer-events: none;
          z-index: 999;
          mix-blend-mode: difference;
        }
        @media (hover: none) {
          .custom-cursor { display: none; }
        }
      `})})}export{L as default};

import{j as e}from"./jsx-runtime.TBa3i5EZ.js";import{r}from"./index.CVf8TyFT.js";import{g as p}from"./index.SFc2wnMY.js";function y(){const n=r.useRef(null),o=r.useRef(null),s=r.useRef(null),[c,d]=r.useState(!1);return r.useEffect(()=>{const t=window.matchMedia("(prefers-reduced-motion: reduce)").matches,a=sessionStorage.getItem("has-seen-intro");if(t||a){d(!0);return}document.documentElement.style.overflow="hidden";const l=n.current?.querySelectorAll(".pre-letter"),i=p.timeline({delay:.2,onComplete:()=>{document.documentElement.style.overflow="",sessionStorage.setItem("has-seen-intro","1")}});return i.set(l??[],{yPercent:110}).to(l??[],{yPercent:0,duration:.9,ease:"power3.out",stagger:.035}).to({},{duration:.5}).to(o.current,{yPercent:-100,duration:.8,ease:"power3.inOut"},"+=0").to(s.current,{yPercent:-100,duration:.8,ease:"power3.inOut"},"<0.08").to(n.current,{autoAlpha:0,duration:.2},"<0.4"),()=>{i.kill()}},[]),c?null:e.jsxs("div",{ref:n,className:"preloader","aria-hidden":"true",children:[e.jsx("div",{className:"preloader-name",children:"Your Name.".split("").map((t,a)=>e.jsx("span",{className:"pre-letter-wrap",children:e.jsx("span",{className:"pre-letter",children:t===" "?" ":t})},a))}),e.jsx("div",{ref:o,className:"preloader-panel panel-dark"}),e.jsx("div",{ref:s,className:"preloader-panel panel-accent"}),e.jsx("style",{children:`
        .preloader {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg);
        }
        .preloader-name {
          display: flex;
          font-family: var(--font-display);
          font-size: clamp(2rem, 6vw, 4.5rem);
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .pre-letter-wrap {
          overflow: hidden;
          display: inline-block;
        }
        .pre-letter {
          display: inline-block;
          will-change: transform;
        }
        .preloader-panel {
          position: fixed;
          inset: 0;
          will-change: transform;
        }
        .panel-dark {
          background: var(--bg);
          z-index: 1;
        }
        .panel-accent {
          background: var(--accent);
          z-index: 2;
          mix-blend-mode: normal;
          opacity: 0.9;
        }
      `})]})}export{y as default};

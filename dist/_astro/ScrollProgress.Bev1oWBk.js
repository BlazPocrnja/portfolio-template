import{j as l}from"./jsx-runtime.TBa3i5EZ.js";import{r as a}from"./index.CVf8TyFT.js";import{e as k,S as C}from"./gsap.nAyxWsi1.js";import{g as H}from"./lenis.B5MZ3CbB.js";import"./index.SFc2wnMY.js";function F({sections:g}){const h=a.useRef(null),x=a.useRef(null),b=a.useRef(null),v=a.useRef(null);return a.useEffect(()=>{k();const c=h.current,y=x.current,p=b.current,m=v.current;if(!c||!y||!p||!m||!g.length)return;const n=g.map(e=>({...e,el:document.getElementById(e.id)})).filter(e=>e.el!==null);if(!n.length)return;c.innerHTML="";const w=window.scrollY||window.pageYOffset,E=n[0].el.getBoundingClientRect().top+w,d=n[n.length-1].el,j=d.getBoundingClientRect().top+d.offsetHeight+w,L=Math.max(1,j-E),i=n.map(e=>{const o=e.el.offsetHeight/L,t=document.createElement("div");t.className="sp-seg",t.style.flex=o.toFixed(4),t.title=e.label;const r=document.createElement("div");return r.className="sp-seg-fill",t.appendChild(r),c.appendChild(t),t.addEventListener("click",()=>{const s=H();s?s.scrollTo(e.el,{offset:0,duration:1.2}):e.el.scrollIntoView({behavior:"smooth",block:"start"})}),{ratio:o,fill:r,label:e.label}}),z=C.create({trigger:n[0].el,start:"top bottom",endTrigger:d,end:"bottom bottom",onUpdate:e=>{const o=e.progress;if(p.textContent=`(${Math.round(o*100)})`,o<=0||o>=.95){m.classList.remove("visible"),p.classList.remove("visible");return}m.classList.add("visible"),p.classList.add("visible");let t=0,r=0;for(let s=0;s<i.length;s++){const f=i[s],M=t,R=t+f.ratio;if(o<R){const T=(o-M)/f.ratio;f.fill.style.height=`${Math.min(1,Math.max(0,T))*100}%`,r=s;for(let u=s+1;u<i.length;u++)i[u].fill.style.height="0%";break}f.fill.style.height="100%",r=s,t=R}y.textContent=i[r]?.label??""}});return()=>{z.kill(),c.innerHTML=""}},[g]),l.jsxs(l.Fragment,{children:[l.jsx("div",{ref:b,className:"scroll-pct","aria-hidden":"true",children:"(0)"}),l.jsxs("div",{ref:v,className:"scroll-progress","aria-hidden":"true",children:[l.jsx("span",{ref:x,className:"sp-label"}),l.jsx("div",{ref:h,className:"sp-bar"})]}),l.jsx("style",{dangerouslySetInnerHTML:{__html:`
        .scroll-progress {
          position: fixed;
          right: 2rem;
          top: 50%;
          transform: translateY(-50%);
          z-index: 500;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 42vh;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.4s;
        }
        .scroll-progress.visible {
          opacity: 1;
        }
        .sp-label {
          position: absolute;
          right: 0;
          bottom: calc(100% + 10px);
          font-size: clamp(0.65rem, 0.9vw, 0.8rem);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--fg);
          white-space: nowrap;
          text-align: right;
        }
        .sp-bar {
          position: relative;
          width: 2px;
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .sp-seg {
          flex: 1;
          position: relative;
          background: var(--line);
          cursor: pointer;
          pointer-events: auto;
          transform-origin: center;
          transition: transform 0.35s var(--ease-out);
        }
        .scroll-progress:not(.visible) .sp-seg {
          pointer-events: none;
        }
        .sp-seg:hover {
          transform: scaleX(3);
        }
        .sp-seg::before {
          content: '';
          position: absolute;
          inset: 0 -10px;
        }
        .sp-seg-fill {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 0%;
          background: var(--fg);
        }
        .scroll-pct {
          position: fixed;
          left: 2rem;
          top: 50%;
          transform: translateY(-50%);
          z-index: 500;
          font-size: clamp(0.7rem, 1vw, 0.85rem);
          letter-spacing: 0.05em;
          color: var(--fg);
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.4s;
        }
        .scroll-pct.visible {
          opacity: 1;
        }
        @media (max-width: 768px) {
          .scroll-progress,
          .scroll-pct {
            display: none;
          }
        }
      `}})]})}export{F as default};

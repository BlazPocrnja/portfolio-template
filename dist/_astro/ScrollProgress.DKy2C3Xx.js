import{j as o}from"./jsx-runtime.TBa3i5EZ.js";import{r as c}from"./index.CVf8TyFT.js";import{e as C,S as N}from"./gsap.nAyxWsi1.js";import{g as Y}from"./lenis.B5MZ3CbB.js";import"./index.SFc2wnMY.js";function P({sections:d}){const b=c.useRef(null),w=c.useRef(null),y=c.useRef(null),E=c.useRef(null);return c.useEffect(()=>{C();const p=b.current,m=w.current,g=y.current,u=E.current;if(!p||!m||!g||!u||!d.length)return;const r=d.map(e=>({...e,el:document.getElementById(e.id)})).filter(e=>e.el!==null);if(!r.length)return;p.innerHTML="";const R=window.scrollY||window.pageYOffset,H=r[0].el.getBoundingClientRect().top+R,h=r[r.length-1].el,L=h.getBoundingClientRect().top+h.offsetHeight+R,z=Math.max(1,L-H),i=r.map(e=>{const s=e.el.offsetHeight/z,t=document.createElement("div");t.className="sp-seg",t.style.flex=s.toFixed(4),t.title=e.label;const a=document.createElement("div");return a.className="sp-seg-fill",t.appendChild(a),p.appendChild(t),t.addEventListener("click",()=>{const l=Y();l?l.scrollTo(e.el,{offset:0,duration:1.2}):e.el.scrollIntoView({behavior:"smooth",block:"start"})}),{ratio:s,fill:a,label:e.label}}),M=N.create({trigger:r[0].el,start:"top bottom",endTrigger:h,end:"bottom bottom",onUpdate:e=>{const s=e.progress,t=document.documentElement.scrollHeight-window.innerHeight,a=t>0?Math.round(window.scrollY/t*100):0;if(g.textContent=`(${a})`,s<=0||s>=.95){u.classList.remove("visible"),g.classList.remove("visible");return}u.classList.add("visible"),g.classList.add("visible");let l=0,x=0;for(let n=0;n<i.length;n++){const f=i[n],T=l,j=l+f.ratio;if(s<j){const k=(s-T)/f.ratio;f.fill.style.height=`${Math.min(1,Math.max(0,k))*100}%`,x=n;for(let v=n+1;v<i.length;v++)i[v].fill.style.height="0%";break}f.fill.style.height="100%",x=n,l=j}m.textContent=i[x]?.label??"",m.style.top=`${(s*100).toFixed(1)}%`}});return()=>{M.kill(),p.innerHTML=""}},[d]),o.jsxs(o.Fragment,{children:[o.jsx("div",{ref:y,className:"scroll-pct","aria-hidden":"true",children:"(0)"}),o.jsxs("div",{ref:E,className:"scroll-progress","aria-hidden":"true",children:[o.jsx("span",{ref:w,className:"sp-label"}),o.jsx("div",{ref:b,className:"sp-bar"})]}),o.jsx("style",{dangerouslySetInnerHTML:{__html:`
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
          right: calc(100% + 14px);
          font-size: clamp(0.7rem, 1vw, 0.85rem);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--fg);
          white-space: nowrap;
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
      `}})]})}export{P as default};

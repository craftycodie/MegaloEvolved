import{s as B,i as b,A as C}from"./index-KDSw776v.js";import{d as L,l as T,g as x}from"./openDocs-7EBwMvAU.js";B();const g=`${C} Docs`,E=document.querySelector("#docs-back"),M=document.querySelector("#docs-forward"),q=document.querySelector(".docs-chrome-title"),u=document.querySelector("#docs-frame"),P=document.querySelector(".docs-chrome"),y=document.querySelector("#docs-window-controls"),R=new URLSearchParams(window.location.search).get("path");u.src=L(R);let r=0,h=1,d=!1,c=null;const p=`
  <svg aria-hidden="true" viewBox="0 0 12 12">
    <rect fill="none" height="8" stroke="currentColor" stroke-width="1" width="8" x="2" y="2" />
  </svg>
`,A=`
  <svg aria-hidden="true" viewBox="0 0 12 12">
    <rect fill="none" height="6" stroke="currentColor" stroke-width="1" width="6" x="3.5" y="1.5" />
    <rect fill="#252526" height="6" stroke="currentColor" stroke-width="1" width="6" x="1.5" y="3.5" />
  </svg>
`,l=()=>{E.disabled=r<=0,M.disabled=r>=h-1},k=()=>u.contentWindow,v=t=>{const e=t.trim()||g;q.textContent=e,document.title=e,b()&&x().setTitle(e)},n=()=>{var t,e;try{const o=(e=(t=u.contentDocument)==null?void 0:t.title)==null?void 0:e.trim();v(o||g)}catch{v(g)}},I=t=>{c==null||c.disconnect(),c=null,n();const o=t.document.querySelector("title");o&&(c=new MutationObserver(()=>{n()}),c.observe(o,{childList:!0,characterData:!0,subtree:!0}))},w=()=>{const t=k();!t||r<=0||(d=!0,r-=1,l(),t.history.back(),queueMicrotask(()=>{d=!1,n()}))},m=()=>{const t=k();!t||r>=h-1||(d=!0,r+=1,l(),t.history.forward(),queueMicrotask(()=>{d=!1,n()}))},N=()=>{d||(r+=1,h=r+1,l(),n())},W=()=>{n()},H=t=>{const{history:e}=t,o=e.pushState.bind(e),i=e.replaceState.bind(e);e.pushState=((s,a,f)=>{o(s,a,f),N()}),e.replaceState=((s,a,f)=>{i(s,a,f),W()}),t.addEventListener("popstate",()=>{d||l(),n()})},F=()=>{if(!b())return;const t=x();y.innerHTML=`
    <div aria-label="Window controls" class="window-controls" role="group">
      <button aria-label="Minimize" class="window-control" type="button" data-action="minimize">
        <svg aria-hidden="true" viewBox="0 0 12 12">
          <rect fill="currentColor" height="1" width="8" x="2" y="6" />
        </svg>
      </button>
      <button aria-label="Maximize" class="window-control" type="button" data-action="maximize">
        ${p}
      </button>
      <button aria-label="Close" class="window-control window-control-close" type="button" data-action="close">
        <svg aria-hidden="true" viewBox="0 0 12 12">
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-linecap="round" stroke-width="1.1" />
        </svg>
      </button>
    </div>
  `;const e=y.querySelector('[data-action="maximize"]'),o=async()=>{const i=await t.isMaximized();e.innerHTML=i?A:p,e.setAttribute("aria-label",i?"Restore":"Maximize")};o(),t.onResized(()=>{o()}),y.addEventListener("click",i=>{var a;const s=(a=i.target)==null?void 0:a.closest("[data-action]");if(s)switch(s.dataset.action){case"minimize":t.minimize();break;case"maximize":t.toggleMaximize();break;case"close":t.close();break}}),P.addEventListener("dblclick",i=>{i.target.closest("button")||t.toggleMaximize()})};E.addEventListener("click",w);M.addEventListener("click",m);const z=t=>{if(!t.defaultPrevented){if(t.key==="BrowserBack"||t.code==="BrowserBack"){t.preventDefault(),w();return}if(t.key==="BrowserForward"||t.code==="BrowserForward"){t.preventDefault(),m();return}if(t.altKey&&(t.key==="ArrowLeft"||t.key==="Left")){t.preventDefault(),w();return}t.altKey&&(t.key==="ArrowRight"||t.key==="Right")&&(t.preventDefault(),m())}},D=t=>{t.button===3?(t.preventDefault(),w()):t.button===4&&(t.preventDefault(),m())},S=t=>{(t.button===3||t.button===4)&&t.preventDefault()};window.addEventListener("keydown",z);window.addEventListener("mouseup",D);window.addEventListener("mousedown",S);u.addEventListener("load",()=>{const t=k();if(t){r=0,h=1,l(),H(t),I(t);try{t.addEventListener("keydown",z),t.addEventListener("mouseup",D),t.addEventListener("mousedown",S)}catch{}}});b()&&T(t=>{u.src=L(t)});F();l();

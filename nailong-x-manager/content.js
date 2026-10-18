(()=>{
  if(window.__nlxmInstalled)return;
  window.__nlxmInstalled=true;
  let active=false, timer=null, lastCount=0, busy=false;
  const valid=/^[A-Za-z0-9_]{1,15}$/;
  const reserved=new Set(['home','explore','notifications','messages','compose','search','settings','i','intent','share','login','signup','premium','verified_followers','followers','following','lists','communities','status']);
  function kind(){const m=location.pathname.match(/^\/[^/]+\/(following|followers)\/?$/);return m?.[1]||null;}
  function scan(){
    const found=new Map();
    for(const cell of document.querySelectorAll('[data-testid="UserCell"]')){
      const anchors=[...cell.querySelectorAll('a[href]')];
      const a=anchors.find(el=>{try{const p=new URL(el.href).pathname.split('/').filter(Boolean);return p.length===1&&valid.test(p[0])&&!reserved.has(p[0].toLowerCase());}catch{return false;}});
      if(!a)continue;
      const username=new URL(a.href).pathname.slice(1);
      const txt=cell.innerText||'';
      const followsYou=/(Follows you|关注了你|關注了你)/i.test(txt);
      found.set(username.toLowerCase(),{username,displayName:(txt.split('\n')[0]||'').slice(0,150),followsYou});
    }
    return [...found.values()];
  }
  function publish(message){chrome.runtime.sendMessage({type:'NLXM_STATUS',...message}).catch(()=>{});}
  async function collect(){if(busy)return;busy=true;try{await collectOnce();}finally{busy=false;}}
  async function collectOnce(){const k=kind();if(!k){publish({active:false,error:'Open your /following or /followers page'});return;}
    const users=scan();if(!users.length)return;
    try{const r=await chrome.runtime.sendMessage({type:'NLXM_BATCH',kind:k,users});lastCount=r.total||lastCount;publish({active,kind:k,total:lastCount,added:r.added||0,error:r.error});}catch(e){publish({active,error:e.message});}
  }
  function start(){if(active)return;active=true;collect();timer=setInterval(collect,2500);publish({active,kind:kind(),total:lastCount});}
  function stop(){active=false;if(timer)clearInterval(timer);timer=null;publish({active:false,kind:kind(),total:lastCount});}
  chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
    if(msg?.type==='NLXM_START'){start();reply({ok:true,active});}
    if(msg?.type==='NLXM_STOP'){stop();reply({ok:true,active});}
    if(msg?.type==='NLXM_STATUS_QUERY')reply({ok:true,active,kind:kind(),total:lastCount,visible:scan().length});
  });
  window.addEventListener('pagehide',stop);
})();

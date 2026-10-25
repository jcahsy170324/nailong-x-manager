(()=>{
  if(window.__nlxmInstalled)return;
  window.__nlxmInstalled=true;
  let active=false, timer=null, lastCount=0, pending=null, sessionPath=null;
  const valid=/^[A-Za-z0-9_]{1,15}$/;
  const reserved=new Set(['home','explore','notifications','messages','compose','search','settings','i','intent','share','login','signup','premium','verified_followers','followers','following','lists','communities','status']);
  function kind(){const m=location.pathname.match(/^\/[^/]+\/(following|followers|verified_followers|followers_you_follow)\/?$/);return m?(m[1]==='following'?'following':'followers'):null;}
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
  function collect(){if(pending)return pending;if(sessionPath!==location.pathname){active=false;if(timer)clearInterval(timer);timer=null;return Promise.resolve({ok:false,error:'页面已切换，请在目标列表重新开始采集'});}pending=collectOnce().finally(()=>{pending=null;});return pending;}
  async function collectOnce(){const k=kind();if(!k){const r={ok:false,error:'请打开关注、粉丝或认证粉丝列表'};publish({active:false,...r});return r;}
    const users=scan();if(!users.length)return;
    try{const r=await chrome.runtime.sendMessage({type:'NLXM_BATCH',kind:k,users});if(!r?.ok)throw Error(r?.error||'保存失败');lastCount=r.total;publish({active,kind:k,total:lastCount,added:r.added||0});return r;}catch(e){publish({active,error:e.message});return {ok:false,error:e.message};}
  }
  async function start(){if(active)return {ok:true,active};if(!kind())return {ok:false,active:false,error:'请打开关注、粉丝或认证粉丝列表后再开始采集'};active=true;sessionPath=location.pathname;timer=setInterval(collect,2500);const r=await collect();return {ok:r?.ok!==false,active,total:lastCount,error:r?.error};}
  async function stop(){active=false;if(timer)clearInterval(timer);timer=null;if(pending)await pending;const r=sessionPath?await collect():null;publish({active:false,kind:kind(),total:lastCount,error:r?.error});return {ok:r?.ok!==false,active:false,total:lastCount,error:r?.error};}
  chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
    if(msg?.type==='NLXM_PROFILE_QUERY'){const result=globalThis.NLXMProfiles?.inspect(document,location.pathname,msg.username,getComputedStyle);let rate=null;try{rate=globalThis.NLXMProfiles?.rateLimitSignal(performance.getEntriesByType('resource'));}catch{}reply({ok:true,page:{path:location.pathname,readyState:document.readyState,visibility:document.visibilityState,hasMain:!!document.querySelector('main'),hasAppRoot:!!document.querySelector('#react-root'),bodyTextLength:(document.body?.innerText||'').length},...result,...rate});return;}
    if(msg?.type==='NLXM_START'){start().then(reply);return true;}
    if(msg?.type==='NLXM_STOP'){stop().then(reply);return true;}
    if(msg?.type==='NLXM_STATUS_QUERY')reply({ok:true,active,kind:kind(),total:lastCount,visible:scan().length});
  });
  window.addEventListener('pagehide',()=>{active=false;if(timer)clearInterval(timer);timer=null;});
})();

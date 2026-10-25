(()=>{
  const PROFILE_KEY='nlxm_profiles_v1';
  const LOG_KEY='nlxm_profile_logs_v1';
  const COOLDOWN_KEY='nlxm_profile_cooldown_v1';
  let cooldown=null;
  let logs=[],logWrites=Promise.resolve(),version=0,view=null;
  let records={},running=false,paused=false,progress='尚未补采',loaded=false,inspectTabId=null;
  const tabIds=new Set();
  const el=id=>document.getElementById(id);
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const now=()=>globalThis.performance?.now?.()??Date.now();
  const limit=()=>{const n=Number(el('profileLimit').value);return Number.isSafeInteger(n)&&n>=0?n:800;};
  const followers=()=>Object.entries(db?.followers||{});
  const results=()=>followers().filter(([id])=>NLXMProfiles.matches(records[id],limit())).map(([id,u])=>({...u,...records[id]}));
  function renderLogs(){
    el('profileLogCount').textContent=`诊断日志 ${logs.length} 条（本地保留最近 300 条）`;
    el('profileLogText').textContent=logs.slice(-80).reverse().map(log=>`${new Date(log.at).toLocaleString()} [${log.level}] ${log.username?'@'+log.username+' ':''}${log.stage||''} ${log.reason||''}\n${JSON.stringify(log,null,2)}`).join('\n\n')||'暂无诊断日志。读取失败时会自动展开；可导出 JSON 查看完整记录。';
    el('profileLogExport').disabled=!logs.length;
  }
  function addLog(event){
    logs.push({at:Date.now(),...event});logs=logs.slice(-300);
    if(event.level==='error'||event.level==='blocked')el('profileLogDetails').open=true;
    renderLogs();
    const snapshot=logs.slice();logWrites=logWrites.catch(()=>{}).then(()=>chrome.storage.local.set({[LOG_KEY]:snapshot}));
  }
  function renderProfiles(){
    if(!loaded)return;
    const redraw=!view||view.version!==version||view.limit!==limit()||view.followers!==db?.followers;
    if(redraw){const users=followers(),issues=users.filter(([id])=>records[id]&&(!NLXMProfiles.resolved(records[id],limit())||records[id].lastAttemptError));view={version,limit:limit(),followers:db?.followers,users,issues,checked:users.filter(([id])=>NLXMProfiles.resolved(records[id],limit())).length,failed:issues.filter(([id])=>records[id].status==='error'||records[id].lastAttemptError).length,matches:results()};}
    const {users,issues,checked,failed,matches}=view;
    el('profileProgress').textContent=`${progress} · 名单 ${users.length} · 已读取 ${checked} · 待核实 ${issues.length-failed} · 读取失败 ${failed} · 符合条件 ${matches.length}（粉丝数 ≤${limit()}）`;
    el('profileStart').disabled=running;el('profileStop').disabled=!running;el('profileExport').disabled=!matches.length;
    el('clear').disabled=running;el('restore').disabled=running;
    el('profileForeground').disabled=running;el('profileParallel').disabled=running||el('profileForeground').checked;
    el('profileWorkers').disabled=running||el('profileForeground').checked||!el('profileParallel').checked;
    el('profileInspect').disabled=inspectTabId===null&&!tabIds.size;
    if(!redraw)return;
    const issueList=el('profileIssues');issueList.replaceChildren();
    for(const [id,u] of issues.slice(-100)){
      const row=document.createElement('p'),link=document.createElement('a'),reason=document.createElement('span');
      link.href=`https://x.com/${u.username}`;link.target='_blank';link.rel='noopener noreferrer';link.textContent='@'+u.username;
      const record=records[id];reason.textContent=` · ${record.lastAttemptError||record.error||'旧记录无法完整识别，可勾选重试'}${record.countText?' · 页面显示：'+record.countText:''}`;
      row.append(link,reason);issueList.append(row);
    }
    if(!issues.length)issueList.textContent='暂无待核实或失败记录。';
    const body=el('profileRows');body.replaceChildren();
    for(const u of matches.slice(0,100)){
      const row=document.createElement('tr'),account=document.createElement('td'),link=document.createElement('a');
      link.href=`https://x.com/${u.username}`;link.target='_blank';link.rel='noopener noreferrer';link.textContent='@'+u.username;account.append(link);
      for(const value of [u.followersCount,'蓝 V',new Date(u.checkedAt).toLocaleString()]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
      row.prepend(account);body.append(row);
    }
    el('profileEmpty').textContent=matches.length?'表格显示前 100 条；导出包含全部符合条件的账号。':'暂无符合条件的已核实账号；未读取或读取失败不代表不符合条件。';
  }
  async function readProfile(tabId,username,foreground){
    const started=now(),trace=[];let page=null,reloaded=false;
    await chrome.tabs.update(tabId,{url:`https://x.com/${username}`,...(foreground?{active:true}:{})});
    let previous=null,stable=0,lastReason='内容脚本尚未响应（页面可能未加载完成）',stage='waiting',polls=0;
    function step(next,reason){stage=next;lastReason=reason||lastReason;if(trace.at(-1)?.stage!==next)trace.push({ms:now()-started,stage:next,reason});if(trace.length>16)trace.shift();}
    const diagnostic=()=>({tabId,elapsedMs:now()-started,budgetMs:12000,polls,page,trace,reloaded});
    for(let i=0;i<48&&!paused;i++){
      if(now()-started>=12000)break;
      await sleep(Math.min(250,12000-(now()-started)));
      if(now()-started>=12000)break;
      polls++;
      try{
        const reply=await chrome.tabs.sendMessage(tabId,{type:'NLXM_PROFILE_QUERY',username});
        page=reply?.page||page;step(reply?.stage||(reply?.blocked?'blocked':'waiting'),reply?.reason);
        if(reply?.blocked)return {blocked:true,rateLimited:reply.rateLimited,error:reply.reason,stage:reply.stage||'blocked',diagnostic:{...diagnostic(),resource:reply.resource}};
        // Do not reload an unready page: one profile load triggers multiple X
        // startup requests, and a reload can worsen a shared rate limit.
        if(now()-started>=12000)break;
        const p=reply?.profile;
        if(p?.username?.toLowerCase()!==username.toLowerCase()){lastReason=reply?.reason||'页面未返回目标账号资料';previous=null;stable=0;continue;}
        // Wait for a stable observation so a not-yet-rendered badge is not accepted immediately.
        const signature=JSON.stringify([p.followersCount,p.countText,p.badge,p.status]);
        stable=signature===previous?stable+1:1;previous=signature;
        // An absent badge needs more settling time than a visible badge.
        if(stable>=(p.badge==='none'?6:2)){const profile=NLXMProfiles.normalize(p);return {profile,stage:profile.status==='ok'?'success':profile.status,diagnostic:diagnostic()};}
      }catch(error){previous=null;stable=0;step('message-error','内容脚本通信失败：'+error.message);}
    }
    // Record only the actual tab URL/status, never cookies, query strings or page HTML.
    try{const tab=await chrome.tabs.get(tabId);page={...page,path:new URL(tab.url).pathname,tabStatus:tab.status,discarded:tab.discarded};}catch{}
    if(stage==='app-shell')return {blocked:true,error:'X 持续停留在空白或启动 Logo；已暂停整批读取，目标账号不记为失败。请先恢复 X 页面并查看 Console 错误',stage:'app-startup-stalled',diagnostic:diagnostic()};
    return {error:`读取超时（预算 12 秒，实际 ${(diagnostic().elapsedMs/1000).toFixed(1)} 秒）：`+lastReason,stage,diagnostic:diagnostic()};
  }
  async function run(){
    if(running)return;
    cooldown=(await chrome.storage.local.get(COOLDOWN_KEY))[COOLDOWN_KEY]||cooldown;
    if(cooldown?.until>Date.now()){progress=`冷却至 ${new Date(cooldown.until).toLocaleString()}，暂不发送请求。${cooldown.reason}；这是插件退避时间，不代表 X 已解除限制`;renderProfiles();return;}
    if(!followers().length){progress='请先采集或导入粉丝名单';renderProfiles();return;}
    running=true;paused=false;
    const recheck=el('profileRecheck').checked;
    const retry=el('profileRetry').checked;
    const pending=followers().filter(([id])=>recheck||!records[id]||(retry&&!NLXMProfiles.resolved(records[id],limit())));
    // Unvisited users go first, so resuming cannot get stuck on earlier failures.
    pending.sort(([a],[b])=>Number(!!records[a])-Number(!!records[b]));
    let done=0,consecutiveFailures=0,cursor=0,stopReason='';
    const foreground=el('profileForeground').checked;
    const workerCount=Math.max(2,Math.min(4,Number(el('profileWorkers').value)||3));
    const parallel=!foreground&&el('profileParallel').checked?workerCount:1;
    let allowedWorkers=parallel;
    let navigationQueue=Promise.resolve(),lastNavigation=null,navigations=0;
    async function waitInterruptibly(ms){for(let remaining=ms;remaining>0&&!paused;remaining-=1000)await sleep(Math.min(1000,remaining));}
    function navigationSlot(){
      const slot=navigationQueue.then(async()=>{
        if(paused)return false;
        if(navigations&&navigations%40===0){addLog({level:'info',stage:'batch-rest',reason:'已读取 40 个主页，主动休息 60 秒（插件退避设置，并非 X 官方额度）'});await waitInterruptibly(60000);}
        if(lastNavigation!==null)await waitInterruptibly(Math.max(0,8000-(now()-lastNavigation)));
        if(paused)return false;lastNavigation=now();navigations++;return true;
      });navigationQueue=slot.catch(()=>{});return slot;
    }
    const current=new Map(),started=Date.now();
    function updateProgress(){
      const speed=done&&Date.now()>started?` · 本轮约 ${(done*60000/(Date.now()-started)).toFixed(1)} 个/分钟`:'';
      progress=`本轮 ${done}/${pending.length} · 并行上限 ${allowedWorkers} 页 · 当前 ${[...current.values()].map(name=>'@'+name).join('、')||'准备中'}${speed}`;renderProfiles();
    }
    async function worker(workerIndex){
      const tab=await chrome.tabs.create({url:'about:blank',active:foreground});
      const tabId=tab.id;tabIds.add(tabId);
      try{
        while(!paused&&cursor<pending.length){
          if(workerIndex>=allowedWorkers){current.delete(tabId);await sleep(1000);continue;}
          const [id,u]=pending[cursor++];
          if(!/^[A-Za-z0-9_]{1,15}$/.test(u.username||''))continue;
          if(!await navigationSlot())break;
          current.set(tabId,u.username);updateProgress();
          const visitStarted=Date.now();
          let outcome;
          try{outcome=await readProfile(tabId,u.username,foreground);}catch(error){outcome={error:'标签页访问失败：'+error.message,stage:'navigation-error',diagnostic:{tabId,elapsedMs:Date.now()-visitStarted}};}
          if(paused)break;
          if(outcome.blocked){paused=true;inspectTabId=tabId;
            const backoffMs=outcome.rateLimited?15*60000:outcome.stage==='app-startup-stalled'?60000:0;
            if(backoffMs){cooldown={until:Date.now()+backoffMs,reason:outcome.error,source:outcome.rateLimited?'http-rate-limit':'startup-stalled'};await chrome.storage.local.set({[COOLDOWN_KEY]:cooldown});}
            addLog({level:'blocked',username:u.username,stage:outcome.stage,reason:outcome.error,cooldownUntil:cooldown?.until,...outcome.diagnostic});
            stopReason=outcome.error+(backoffMs?`；插件冷却至 ${new Date(cooldown.until).toLocaleString()}，到时需手动继续（不保证 X 已解限）`:'；已暂停，点击“查看读取页面”检查后继续');break;}
          const profile=outcome.profile;
          // A failed refresh must not discard an earlier successful match.
          if(profile)records[id]=profile;
          else if(records[id]?.status==='ok')records[id]={...records[id],lastAttemptError:outcome.error,lastAttemptAt:Date.now()};
          else records[id]={username:u.username,status:'error',checkedAt:Date.now(),error:outcome.error};
          version++;
          // Persist one record, rather than cloning/writing the entire growing list.
          await chrome.storage.local.set({[NLXMProfiles.recordPrefix+id]:records[id]});
          if(!profile||!NLXMProfiles.resolved(profile,limit()))addLog({level:profile?'partial':'error',username:u.username,stage:outcome.stage,reason:outcome.error||profile.error,countText:profile?.countText,badge:profile?.badge,...outcome.diagnostic});
          else if(outcome.diagnostic?.reloaded)addLog({level:'info',username:u.username,stage:'recovered-after-reload',reason:'重载一次后读取成功',...outcome.diagnostic});
          done++;consecutiveFailures=profile?0:consecutiveFailures+1;
          if(consecutiveFailures>=2&&allowedWorkers>1){allowedWorkers=1;addLog({level:'info',stage:'concurrency-reduced',reason:'多个页面连续读取失败，自动降为单页，减少页面加载压力'});}
          if(consecutiveFailures>=5){paused=true;inspectTabId=tabId;stopReason='连续 5 次未读到主页资料，已暂停；点击“查看读取页面”，具体原因可展开失败名单查看';break;}
          updateProgress();
          // Navigation pacing is shared by all workers, not multiplied by tab count.
        }
      }finally{current.delete(tabId);if(tabId!==inspectTabId){await chrome.tabs.remove(tabId).catch(()=>{});tabIds.delete(tabId);}}
    }
    try{
      if(!pending.length){progress='所有账号均已尝试；可勾选“重试待核实/失败”补查，或“重新检查全部”更新';return;}
      progress='正在打开资料读取标签页';renderProfiles();
      addLog({level:'info',stage:'run-start',reason:`待处理 ${pending.length} 个，${parallel} 个标签页，${foreground?'前台':'后台'}读取`});
      if(inspectTabId!==null){await chrome.tabs.remove(inspectTabId).catch(()=>{});tabIds.delete(inspectTabId);inspectTabId=null;}
      const outcomes=await Promise.allSettled(Array.from({length:Math.min(parallel,pending.length)},async(_,index)=>{try{await worker(index);}catch(error){paused=true;throw error;}}));
      const failure=outcomes.find(result=>result.status==='rejected');
      if(failure)throw failure.reason;
      if(!paused)progress='本轮读取完成';
      else progress=stopReason||'已暂停，已读取的资料已保存';
    }catch(error){progress='读取已停止：'+error.message;addLog({level:'error',stage:'runner-error',reason:error.message});}
    finally{running=false;addLog({level:'info',stage:'run-end',reason:progress,completed:done,elapsedMs:Date.now()-started});await logWrites.catch(()=>{});renderProfiles();}
  }
  el('profileStart').addEventListener('click',async()=>{
    // Prevent two open management panels from starting duplicate scan loops.
    if(navigator.locks){await navigator.locks.request('nlxm-profile-reader',{ifAvailable:true},async lock=>{if(lock)await run();else{progress='另一个管理面板正在读取资料，请在那里暂停';renderProfiles();}});}
    else{progress='当前浏览器不支持任务锁，请使用新版 Chrome';renderProfiles();}
  });
  el('profileStop').addEventListener('click',()=>{paused=true;progress='正在暂停…';renderProfiles();});
  el('profileInspect').addEventListener('click',async()=>{const id=inspectTabId??[...tabIds][0];if(id!==undefined&&id!==null)try{await chrome.tabs.update(id,{active:true});}catch{progress='读取标签页已关闭，请重新继续任务';inspectTabId=null;tabIds.delete(id);renderProfiles();}});
  el('profileLimit').addEventListener('input',renderProfiles);
  el('profileForeground').addEventListener('change',renderProfiles);
  el('profileParallel').addEventListener('change',renderProfiles);
  el('profileLogExport').addEventListener('click',()=>download('nailong-profile-diagnostics.json',JSON.stringify({version:'0.4.6',exportedAt:new Date().toISOString(),logs},null,2),'application/json'));
  el('profileExport').addEventListener('click',()=>{
    const rows=[['用户名','粉丝数','认证类型','资料读取时间','主页链接'],...results().map(u=>[u.username,u.followersCount,'蓝V',new Date(u.checkedAt).toISOString(),`https://x.com/${u.username}`])];
    if(rows.length===1)return;
    download('nailong-blue-followers.csv','\uFEFF'+rows.map(row=>row.map(csvEscape).join(',')).join('\r\n'),'text/csv;charset=utf-8');
  });
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;let changed=false;if(!running){if(changes[LOG_KEY]){logs=Array.isArray(changes[LOG_KEY].newValue)?changes[LOG_KEY].newValue.slice(-300):[];renderLogs();}if(changes[PROFILE_KEY]){records=changes[PROFILE_KEY].newValue||{};changed=true;}for(const [key,change] of Object.entries(changes))if(key.startsWith(NLXMProfiles.recordPrefix)){const id=key.slice(NLXMProfiles.recordPrefix.length);if(change.newValue)records[id]=change.newValue;else delete records[id];changed=true;}}if(changed)version++;if(changed||changes.nlxm_v1)renderProfiles();});
  window.addEventListener('pagehide',()=>{paused=true;for(const id of tabIds)if(id!==inspectTabId)chrome.tabs.remove(id).catch(()=>{});});
  (async()=>{const values=await chrome.storage.local.get(null);records=NLXMProfiles.storedProfiles(values);logs=Array.isArray(values[LOG_KEY])?values[LOG_KEY].slice(-300):[];await init();loaded=true;renderLogs();renderProfiles();})().catch(error=>{el('profileProgress').textContent='读取数据失败：'+error.message;});
})();

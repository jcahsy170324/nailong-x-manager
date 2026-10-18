const KEY='nlxm_v1';
chrome.runtime.onInstalled.addListener(()=>chrome.storage.local.get(KEY, r=>{if(!r[KEY])chrome.storage.local.set({[KEY]:{following:{},followers:{},reviews:{},snapshots:[],lastScan:{}}});}));
let queue=Promise.resolve();
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(msg?.type!=='NLXM_BATCH')return;
  const work=async()=>{
    const data=(await chrome.storage.local.get(KEY))[KEY]||{following:{},followers:{},reviews:{},snapshots:[],lastScan:{}};
    const kind=msg.kind;
    if(!['following','followers'].includes(kind))throw Error('Invalid list');
    data[kind] ||= {};
    let added=0;
    for(const u of (msg.users||[])){
      if(!/^[A-Za-z0-9_]{1,15}$/.test(u.username||''))continue;
      const id=u.username.toLowerCase();
      if(!data[kind][id])added++;
      const prev=data[kind][id];data[kind][id]={username:u.username,displayName:String(u.displayName||prev?.displayName||'').slice(0,150),followsYou:u.followsYou===true||prev?.followsYou===true,observedAt:Date.now(),source:'dom'};
    }
    data.lastScan[kind]={at:Date.now(),url:sender.tab?.url||'',count:Object.keys(data[kind]).length};
    await chrome.storage.local.set({[KEY]:data});
    reply({ok:true,added,total:Object.keys(data[kind]).length});
  };
  queue=queue.then(work,work).catch(e=>reply({ok:false,error:e.message}));
  return true;
});

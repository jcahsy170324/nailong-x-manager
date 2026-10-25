const status=document.querySelector('#status');
async function current(){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});return tab;}
async function command(type){const tab=await current();if(!tab?.id||!/^https:\/\/(x|twitter)\.com\//.test(tab.url||'')){status.textContent='请先打开 x.com 的关注或粉丝列表';return;}try{status.textContent=type==='NLXM_STOP'?'正在保存并暂停…':'正在开始采集…';const r=await chrome.tabs.sendMessage(tab.id,{type});if(!r?.ok){status.textContent=r?.error||'操作失败';return;}await refresh();}catch{status.textContent='页面尚未加载扩展，请刷新 X 页面后重试';}}
async function refresh(){const tab=await current();try{const r=await chrome.tabs.sendMessage(tab.id,{type:'NLXM_STATUS_QUERY'});status.textContent=`${r.active?'● 采集中':'○ 已暂停'} · ${r.kind||'非列表页'} · 已保存 ${r.total} · 当前可见 ${r.visible}`;}catch{status.textContent='请打开 X 的关注、粉丝或认证粉丝列表；更新扩展后请刷新 X 页面';}}
document.querySelector('#start').addEventListener('click',()=>command('NLXM_START'));
document.querySelector('#stop').addEventListener('click',()=>command('NLXM_STOP'));
document.querySelector('#dashboard').addEventListener('click',()=>chrome.runtime.openOptionsPage());
refresh();
setInterval(refresh,2500);

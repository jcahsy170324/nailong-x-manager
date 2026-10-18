const status=document.querySelector('#status');
async function current(){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});return tab;}
async function command(type){const tab=await current();if(!tab?.id||!/^https:\/\/(x|twitter)\.com\//.test(tab.url||'')){status.textContent='请先打开 x.com 的关注或粉丝列表';return;}try{const r=await chrome.tabs.sendMessage(tab.id,{type});status.textContent=r?.ok?(type==='NLXM_START'?'采集中，请滚动页面':'已暂停'):'操作失败';}catch{status.textContent='页面尚未加载扩展，请刷新 X 页面后重试';}}
async function refresh(){const tab=await current();try{const r=await chrome.tabs.sendMessage(tab.id,{type:'NLXM_STATUS_QUERY'});status.textContent=`${r.active?'● 采集中':'○ 已暂停'} · ${r.kind||'非列表页'} · 已保存 ${r.total} · 当前可见 ${r.visible}`;}catch{status.textContent='请打开 X 的 /following 或 /followers 页面';}}
document.querySelector('#start').addEventListener('click',()=>command('NLXM_START'));
document.querySelector('#stop').addEventListener('click',()=>command('NLXM_STOP'));
document.querySelector('#dashboard').addEventListener('click',()=>chrome.runtime.openOptionsPage());
refresh();

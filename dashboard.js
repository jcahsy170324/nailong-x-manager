const KEY='nlxm_v1';
const $=s=>document.querySelector(s);
let db;
let viewMode="list", stepIndex=0, currentVisible=[];
const blank=()=>({following:{},followers:{},reviews:{},snapshots:[],lastScan:{}});
const valid=s=>/^[A-Za-z0-9_]{1,15}$/.test(s);
async function save(){await chrome.storage.local.set({[KEY]:db});}
async function replaceProfileState(profiles,logs=[]){const values=await chrome.storage.local.get(null),keys=Object.keys(values).filter(key=>key.startsWith(NLXMProfiles.recordPrefix));if(keys.length)await chrome.storage.local.remove(keys);await chrome.storage.local.set({[KEY]:db,nlxm_profiles_v1:profiles,nlxm_profile_logs_v1:logs});}
function download(name,contents,mime){const url=URL.createObjectURL(new Blob([contents],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function csvEscape(s){s=String(s??'');return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function parseCSV(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;}
function getEntries(scope='following'){
 const ids=scope==='all'?new Set([...Object.keys(db.following||{}),...Object.keys(db.followers||{})]):Object.keys(db[scope]||{});
 return [...ids].map(id=>{const following=db.following?.[id],follower=db.followers?.[id];return {id,...(following||follower),isFollowing:!!following,isFollower:!!follower,mutual:!!following&&!!follower,review:db.reviews?.[id]||''};});
}
function tag(u){return u.mutual?'已确认互关（名单交集）':u.isFollowing===false?'已采集粉丝（关注关系待核实）':u.followsYou?'页面标记互关':u.source==='csv-import'?'导入数据待核实':'疑似未回关（需核实）';}
function makeButton(label,fn,klass='secondary'){const b=document.createElement('button');b.textContent=label;b.className=klass;b.addEventListener('click',fn);return b;}
function filteredEntries(){const q=$("#search").value.trim().toLowerCase(),f=$("#filter").value;return getEntries($('#listKind').value||'all').filter(u=>(u.username+" "+(u.displayName||"")).toLowerCase().includes(q)).filter(u=>f==="all"||(f==="suspected"&&u.isFollowing&&!u.followsYou&&u.source!=="csv-import"&&!u.mutual)||(f==="unknown"&&u.source==="csv-import"&&!u.mutual)||(f==="unmatched"&&u.isFollowing&&!u.mutual)||(f==="mutual"&&u.mutual)||(f==="badge"&&u.isFollowing&&u.followsYou)||(f==="review"&&!u.review)||(f==="done"&&!!u.review));}
function renderStepper(){const total=currentVisible.length;stepIndex=Math.max(0,Math.min(stepIndex,Math.max(0,total-1)));const u=currentVisible[stepIndex];$("#stepperProgress").textContent=total?`第 ${stepIndex+1} / ${total} 位`:`当前筛选没有账号`;$("#stepperDone").textContent=`已处理 ${currentVisible.filter(x=>!!x.review).length} / ${total}`;$("#stepperBar").style.width=total?`${100*currentVisible.filter(x=>!!x.review).length/total}%`:"0%";$("#stepperName").textContent=u?"@"+u.username:"暂无账号";$("#stepperDisplay").textContent=u?.displayName||"";$("#stepperRelation").textContent=u?`关系判断：${tag(u)}`:"";$("#stepperStatus").textContent=u?.review||"未处理";$("#stepperOpen").hidden=!u;if(u)$("#stepperOpen").href=`https://x.com/${u.username}`;$("#stepperPrev").disabled=!u||stepIndex===0;$("#stepperNext").disabled=!u||stepIndex>=total-1;for(const id of ["stepperUnfollow","stepperKeep","stepperSkip","stepperReset"])$("#"+id).disabled=!u;}
function setView(mode){viewMode=mode;$("#listView").hidden=mode!=="list";$("#stepperView").hidden=mode!=="stepper";$("#limit").hidden=mode==="stepper";$("#viewList").setAttribute("aria-pressed",String(mode==="list"));$("#viewStepper").setAttribute("aria-pressed",String(mode==="stepper"));$("#viewList").classList.toggle("active",mode==="list");$("#viewStepper").classList.toggle("active",mode==="stepper");renderStepper();}
function render(){db.following ||= {};db.followers ||= {};db.reviews ||= {};db.snapshots ||= [];db.lastScan ||= {};
 const all=getEntries(),mutual=all.filter(x=>x.mutual).length, badge=all.filter(x=>x.followsYou).length, suspected=all.filter(x=>!x.followsYou&&x.source!=='csv-import'&&!x.mutual).length, unknown=all.filter(x=>x.source==='csv-import'&&!x.mutual).length;
 $('#nFollowing').textContent=all.length;$('#nFollowers').textContent=Object.keys(db.followers).length;$('#nMutual').textContent=mutual;$('#nMissing').textContent=suspected;$('#quickSummary').textContent=`快速模式：页面标记互关 ${badge} · 疑似未回关 ${suspected} · CSV 导入待核实 ${unknown}。统计只覆盖已采集账号。`;
 if(!all.length&&Object.keys(db.followers).length)$('#quickSummary').textContent=`已保存 ${Object.keys(db.followers).length} 个粉丝，可在下方查看。要分析谁没回关，请再采集你的 Following（关注）列表。`;
 $('#lastScan').textContent=['following','followers'].map(k=>`${k}: ${db.lastScan[k]?.at?new Date(db.lastScan[k].at).toLocaleString():'尚未采集'}`).join('   |   ');
 $('#snapshots').textContent=db.snapshots.length?db.snapshots.slice(-5).map(s=>`${new Date(s.at).toLocaleString()} (${s.following}/${s.followers})`).join('；'):'尚无';
 const lim=Number($('#limit').value);const visible=filteredEntries();currentVisible=visible;
 $('#count').textContent=`符合条件 ${visible.length} 条，${viewMode==='list'?`显示前 ${Math.min(lim,visible.length)} 条`:'逐个核实模式'}`;
 renderStepper();
 const tbody=$('#rows');tbody.replaceChildren();const frag=document.createDocumentFragment();
 for(const u of visible.slice(0,lim)){
  const tr=document.createElement('tr');const name=document.createElement('td');const link=document.createElement('a');link.href=`https://x.com/${u.username}`;link.target='_blank';link.rel='noopener noreferrer';link.textContent='@'+u.username;name.append(link);if(u.displayName){const small=document.createElement('div');small.className='muted';small.textContent=u.displayName;name.append(small);}
  const relation=document.createElement('td');relation.textContent=tag(u);
  const review=document.createElement('td');review.textContent=u.review||'未处理';
  const actions=document.createElement('td');actions.className='review';
  const mark=async label=>{db.reviews[u.id]=label;await save();render();};
  actions.append(makeButton('已手动取关',()=>mark('已手动取关')),makeButton('保留',()=>mark('保留')),makeButton('跳过',()=>mark('跳过')),makeButton('重置',()=>mark(''),'danger'));
  tr.append(name,relation,review,actions);frag.append(tr);
 }
 tbody.append(frag);
}
async function init(){db=(await chrome.storage.local.get(KEY))[KEY]||blank();render();}
['search','filter','limit','listKind'].forEach(id=>$('#'+id).addEventListener(id==='search'?'input':'change',()=>{if(id!=='limit')stepIndex=0;if(id==='listKind')$('#filter').value='all';render();}));
$('#viewList').addEventListener('click',()=>{setView('list');render();});
$('#viewStepper').addEventListener('click',()=>{setView('stepper');render();});
$('#stepperPrev').addEventListener('click',()=>{stepIndex=Math.max(0,stepIndex-1);renderStepper();});
$('#stepperNext').addEventListener('click',()=>{stepIndex=Math.min(currentVisible.length-1,stepIndex+1);renderStepper();});
async function stepMark(label){const u=currentVisible[stepIndex];if(!u)return;db.reviews[u.id]=label;await save();if($('#stepperAutoNext').checked&&stepIndex<currentVisible.length-1)stepIndex++;render();}
$('#stepperUnfollow').addEventListener('click',()=>stepMark('已手动取关'));
$('#stepperKeep').addEventListener('click',()=>stepMark('保留'));
$('#stepperSkip').addEventListener('click',()=>stepMark('跳过'));
$('#stepperReset').addEventListener('click',()=>stepMark(''));

$('#export').addEventListener('click',async()=>{
 await init();
 const following=getEntries();
 const followers=Object.entries(db.followers||{}).filter(([id])=>!db.following[id]).map(([id,u])=>({id,...u}));
 if(!following.length&&!followers.length){$('#feedback').textContent='暂无已保存数据。请先在 X 列表页开始采集，确认“已保存”大于 0 后再导出。';return;}
 const rows=[['用户名','关系判断','人工处理状态','主页链接','采集来源','名单类型'],
 ...following.map(u=>[u.username,tag(u),u.review,`https://x.com/${u.username}`,u.source||'',u.mutual?'关注和粉丝':'关注']),
 ...followers.map(u=>[u.username,'已采集粉丝（关注关系待核实）',db.reviews[u.id]||'',`https://x.com/${u.username}`,u.source||'','粉丝'])];
 download('nailong-x-manager.csv','\uFEFF'+rows.map(r=>r.map(csvEscape).join(',')).join('\r\n'),'text/csv;charset=utf-8');
});
$('#backup').addEventListener('click',async()=>{const values=await chrome.storage.local.get(null),profiles=NLXMProfiles.storedProfiles(values);download('nailong-x-manager-backup.json',JSON.stringify({...db,profiles,profileLogs:values.nlxm_profile_logs_v1||[]},null,2),'application/json');});
$('#restore').addEventListener('click',()=>$('#restoreFile').click());
$('#restoreFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const obj=JSON.parse(await file.text());if(!obj||typeof obj.following!=='object'||typeof obj.followers!=='object'||Array.isArray(obj.following))throw Error('格式错误');if(!confirm('将用备份覆盖当前数据，是否继续？'))return;const {profiles={},profileLogs=[],...lists}=obj;db={...blank(),...lists};await replaceProfileState(profiles,profileLogs);render();}catch(err){alert('恢复失败：'+err.message);}e.target.value='';});
$('#import').addEventListener('click',async()=>{const file=$('#csvFile').files[0];if(!file){alert('请选择 CSV');return;}const rows=parseCSV((await file.text()).replace(/^\uFEFF/,''));const headers=rows[0]||[],listColumn=headers.indexOf('名单类型'),urlColumn=headers.indexOf('主页链接');let added=0;for(const row of rows.slice(1)){let name=(row[0]||'').trim().replace(/^@/,'');if(!valid(name)){const m=(row[urlColumn<0?2:urlColumn]||'').match(/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})/);name=m?.[1]||'';}if(!valid(name))continue;const id=name.toLowerCase(),list=listColumn<0?'关注':row[listColumn];const kinds=list==='粉丝'?['followers']:list==='关注和粉丝'?['following','followers']:['following'];for(const kind of kinds){if(!db[kind][id])added++;db[kind][id] ||= {username:name,displayName:'',followsYou:false,observedAt:Date.now(),source:'csv-import'};}}await save();$('#feedback').textContent=`导入完成，新增 ${added} 条名单记录；未确认互关关系`;render();});
$('#snap').addEventListener('click',async()=>{db.snapshots.push({at:Date.now(),following:Object.keys(db.following).length,followers:Object.keys(db.followers).length,followingIds:Object.keys(db.following),followerIds:Object.keys(db.followers)});await save();render();});
$('#clear').addEventListener('click',async()=>{if(!confirm('确定清空全部采集、核实、粉丝资料、诊断日志和快照数据？此操作不可撤销。'))return;db=blank();await replaceProfileState({});render();});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[KEY]){db=changes[KEY].newValue||blank();render();}});
init();

// Shared, dependency-free rules for public profile observations.
globalThis.NLXMProfiles=(()=>{
  function exactCount(value){
    const text=String(value||'').trim();
    // Abbreviated counts are rounded; never use them for a <= threshold decision.
    const match=text.match(/^([0-9][0-9,，\s\u00a0\u202f]*)(?:\s*(?:Followers?|粉丝|粉絲|位粉丝|位粉絲|关注者|關注者|フォロワー))?$/i);
    if(!match)return null;
    const n=Number(match[1].replace(/[,，\s\u00a0\u202f]/g,''));
    return Number.isSafeInteger(n)&&n>=0?n:null;
  }
  function badgeType(svg,color){
    if(!svg)return 'none';
    const label=String(svg.getAttribute('aria-label')||'').toLowerCase();
    if(/gold|business|金色|金标|金標/.test(label))return 'gold';
    if(/gray|grey|government|灰色|灰标|灰標/.test(label))return 'gray';
    const rgb=String(color||'').match(/rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/i);
    if(rgb){const [,r,g,b]=rgb.map(Number);if(b>150&&b>r+60&&b>g+20)return 'blue';if(r>150&&g>110&&b<140)return 'gold';if(Math.max(r,g,b)-Math.min(r,g,b)<35)return 'gray';}
    return 'unknown';
  }
  function read(document,pathname,username,style){
    if(!/^[A-Za-z0-9_]{1,15}$/.test(username||'')||pathname.replace(/\/$/,'').toLowerCase()!=='/'+username.toLowerCase())return null;
    const primary=document.querySelector('[data-testid="primaryColumn"]');
    const name=primary?.querySelector('[data-testid="UserName"], [data-testid="User-Name"]');
    if(!name||!new RegExp('@'+username+'(?:\\b|$)','i').test(name.innerText||''))return null;
    const link=[...primary.querySelectorAll('a[href]')].find(a=>{
      try{const route=new URL(a.href).pathname.replace(/\/$/,'').toLowerCase();return ['/followers','/verified_followers'].some(suffix=>route==='/'+username.toLowerCase()+suffix);}catch{return false;}
    });
    if(!link)return null;
    const candidates=[link.getAttribute('title'),link.getAttribute('aria-label'),...[...link.querySelectorAll('span')].flatMap(s=>[s.getAttribute('title'),s.getAttribute('aria-label'),s.innerText||s.textContent]),link.innerText||link.textContent];
    const followersCount=candidates.map(exactCount).find(n=>n!==null)??null;
    const svg=name.querySelector('[data-testid="icon-verified"]');
    const badge=badgeType(svg,svg?style(svg).color:'');
    // The profile has loaded even when X only exposes a rounded count.
    // Preserve that observation without treating it as a network/load failure.
    const countText=String(link.innerText||'').trim().slice(0,100);
    return {username,followersCount,countText,badge,checkedAt:Date.now(),status:followersCount===null||badge==='unknown'?'partial':'ok',error:followersCount===null?'页面粉丝数为缩写或无法精确识别':badge==='unknown'?'无法确认认证颜色':'',source:'public-profile-dom'};
  }
  function matches(record,limit=800){return record?.status==='ok'&&record.badge==='blue'&&Number.isSafeInteger(record.followersCount)&&record.followersCount>=0&&record.followersCount<=limit;}
  function countBounds(value){
    const m=String(value||'').trim().match(/^(\d+(?:\.\d+)?)\s*(K|M|B|万|萬|亿|億)(?:\s*(?:Followers?|粉丝|粉絲|关注者|關注者))?$/i);
    if(!m)return null;
    const scale={K:1000,M:1000000,B:1000000000,'万':10000,'萬':10000,'亿':100000000,'億':100000000}[m[2].toUpperCase()];
    const precision=10**(-(m[1].split('.')[1]?.length||0));
    // Union of conventional rounding and truncation ranges; never use the
    // approximate display as an exact follower count.
    return {lower:Math.max(0,Math.floor((Number(m[1])-precision/2)*scale)),upper:Math.ceil((Number(m[1])+precision)*scale)};
  }
  function normalize(record){if(record?.followersCount===null&&['partial','bounded'].includes(record.status)){const bounds=countBounds(record.countText);if(bounds)return {...record,status:'bounded',countBounds:bounds};}return record;}
  function resolved(record,limit=800){return record?.status==='ok'||(record?.status==='bounded'&&record.countBounds?.lower>limit);}
  function rateLimitSignal(entries){
    for(const entry of [...entries].slice(-150).reverse()){
      if(entry.responseStatus!==429)continue;
      try{const url=new URL(entry.name);if(url.protocol!=='https:'||!['x.com','api.x.com','twitter.com','api.twitter.com'].includes(url.hostname))continue;
        return {blocked:true,rateLimited:true,stage:'http-429',reason:'X 页面资源返回 HTTP 429（请求过多），停止继续访问',resource:{host:url.hostname,path:url.pathname,status:429}};
      }catch{}
    }
    return null;
  }
  function inspect(document,pathname,username,style){
    if(/^\/(i\/flow\/(login|challenge)|account\/access|login)(\/|$)/i.test(pathname))return {blocked:true,reason:'X 跳转到了登录或账号验证页面，请在读取标签页完成后继续'};
    if(pathname.replace(/\/$/,'').toLowerCase()!=='/'+String(username).toLowerCase())return {stage:'route-mismatch',reason:'页面还未切换到目标账号'};
    const profile=read(document,pathname,username,style);
    if(profile)return {profile:normalize(profile),stage:'ready'};
    const primary=document.querySelector('[data-testid="primaryColumn"]');
    const text=String((primary||document.querySelector('main')||document.body)?.innerText||'').trim().slice(0,1500);
    // Only inspect error text after failing to identify the requested profile.
    if(/rate limit exceeded|you are rate limited|too many requests|exceeded.*rate limit|超出.{0,8}(速率|频率|頻率)限制|请求过于频繁|請求過於頻繁/i.test(text))return {blocked:true,rateLimited:true,stage:'rate-limited',reason:'X 页面显示请求频率限制，请稍后再继续'};
    if(!primary&&/verify (you are|you're) human|checking your browser|verify your identity|验证您是人类|验证你的身份|安全验证/i.test(text))return {blocked:true,reason:'X 页面显示浏览器或身份验证，需要人工检查'};
    if(!primary&&/something went wrong|try (reloading|again)|出了点问题|出了一些问题|重新加载|发生错误/i.test(text))return {stage:'page-error',reason:'X 页面显示加载错误或重试提示'};
    if(/account suspended|this account doesn.t exist|账号已被冻结|此账号不存在|此帳戶不存在|账号已停用/i.test(text))return {profile:{username,followersCount:null,badge:'unknown',status:'unavailable',checkedAt:Date.now(),error:'页面显示账号不存在、停用或被冻结',source:'public-profile-dom'},stage:'unavailable'};
    if(!primary&&document.readyState==='complete'&&document.querySelector('#react-root')&&/^(?:X)?$/.test(text))return {stage:'app-shell',reason:'X 文档已加载完成，但应用仍只有空白或启动 Logo，未出现账号内容'};
    if(!primary)return {stage:'primary-missing',reason:'未加载 X 主内容区'};
    const name=primary.querySelector('[data-testid="UserName"], [data-testid="User-Name"]');
    if(!name)return {stage:'name-missing',reason:'已加载页面，但未找到账号名称区'};
    if(!new RegExp('@'+String(username).replace(/[^A-Za-z0-9_]/g,'')+'(?:\\b|$)','i').test(name.innerText||''))return {stage:'identity-mismatch',reason:'页面显示的账号与目标账号不一致，可能仍在切换'};
    return {stage:'count-link-missing',reason:'已找到目标账号，但未找到粉丝数链接（可能页面尚未加载或结构改变）'};
  }
  const recordPrefix='nlxm_profile_v2_';
  function storedProfiles(values){const records={...(values.nlxm_profiles_v1||{})};for(const [key,value] of Object.entries(values))if(key.startsWith(recordPrefix)&&value&&typeof value==='object')records[key.slice(recordPrefix.length)]=value;for(const id of Object.keys(records))records[id]=normalize(records[id]);return records;}
  return {exactCount,badgeType,read,matches,inspect,storedProfiles,recordPrefix,countBounds,normalize,resolved,rateLimitSignal};
})();

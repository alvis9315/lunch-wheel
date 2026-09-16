(function(root){
  'use strict';
  const categories=['正餐','早餐店','便當／快餐','小吃','麵食','拉麵','牛排','火鍋','咖哩','義大利麵','咖啡廳','甜點','冰品','台式','日式','韓式','西式','輕食','其他'];
  function normalizeCategory(value){const text=typeof value==='string'?value.trim():'';return ({'冰店':'冰品','咖啡店':'咖啡廳','小吃店':'小吃','便當店':'便當／快餐','快餐店':'便當／快餐'})[text]||text;}
  const typeName=value=>!value||value==='unknown'||value==='其他'?'尚未分類':value;
  function typeOptions(records){
    const counts=new Map();records.forEach(r=>{const type=typeName(r.category);counts.set(type,(counts.get(type)||0)+1);});
    return [{value:'all',label:'不限',count:records.length},...categories.filter(c=>c!=='其他').map(c=>({value:c,label:c,count:counts.get(c)||0})).filter(c=>c.count),...(counts.has('尚未分類')?[{value:'unclassified',label:'尚未分類',count:counts.get('尚未分類')}]:[])];
  }
  const matchesType=(record,value)=>value==='all'||(value==='unclassified'?typeName(record.category)==='尚未分類':record.category===value);
  const diets={unknown:'葷素未確認',meat:'葷食',vegetarian:'素食',both:'葷素皆有'};
  const issueLabels={row:'店家內容待確認',id:'店家編號待確認',duplicateId:'店家編號重複，請管理者更正',name:'店名待補',location:'位置待確認',address:'地址未提供',phone:'電話未提供或格式待確認',category:'料理類型待確認',diet:'葷素待確認',budget:'預算待確認',covered:'避雨情況待確認',coveredOrigin:'避雨路線出發點待確認',hours:'營業時間待確認',mapsUrl:'Google Maps 連結待確認'};
  const blank=v=>v==null||(typeof v==='string'&&!v.trim());
  const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const number=v=>typeof v==='number'?v:typeof v==='string'&&/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(v.trim())?Number(v):NaN;
  const point=v=>plain(v)&&!blank(v.lat)&&!blank(v.lng)&&Number.isFinite(number(v.lat))&&Number.isFinite(number(v.lng))&&Math.abs(number(v.lat))<=90&&Math.abs(number(v.lng))<=180?{lat:number(v.lat),lng:number(v.lng)}:null;
  const unknownHours=()=>Array.from({length:7},()=>({status:'unknown',spans:[]}));
  const mapsPattern=/^https:\/\/(?:maps\.app\.goo\.gl\/|goo\.gl\/maps(?:\/|\?)|(?:www\.)?google\.(?:com|com\.tw)\/maps(?:\/|\?)|maps\.google\.(?:com|com\.tw)\/(?:maps)?)/i;
  const text=(v,max,label,required=false)=>{
    if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error(label+'格式不正確');
    return v.trim();
  };
  function validate(input){
    if(!plain(input))throw Error('新增資料格式不正確');
    input={...input,category:blank(input.category)?'unknown':normalizeCategory(input.category),diet:blank(input.diet)?'unknown':input.diet,covered:blank(input.covered)?'unknown':input.covered,budget:blank(input.budget)?null:input.budget,weeklyHours:blank(input.weeklyHours)?unknownHours():input.weeklyHours,coveredOrigin:blank(input.coveredOrigin)?null:input.coveredOrigin};
    const name=text(input.name,100,'店名',true),address=text(blank(input.address)?'':input.address,250,'地址');
    const location=input.location;
    if(!location||typeof location.lat!=='number'||typeof location.lng!=='number'||!Number.isFinite(location.lat)||!Number.isFinite(location.lng)||Math.abs(location.lat)>90||Math.abs(location.lng)>180)throw Error('請填寫有效經緯度或點選地圖位置');
    const phone=text(blank(input.phone)?'':input.phone,40,'電話');
    if(phone&&!/^\+?[\d\s()#-]*\d[\d\s()#-]*$/.test(phone))throw Error('電話請填數字，可包含空白、括號、開頭的 +、-、#');
    if(![...categories,'unknown'].includes(input.category))throw Error('料理分類不正確');
    const diet=input.diet;if(typeof diet!=='string'||!Object.prototype.hasOwnProperty.call(diets,diet))throw Error('葷素標記不正確');
    if(!['yes','no','unknown'].includes(input.covered))throw Error('遮雨標記不正確');
    const coveredOrigin=input.coveredOrigin??null;
    if(coveredOrigin!==null&&(!coveredOrigin||!Number.isFinite(coveredOrigin.lat)||!Number.isFinite(coveredOrigin.lng)||Math.abs(coveredOrigin.lat)>90||Math.abs(coveredOrigin.lng)>180))throw Error('避雨路線出發點不正確');
    if(input.budget!==null&&(!Number.isInteger(input.budget)||input.budget<1||input.budget>10000))throw Error('預算請填 1～10000 整數或留空');
    const mapsUrl=text(blank(input.mapsUrl)?'':input.mapsUrl,1000,'Google Maps 連結');
    if(mapsUrl&&!mapsPattern.test(mapsUrl))throw Error('請貼上有效的 HTTPS Google Maps 分享連結');
    if(!Array.isArray(input.weeklyHours)||input.weeklyHours.length!==7)throw Error('每週營業資料需包含 7 天');
    const weeklyHours=input.weeklyHours.map(day=>{
      if(!day||!['unknown','closed','open'].includes(day.status))throw Error('營業日狀態不正確');
      if(day.status!=='open')return {status:day.status,spans:[]};
      if(!Array.isArray(day.spans)||day.spans.length<1||day.spans.length>2)throw Error('營業日需填 1～2 段時段');
      const spans=day.spans.map(span=>{
        if(!span||!/^([01]\d|2[0-3]):[0-5]\d$/.test(span.from)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(span.to)||span.from===span.to)throw Error('請填有效起訖時間；跨日請填隔日關門時間');
        return {from:span.from,to:span.to};
      });
      return {status:'open',spans};
    });
    return {name,address,location:{lat:location.lat,lng:location.lng},phone,category:input.category,diet,budget:input.budget,covered:input.covered,coveredOrigin:coveredOrigin?{lat:coveredOrigin.lat,lng:coveredOrigin.lng}:null,mapsUrl,weeklyHours};
  }
  function fingerprint(record){const p=point(record.location);return String(record.name||'').replace(/\s+/g,'').toLocaleLowerCase()+'|'+(p?p.lat.toFixed(4)+'|'+p.lng.toFixed(4):'unknown');}
  function read(record){
    const issues=new Set();if(!plain(record)){issues.add('row');record={};}
    if(Array.isArray(record.dataIssues))record.dataIssues.filter(k=>typeof k==='string'&&Object.prototype.hasOwnProperty.call(issueLabels,k)).forEach(k=>issues.add(k));
    function readText(value,max,key){if(typeof value==='string'&&value.trim()&&value.length<=max)return value.trim();issues.add(key);return '';}
    function decode(value){if(typeof value!=='string')return value;try{return JSON.parse(value);}catch{return null;}}
    const name=readText(record.name,100,'name')||'店名待補',address=readText(record.address,250,'address');
    const location=point(record.location);if(!location)issues.add('location');
    let phone=readText(record.phone,40,'phone');if(phone&&!/^\+?[\d\s()#-]*\d[\d\s()#-]*$/.test(phone)){issues.add('phone');phone='';}
    let mapsUrl=blank(record.mapsUrl)?'':readText(record.mapsUrl,1000,'mapsUrl');if(mapsUrl&&!mapsPattern.test(mapsUrl)){issues.add('mapsUrl');mapsUrl='';}
    const normalizedCategory=normalizeCategory(record.category),category=categories.includes(normalizedCategory)?normalizedCategory:'unknown';if(category==='unknown')issues.add('category');
    const diet=typeof record.diet==='string'&&Object.prototype.hasOwnProperty.call(diets,record.diet)?record.diet:'unknown';if(diet==='unknown')issues.add('diet');
    const covered=['yes','no'].includes(record.covered)?record.covered:'unknown';if(covered==='unknown')issues.add('covered');
    const coveredOrigin=point(decode(record.coveredOrigin));if(covered!=='unknown'&&!coveredOrigin)issues.add('coveredOrigin');
    const amount=blank(record.budget)?NaN:number(record.budget),budget=Number.isInteger(amount)&&amount>=1&&amount<=10000?amount:null;if(budget===null)issues.add('budget');
    const rawHours=decode(record.weeklyHours),weeklyHours=unknownHours();
    if(Array.isArray(rawHours)&&rawHours.length===7){rawHours.forEach((day,i)=>{
      if(day?.status==='closed')weeklyHours[i]={status:'closed',spans:[]};
      else if(day?.status==='open'&&Array.isArray(day.spans)&&day.spans.length>=1&&day.spans.length<=2&&day.spans.every(s=>s&&typeof s.from==='string'&&typeof s.to==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s.from)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s.to)&&s.from!==s.to))weeklyHours[i]={status:'open',spans:day.spans.map(s=>({from:s.from,to:s.to}))};
      else issues.add('hours');
    });}else issues.add('hours');
    const id=typeof record.id==='string'?record.id.trim():'';
    return {id,name,address,location,phone,category,diet,budget,covered,coveredOrigin,mapsUrl,weeklyHours,addedAt:typeof record.addedAt==='string'?record.addedAt:'',dataIssues:[...issues],unavailable:record.unavailable===true||issues.has('row')||issues.has('name')||issues.has('location')};
  }
  function collection(records){
    if(!Array.isArray(records))throw Error('名單沒有完整載入，請再試一次。');
    const normalized=records.map(read),counts=new Map();normalized.forEach(r=>counts.set(r.id,(counts.get(r.id)||0)+1));
    return normalized.map((r,i)=>{
      if(!/^(?:local-)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(r.id)||counts.get(r.id)>1){
        r.dataIssues.push(counts.get(r.id)>1&&r.id?'duplicateId':'id');r.id='unavailable-row-'+i;r.unavailable=true;
      }
      return r;
    });
  }
  function hydrate(record){
    const checked=read(record),days=['日','一','二','三','四','五','六'];
    const periods=checked.weeklyHours.flatMap((day,d)=>day.status==='open'?day.spans.map(span=>{
      const [h,m]=span.from.split(':').map(Number),[ch,cm]=span.to.split(':').map(Number);
      return {open:{day:d,hour:h,minute:m},close:{day:span.to<span.from?(d+1)%7:d,hour:ch,minute:cm}};
    }):[]);
    return {...checked,loaded:!checked.unavailable,manualHours:true,periods,hoursText:checked.weeklyHours.map((day,i)=>'週'+days[i]+'：'+(day.status==='unknown'?'未填寫':day.status==='closed'?'休息':day.spans.map(s=>s.from+'–'+s.to+(s.to<s.from?'（翌日）':'')).join('、')))};
  }
  const api={validate,fingerprint,hydrate,read,collection,blank,number,point,issueLabels,categories,diets,typeName,typeOptions,matchesType,normalizeCategory};root.LunchCatalog=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

(function(root){
  'use strict';
  // Original lunch-specific copy; 0 and 100 preserve the owner's wording.
  const bands=[
    {min:-100,max:-51,label:'廚餘桶都申請退貨',tone:'disaster'},
    {min:-50,max:-1,label:'我付錢，味蕾坐牢',tone:'disaster'},
    {min:0,max:19,label:'狗幹難吃',tone:'bad'},
    {min:20,max:39,label:'能吃是它唯一的才華',tone:'bad'},
    {min:40,max:59,label:'吃的是飯，吞的是委屈',tone:'neutral'},
    {min:60,max:79,label:'有料，這次先不嘴你',tone:'neutral'},
    {min:80,max:99,label:'好吃到想幫老闆洗碗',tone:'good'},
    {min:100,max:124,label:'頂上人間',tone:'good'},
    {min:125,max:149,label:'這口下去，直接原諒世界',tone:'great'},
    {min:150,max:174,label:'廚房是不是藏了小當家',tone:'great'},
    {min:175,max:199,label:'我吃一點，整盤都是我的',tone:'legend'},
    {min:200,max:200,label:'好吃到想把戶籍遷過來',tone:'legend'}
  ];
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function id(value,label='內容'){if(typeof value!=='string'||!uuid.test(value))throw Error('無法確認'+label+'，請重新開啟店家後再試。');return value.toLowerCase();}
  function visitor(value){if(typeof value!=='string'||value.length!==72||!uuid.test(value.slice(0,36))||!uuid.test(value.slice(36)))throw Error('登入資訊無效，請重新整理後再試。');return value.toLowerCase();}
  function score(value){if(typeof value!=='number'||!Number.isInteger(value)||value< -100||value>200)throw Error('分數請填 -100～200 的整數。');return value;}
  function band(value){return typeof value==='number'&&Number.isFinite(value)?bands.find(b=>value>=b.min&&value<=b.max)||null:null;}
  function text(value,max,label){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(label+'需填 1～'+max+' 字。');return value.trim();}
  function validate(input){
    if(!input||typeof input!=='object')throw Error('評論格式不正確。');
    return {restaurantId:id(input.restaurantId,'這間店'),requestId:id(input.requestId,'這次送出的評論'),item:text(input.item,100,'品項'),feedback:text(input.feedback,1500,'回饋'),score:score(input.score)};
  }
  function vote(value){if(![0,1,-1].includes(value))throw Error('投票只能是讚、踩或取消。');return value;}
  const api={bands,band,score,validate,vote,id,visitor};root.LunchReviews=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

// Google authorization code flow. Google credentials remain in Script Properties.
// Bind every handshake and member session to Google's temporary active-user key.
const MEMBER_HEADERS_=['google_id','email','google_name','nickname','updated_at'];
function googleConfig_(){
  const p=PropertiesService.getScriptProperties(),clientId=p.getProperty('GOOGLE_CLIENT_ID')||'',secret=p.getProperty('GOOGLE_CLIENT_SECRET')||'',redirect=p.getProperty('GOOGLE_REDIRECT_URI')||'';
  const configured=/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId)&&secret.length>=10&&/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(redirect);
  return {clientId,secret,redirect,configured,stamp:hash_(clientId+'|'+secret+'|'+redirect)};
}
function memberBinding_(){
  const key=Session.getTemporaryActiveUserKey();
  if(!key)throw Error('請先登入 Google 帳戶，再重新開啟午餐俱樂部。');
  return hash_(key);
}
function randomMemberToken_(){return Utilities.getUuid()+Utilities.getUuid();}
function beginGoogleSignIn(){
  const config=googleConfig_();if(!config.configured)throw Error('Google 登入尚未準備好，請聯絡名單管理者。');
  const binding=memberBinding_(),cache=CacheService.getScriptCache(),state=randomMemberToken_(),pollToken=randomMemberToken_(),verifier=randomMemberToken_();
  const challenge=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,verifier,Utilities.Charset.UTF_8)).replace(/=+$/,'');
  const expiresAt=Date.now()+10*60*1000;
  cache.put('google-flow:'+hash_(state),JSON.stringify({binding,pollHash:hash_(pollToken),verifier,expiresAt,status:'pending',stamp:config.stamp}),600);
  const params={client_id:config.clientId,redirect_uri:config.redirect,response_type:'code',scope:'openid email profile',state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account',access_type:'online'};
  return {url:'https://accounts.google.com/o/oauth2/v2/auth?'+Object.keys(params).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(params[k])).join('&'),state,pollToken,expiresAt};
}
function googleFlow_(state){
  if(typeof state!=='string'||state.length!==72)throw Error('這次登入已失效，請回原頁重新登入。');
  const raw=CacheService.getScriptCache().get('google-flow:'+hash_(state)),flow=raw?JSON.parse(raw):null;
  if(!flow||Date.now()>=flow.expiresAt||flow.binding!==memberBinding_()||flow.stamp!==googleConfig_().stamp)throw Error('這次登入已失效，請回原頁重新登入。');
  return flow;
}
function googleJson_(url,options){
  const response=UrlFetchApp.fetch(url,{...options,muteHttpExceptions:true,followRedirects:false});
  if(response.getResponseCode()!==200)throw Error('Google 登入沒有完成，請回原頁再試一次。');
  try{return JSON.parse(response.getContentText());}catch{throw Error('Google 登入暫時無法使用，請稍後再試。');}
}
function completeGoogleSignIn_(parameters){
  const state=parameters.state,lock=LockService.getScriptLock(),cache=CacheService.getScriptCache();let flow;
  lock.waitLock(10000);
  try{
    flow=googleFlow_(state);
    if(flow.status!=='pending')throw Error('這次登入已處理，請回到原本的午餐俱樂部頁面。');
    flow.status='exchanging';cache.put('google-flow:'+hash_(state),JSON.stringify(flow),600);
  }finally{lock.releaseLock();}
  try{
    if(parameters.error)throw Error('你已取消 Google 登入，可以回原頁重新選擇。');
    if(typeof parameters.code!=='string'||!parameters.code||parameters.code.length>4096)throw Error('Google 登入沒有完成，請回原頁再試一次。');
    const config=googleConfig_();
    const tokens=googleJson_('https://oauth2.googleapis.com/token',{method:'post',payload:{code:parameters.code,client_id:config.clientId,client_secret:config.secret,redirect_uri:config.redirect,grant_type:'authorization_code',code_verifier:flow.verifier}});
    if(typeof tokens.access_token!=='string'||!tokens.access_token)throw Error('Google 登入沒有完成，請回原頁再試一次。');
    // The code was exchanged directly with Google using this app's credentials and PKCE.
    // UserInfo is fetched from Google over HTTPS; no client-supplied identity is trusted.
    const identity=googleJson_('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokens.access_token}});
    if(typeof identity.sub!=='string'||!/^[\w-]{1,255}$/.test(identity.sub)||identity.email_verified!==true||typeof identity.email!=='string'||identity.email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email))throw Error('無法確認 Google 帳戶，請換個帳戶再試。');
    const member={googleId:identity.sub,email:identity.email,name:typeof identity.name==='string'?identity.name.slice(0,100):'食友'};
    lock.waitLock(10000);
    try{
      const current=googleFlow_(state);if(current.status!=='exchanging')throw Error('這次登入已失效，請再試一次。');
      const profile=upsertMember_(member),token=randomMemberToken_(),expiresAt=Date.now()+2*60*60*1000;
      cache.put('member:'+hash_(token),JSON.stringify({...member,binding:flow.binding,expiresAt,stamp:config.stamp}),7200);
      flow={...flow,status:'done',result:{token,expiresAt,email:profile.email,name:profile.name,nickname:profile.nickname}};delete flow.verifier;
      cache.put('google-flow:'+hash_(state),JSON.stringify(flow),Math.max(1,Math.ceil((flow.expiresAt-Date.now())/1000)));
    }finally{lock.releaseLock();}
    return 'Google 登入完成！請回到原本的午餐俱樂部頁面，這個分頁可以關閉了。';
  }catch(error){
    flow.status='failed';flow.error='Google 登入未完成，請回原頁重新登入。';delete flow.verifier;
    cache.put('google-flow:'+hash_(state),JSON.stringify(flow),Math.max(1,Math.ceil((flow.expiresAt-Date.now())/1000)));
    throw Error(flow.error);
  }
}
function googleCallbackPage_(parameters){
  let text;try{text=completeGoogleSignIn_(parameters);}catch(err){text=err.message;}
  const escaped=String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return HtmlService.createHtmlOutput('<!doctype html><html lang="zh-Hant"><head><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:48px 24px;background:#f8f7f2;color:#253f32;font:18px/1.8 system-ui"><h1>午餐俱樂部</h1><p>'+escaped+'</p></body></html>').setTitle('午餐俱樂部 · Google 登入');
}
function getGoogleSignInResult(state,pollToken){
  const flow=googleFlow_(state);
  if(typeof pollToken!=='string'||pollToken.length!==72||!sameHash_(hash_(pollToken),flow.pollHash))throw Error('這次登入已失效，請再試一次。');
  if(flow.status==='failed')throw Error(flow.error);
  return flow.status==='done'?{status:'done',member:flow.result}:{status:'pending'};
}
function requireMember_(token){
  if(typeof token!=='string'||token.length!==72)throw Error('MEMBER_REQUIRED: 請先用 Google 登入，再留下心得或投票。');
  const raw=CacheService.getScriptCache().get('member:'+hash_(token)),member=raw?JSON.parse(raw):null;
  if(!member||Date.now()>=member.expiresAt||member.binding!==memberBinding_()||member.stamp!==googleConfig_().stamp)throw Error('MEMBER_REQUIRED: 登入已到期，請重新用 Google 登入。');
  return member;
}
function memberRows_(){const sheet=communitySheet_('Members',MEMBER_HEADERS_),n=sheet.getLastRow()-1;return {sheet,rows:n>0?sheet.getRange(2,1,n,MEMBER_HEADERS_.length).getValues():[]};}
function upsertMember_(identity,nickname){
  const {sheet,rows}=memberRows_(),storedId='google:'+identity.googleId,index=rows.findIndex(r=>String(r[0])===storedId);
  const profile={...identity,nickname:nickname===undefined?(index>=0?storedNickname_(rows[index][3]):''):nickname};
  // Prefix numeric Google subjects so Sheets cannot round long IDs as numbers.
  const values=[storedId,safeCell_(profile.email),safeCell_(profile.name),safeCell_(profile.nickname),new Date().toISOString()];
  if(index<0)sheet.appendRow(values);else sheet.getRange(index+2,1,1,MEMBER_HEADERS_.length).setValues([values]);
  return profile;
}
function nickname_(value){if(typeof value!=='string'||value.trim().length>32||/[\u0000-\u001f\u007f]/.test(value))throw Error('暱稱最多 32 個字，請勿換行。');return value.trim();}
function storedNickname_(value){try{return nickname_(readCell_(value));}catch{return '';}}
function memberProfile_(member){const {rows}=memberRows_(),row=rows.find(r=>String(r[0])==='google:'+member.googleId);return {...member,nickname:row?storedNickname_(row[3]):''};}
function saveMemberNickname(nickname,token){
  const member=requireMember_(token),value=nickname_(nickname),lock=LockService.getScriptLock();lock.waitLock(10000);
  try{const profile=upsertMember_(member,value);return {email:profile.email,name:profile.name,nickname:profile.nickname};}finally{lock.releaseLock();}
}
function memberLogout(token){requireMember_(token);CacheService.getScriptCache().remove('member:'+hash_(token));return true;}

// Build prepends the shared catalog and review validators to Code.gs.
const FREE_HEADERS_=['id','name','address','lat','lng','phone','category','budget_twd','covered_route','weekly_hours','maps_url','added_at','diet','covered_origin'];
const REVIEW_HEADERS_=['id','restaurant_id','item','feedback','score','author_key','request_id','created_at','author_email','author_name','author_nickname'];
const VOTE_HEADERS_=['review_id','voter_key','value','updated_at'];
function doGet(event){if(event&&event.parameter&&(event.parameter.state||event.parameter.code||event.parameter.error))return googleCallbackPage_(event.parameter);return HtmlService.createHtmlOutputFromFile('Index').setTitle('午餐俱樂部 · 今天吃什麼').addMetaTag('viewport','width=device-width, initial-scale=1, viewport-fit=cover');}
function getBootstrap(){
  const p=PropertiesService.getScriptProperties(),rawLat=p.getProperty('ORIGIN_LAT'),rawLng=p.getProperty('ORIGIN_LNG');
  const point=LunchCatalog.point({lat:rawLat,lng:rawLng}),lat=point?.lat,lng=point?.lng,verified=Boolean(point);
  return {origin:verified?{lat,lng}:{lat:25.0143,lng:121.4638},originName:(p.getProperty('ORIGIN_NAME')||'板橋車站・北二門').slice(0,80),originVerified:verified,sharedConfigured:Boolean(p.getProperty('SPREADSHEET_ID')),adminConfigured:Boolean(adminSecret_()),tileUrl:p.getProperty('TILE_URL')||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',tileAttribution:p.getProperty('TILE_ATTRIBUTION')||''};
}
function listCandidates(format){const lock=LockService.getScriptLock();lock.waitLock(10000);try{const records=rows_(sheet_());return format==='json'?JSON.stringify(records):records;}finally{lock.releaseLock();}}
function getSharedHome(format){
  const data={config:{...getBootstrap(),googleLoginConfigured:googleConfig_().configured},records:listCandidates()};
  // A text response crosses Apps Script's browser bridge without nested service types.
  return format==='json'?JSON.stringify(data):data;
}
function addCandidate(input,token){
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    requireAdmin_(token);
    const record=LunchCatalog.validate(input);
    const sheet=sheet_(),found=rows_(sheet).find(row=>!row.unavailable&&LunchCatalog.fingerprint(row)===LunchCatalog.fingerprint(record));
    if(found)return {record:found,duplicate:true};
    record.id=Utilities.getUuid();record.addedAt=new Date().toISOString();
    sheet.appendRow([record.id,safeCell_(record.name),safeCell_(record.address),record.location.lat,record.location.lng,safeCell_(record.phone),record.category,record.budget===null?'':record.budget,record.covered,JSON.stringify(record.weeklyHours),record.mapsUrl,record.addedAt,record.diet,record.coveredOrigin?JSON.stringify(record.coveredOrigin):'']);
    SpreadsheetApp.flush();return {record,duplicate:false};
  }finally{lock.releaseLock();}
}
// Only these two authentication endpoints are public. Helpers ending in _
// cannot be invoked through google.script.run. Never return script properties.
function adminLogin(passphrase){
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const secret=adminSecret_();if(!secret)throw Error('管理功能尚未設定，請擁有者設定 ADMIN_PASSPHRASE。');
    const props=PropertiesService.getScriptProperties(),now=Date.now();
    let attempts=JSON.parse(props.getProperty('ADMIN_LOGIN_ATTEMPTS')||'{"count":0,"until":0}');
    if(now>=attempts.until)attempts={count:0,until:now+10*60*1000};
    if(attempts.count>=10)throw Error('登入嘗試過於頻繁，請於 10 分鐘後再試。');
    if(typeof passphrase!=='string'||passphrase.length>256||!sameHash_(hash_(passphrase),hash_(secret))){
      attempts.count++;props.setProperty('ADMIN_LOGIN_ATTEMPTS',JSON.stringify(attempts));
      throw Error('通關密語不正確。');
    }
    props.deleteProperty('ADMIN_LOGIN_ATTEMPTS');
    const token=Utilities.getUuid()+Utilities.getUuid(),expiresAt=now+30*60*1000;
    CacheService.getScriptCache().put('admin:'+hash_(token),JSON.stringify({expiresAt,secretHash:hash_(secret)}),1800);
    return {token,expiresAt};
  }finally{lock.releaseLock();}
}
function adminLogout(token){
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{if(typeof token==='string'&&token.length===72)CacheService.getScriptCache().remove('admin:'+hash_(token));return true;}
  finally{lock.releaseLock();}
}
function adminSecret_(){const value=PropertiesService.getScriptProperties().getProperty('ADMIN_PASSPHRASE')||'';return value.length>=20&&value.length<=256?value:'';}
function hash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(b=>(b&255).toString(16).padStart(2,'0')).join('');}
function sameHash_(a,b){let mismatch=a.length^b.length;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);return mismatch===0;}
function requireAdmin_(token){
  const secret=adminSecret_();
  if(!secret||typeof token!=='string'||token.length!==72)throw Error('AUTH_REQUIRED: 請先登入管理員。');
  const raw=CacheService.getScriptCache().get('admin:'+hash_(token)),session=raw?JSON.parse(raw):null;
  if(!session||Date.now()>=session.expiresAt||!sameHash_(session.secretHash,hash_(secret)))throw Error('AUTH_REQUIRED: 登入已失效，請重新登入管理員。');
}
function safeCell_(value){return /^[=+@\-\t\r\n]/.test(value)?"'"+value:value;}
function readCell_(value){const text=value==null?'':String(value);return /^'[=+@\-\t\r\n]/.test(text)?text.slice(1):text;}
function dateCell_(value){const date=value instanceof Date?value:new Date(typeof value==='string'?value:'');return Number.isFinite(date.getTime())?date.toISOString():'';}
function sheet_(){
  const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!id)throw Error('請在指令碼屬性設定 SPREADSHEET_ID；免費版不需要 API 金鑰。');
  const book=SpreadsheetApp.openById(id);let sheet=book.getSheetByName('RestaurantsFree');if(!sheet)sheet=book.insertSheet('RestaurantsFree');
  if(sheet.getLastRow()===0){sheet.appendRow(FREE_HEADERS_);sheet.setFrozenRows(1);}
  // Add only new columns to the exact v4 schema; retain every ID and review link.
  const headers=sheet.getRange(1,1,1,FREE_HEADERS_.length).getValues()[0];
  if(headers.slice(0,12).join('|')===FREE_HEADERS_.slice(0,12).join('|')&&!headers[12]&&!headers[13])sheet.getRange(1,13,1,2).setValues([FREE_HEADERS_.slice(12)]);
  if(sheet.getRange(1,1,1,FREE_HEADERS_.length).getValues()[0].join('|')!==FREE_HEADERS_.join('|'))throw Error('RestaurantsFree 表頭不正確，請參考部署說明；原資料未變更。');
  return sheet;
}
function rows_(sheet){
  const n=sheet.getLastRow()-1;if(n<1)return [];
  const values=sheet.getRange(2,1,n,FREE_HEADERS_.length).getValues().filter(r=>r.some(v=>!LunchCatalog.blank(v)));
  const needsType=value=>LunchCatalog.blank(value)||value==='其他'||value==='unknown';
  const original=values.some(r=>needsType(r[6]))?originalTypes_():new Map();
  return LunchCatalog.collection(values.map(r=>({id:readCell_(r[0]),name:readCell_(r[1]),address:readCell_(r[2]),location:{lat:r[3],lng:r[4]},phone:readCell_(r[5]),category:needsType(r[6])?(original.get(readCell_(r[0]))||r[6]):r[6],budget:r[7],covered:r[8],weeklyHours:r[9],mapsUrl:readCell_(r[10]),addedAt:dateCell_(r[11]),diet:r[12],coveredOrigin:r[13]})));
}
// Read the owner's original classifications by ID. Never guess from names or rewrite cells.
function originalTypes_(){
  const result=new Map(),seen=new Set();
  const book=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  const source=book.getSheetByName('原始清單');if(!source||source.getLastRow()<2)return result;
  const rows=source.getRange(1,1,source.getLastRow(),11).getValues(),headers=rows.shift();
  const idIndex=headers.indexOf('系統店家 ID'),typeIndex=headers.indexOf('店家類型');
  if(idIndex<0||typeIndex<0)return result;
  rows.forEach(row=>{
    const id=readCell_(row[idIndex]),type=LunchCatalog.normalizeCategory(row[typeIndex]);
    if(seen.has(id)){result.delete(id);return;}seen.add(id);
    if(LunchCatalog.categories.includes(type)&&type!=='其他')result.set(id,type);
  });
  return result;
}

// Public community actions do not grant permission to add restaurants.
function listReviews(restaurantId,memberToken,cursor){
  const id=LunchReviews.id(restaurantId,'這間店'),voter=memberToken?hash_('google:'+requireMember_(memberToken).googleId):'';
  const before=cursor?LunchReviews.id(cursor,'上一則評論'):null;
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    requireRestaurant_(id);
    const allReviews=reviewRows_(),reviews=allReviews.filter(r=>r.restaurantId===id).reverse(),votes=voteRows_();
    const start=before?reviews.findIndex(r=>r.id===before)+1:0;
    if(before&&start===0)throw Error('這頁評論已變動，請重新整理評論。');
    const page=reviews.slice(start,start+20);
    return {reviews:page.map(r=>publicReview_(r,votes,voter)),summary:reviewSummary_(reviews),unavailableCount:allReviews.invalidCount+votes.invalidCount,nextCursor:start+20<reviews.length?page[page.length-1].id:null};
  }finally{lock.releaseLock();}
}
function addReview(input,memberToken){
  const member=requireMember_(memberToken),review=LunchReviews.validate(input),author=hash_('google:'+member.googleId);
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    requireRestaurant_(review.restaurantId);
    const records=reviewRows_(),existing=records.find(r=>r.authorKey===author&&r.requestId===review.requestId);
    if(existing){
      if(existing.restaurantId!==review.restaurantId||existing.item!==review.item||existing.feedback!==review.feedback||existing.score!==review.score)throw Error('這則評論已送出，若要分享另一份餐點，請重新開啟評論表單。');
      return {review:publicReview_(existing,voteRows_(),author),duplicate:true};
    }
    const now=Date.now(),mine=records.filter(r=>r.authorKey===author);
    if(mine.filter(r=>now-Date.parse(r.createdAt)<60000).length>=5||mine.filter(r=>now-Date.parse(r.createdAt)<86400000).length>=50)throw Error('評論送出太頻繁，請稍後再試；同一帳號每分鐘最多 5 則、24 小時最多 50 則。');
    const profile=memberProfile_(member);
    const record={...review,id:Utilities.getUuid(),authorKey:author,createdAt:new Date().toISOString(),authorEmail:profile.email,authorName:profile.name,authorNickname:profile.nickname};
    communitySheet_('Reviews',REVIEW_HEADERS_).appendRow([record.id,record.restaurantId,safeCell_(record.item),safeCell_(record.feedback),record.score,author,record.requestId,record.createdAt,safeCell_(profile.email),safeCell_(profile.name),safeCell_(profile.nickname)]);
    SpreadsheetApp.flush();return {review:publicReview_(record,[],author),duplicate:false};
  }finally{lock.releaseLock();}
}
function setReviewVote(reviewId,value,memberToken){
  const member=requireMember_(memberToken),id=LunchReviews.id(reviewId,'這則評論'),choice=LunchReviews.vote(value),voter=hash_('google:'+member.googleId);
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const review=reviewRows_().find(r=>r.id===id);if(!review)throw Error('找不到這則評論，請重新整理。');
    requireRestaurant_(review.restaurantId);
    const votes=voteRows_(),existing=votes.find(v=>v.reviewId===id&&v.voterKey===voter),sheet=communitySheet_('ReviewVotes',VOTE_HEADERS_);
    // Set a desired state, never increment client-provided counts: retries are safe.
    if(existing){
      if(existing.value!==choice){sheet.getRange(existing.rowNumber,3,1,2).setValues([[choice,new Date().toISOString()]]);existing.value=choice;}
    }else if(choice!==0){sheet.appendRow([id,voter,choice,new Date().toISOString()]);votes.push({reviewId:id,voterKey:voter,value:choice});}
    SpreadsheetApp.flush();return publicReview_(review,votes,voter);
  }finally{lock.releaseLock();}
}
function requireRestaurant_(id){if(!rows_(sheet_()).some(r=>r.id===id&&!r.unavailable))throw Error('找不到資料完整的共用店家，請重新整理名單。');}
function communitySheet_(name,headers){
  const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!id)throw Error('共用試算表尚未設定。');
  const book=SpreadsheetApp.openById(id);let sheet=book.getSheetByName(name);if(!sheet)sheet=book.insertSheet(name);
  if(sheet.getLastRow()===0){sheet.appendRow(headers);sheet.setFrozenRows(1);}
  if(name==='Reviews'){
    const current=sheet.getRange(1,1,1,headers.length).getValues()[0];
    if(current.slice(0,8).join('|')===headers.slice(0,8).join('|')&&current.slice(8).every(value=>!value))sheet.getRange(1,9,1,3).setValues([headers.slice(8)]);
  }
  if(sheet.getRange(1,1,1,headers.length).getValues()[0].join('|')!==headers.join('|'))throw Error(name+' 表頭不正確，請擁有者確認；資料未覆寫。');
  return sheet;
}
function reviewRows_(){
  const sheet=communitySheet_('Reviews',REVIEW_HEADERS_),n=sheet.getLastRow()-1,result=[],counts=new Map();let invalidCount=0;
  const rows=n>0?sheet.getRange(2,1,n,REVIEW_HEADERS_.length).getValues():[];
  rows.forEach(r=>{if(!r.some(v=>!LunchCatalog.blank(v)))return;const id=readCell_(r[0]);counts.set(id,(counts.get(id)||0)+1);
    try{
      const restaurantId=LunchReviews.id(readCell_(r[1])),item=readCell_(r[2]).trim(),feedback=readCell_(r[3]).trim();LunchReviews.id(id);
      if(!item||item.length>100||!feedback||feedback.length>1500)throw Error('invalid review');
      const score=LunchReviews.score(LunchCatalog.blank(r[4])?NaN:LunchCatalog.number(r[4]));
      result.push({id,restaurantId,item,feedback,score,authorKey:readCell_(r[5]),requestId:readCell_(r[6]),createdAt:dateCell_(r[7]),authorEmail:readCell_(r[8]),authorName:readCell_(r[9]),authorNickname:readCell_(r[10])});
    }catch{invalidCount++;}
  });
  const valid=result.filter(r=>{if(counts.get(r.id)>1){invalidCount++;return false;}return true;});valid.invalidCount=invalidCount;return valid;
}
function voteRows_(){
  const sheet=communitySheet_('ReviewVotes',VOTE_HEADERS_),n=sheet.getLastRow()-1,unique=new Map();let invalidCount=0;
  (n>0?sheet.getRange(2,1,n,VOTE_HEADERS_.length).getValues():[]).forEach((r,i)=>{
    if(!r.some(v=>!LunchCatalog.blank(v)))return;
    try{const reviewId=LunchReviews.id(readCell_(r[0])),voterKey=readCell_(r[1]);if(!voterKey||voterKey.length>255||LunchCatalog.blank(r[2]))throw Error('invalid vote');
      const value=LunchReviews.vote(LunchCatalog.number(r[2])),key=reviewId+'|'+voterKey;if(unique.has(key))invalidCount++;
      unique.set(key,{reviewId,voterKey,value,rowNumber:i+2});
    }catch{invalidCount++;}
  });const valid=[...unique.values()];valid.invalidCount=invalidCount;return valid;
}
function publicReview_(r,votes,voter){
  const related=votes.filter(v=>v.reviewId===r.id),mine=related.find(v=>v.voterKey===voter);
  return {id:r.id,restaurantId:r.restaurantId,item:r.item,feedback:r.feedback,score:r.score,createdAt:r.createdAt,authorLabel:r.authorNickname||r.authorName||(r.authorEmail?'食友':'以前的匿名食友'),verifiedAccount:Boolean(r.authorEmail),likes:related.filter(v=>v.value===1).length,dislikes:related.filter(v=>v.value===-1).length,myVote:mine?mine.value:0};
}
function reviewSummary_(reviews){return {count:reviews.length,average:reviews.length?Math.round(reviews.reduce((sum,r)=>sum+r.score,0)/reviews.length*10)/10:null};}

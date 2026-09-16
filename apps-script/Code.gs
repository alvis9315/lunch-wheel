// Build prepends the shared catalog and review validators to Code.gs.
const FREE_HEADERS_=['id','name','address','lat','lng','phone','category','budget_twd','covered_route','weekly_hours','maps_url','added_at','diet','covered_origin'];
const REVIEW_HEADERS_=['id','restaurant_id','item','feedback','score','author_key','request_id','created_at','author_email','author_name','author_nickname','author_display_mode'];
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
    const id=readCell_(row[idIndex]),classification=LunchCatalog.parseCategories(row[typeIndex]);
    if(seen.has(id)){result.delete(id);return;}seen.add(id);
    if(classification.valid&&classification.values.length&&!classification.values.every(v=>['其他','unknown'].includes(v)))result.set(id,classification.values.join('、'));
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
  const requestedDisplay=input.display===undefined?null:memberDisplay_(input.display);
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    requireRestaurant_(review.restaurantId);
    const records=reviewRows_(),existing=records.find(r=>r.authorKey===author&&r.requestId===review.requestId);
    if(existing){
      if(existing.restaurantId!==review.restaurantId||existing.item!==review.item||existing.feedback!==review.feedback||existing.score!==review.score)throw Error('這則評論已送出，若要分享另一份餐點，請重新開啟評論表單。');
      if(requestedDisplay&&(existing.authorDisplayMode!==requestedDisplay.mode||existing.authorNickname!==requestedDisplay.nickname))throw Error('這則評論已送出，請重新整理確認原本的顯示方式。');
      return {review:publicReview_(existing,voteRows_(),author),duplicate:true};
    }
    const now=Date.now(),mine=records.filter(r=>r.authorKey===author);
    if(mine.filter(r=>now-Date.parse(r.createdAt)<60000).length>=5||mine.filter(r=>now-Date.parse(r.createdAt)<86400000).length>=50)throw Error('評論送出太頻繁，請稍後再試；同一帳號每分鐘最多 5 則、24 小時最多 50 則。');
    const profile=memberProfile_(member),display=requestedDisplay||{mode:profile.displayMode,nickname:profile.nickname};
    const record={...review,id:Utilities.getUuid(),authorKey:author,createdAt:new Date().toISOString(),authorEmail:profile.email,authorName:profile.name,authorNickname:display.nickname,authorDisplayMode:display.mode};
    communitySheet_('Reviews',REVIEW_HEADERS_).appendRow([record.id,record.restaurantId,safeCell_(record.item),safeCell_(record.feedback),record.score,author,record.requestId,record.createdAt,safeCell_(profile.email),safeCell_(profile.name),safeCell_(display.nickname),display.mode]);
    SpreadsheetApp.flush();return {review:publicReview_(record,[],author),duplicate:false};
  }finally{lock.releaseLock();}
}
// Private identity is fetched separately and authorized on every request.
function getReviewAuthor(reviewId,adminToken){
  requireAdmin_(adminToken);
  const id=LunchReviews.id(reviewId,'這則評論'),lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    requireAdmin_(adminToken);
    const review=reviewRows_().find(r=>r.id===id);if(!review)throw Error('找不到這則評論，請重新整理。');
    return {reviewId:id,publicName:reviewAuthorLabel_(review),nickname:storedNickname_(review.authorNickname),email:review.authorEmail||null};
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
  if(name==='Reviews'||name==='Members'){
    const current=sheet.getRange(1,1,1,headers.length).getValues()[0];
    const previousLengths=name==='Reviews'?[8,11]:[5];
    const previous=previousLengths.find(n=>current.slice(0,n).join('|')===headers.slice(0,n).join('|')&&current.slice(n).every(value=>!value));
    if(previous)sheet.getRange(1,previous+1,1,headers.length-previous).setValues([headers.slice(previous)]);
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
      result.push({id,restaurantId,item,feedback,score,authorKey:readCell_(r[5]),requestId:readCell_(r[6]),createdAt:dateCell_(r[7]),authorEmail:readCell_(r[8]),authorName:readCell_(r[9]),authorNickname:readCell_(r[10]),authorDisplayMode:readCell_(r[11])});
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
  return {id:r.id,restaurantId:r.restaurantId,item:r.item,feedback:r.feedback,score:r.score,createdAt:r.createdAt,authorLabel:reviewAuthorLabel_(r),verifiedAccount:Boolean(r.authorEmail),likes:related.filter(v=>v.value===1).length,dislikes:related.filter(v=>v.value===-1).length,myVote:mine?mine.value:0};
}
function reviewAuthorLabel_(review){
  const nickname=storedNickname_(review.authorNickname);
  // Blank mode is legacy: only an explicitly entered nickname can be public.
  return (review.authorDisplayMode==='nickname'||!review.authorDisplayMode)&&nickname?nickname:review.authorEmail?'匿名食友':'以前的匿名食友';
}
function reviewSummary_(reviews){return {count:reviews.length,average:reviews.length?Math.round(reviews.reduce((sum,r)=>sum+r.score,0)/reviews.length*10)/10:null};}

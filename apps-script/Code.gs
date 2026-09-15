// Build prepends the shared catalog and review validators to Code.gs.
const FREE_HEADERS_=['id','name','address','lat','lng','phone','category','budget_twd','covered_route','weekly_hours','maps_url','added_at','diet','covered_origin'];
const REVIEW_HEADERS_=['id','restaurant_id','item','feedback','score','author_key','request_id','created_at'];
const VOTE_HEADERS_=['review_id','voter_key','value','updated_at'];
function doGet(){return HtmlService.createHtmlOutputFromFile('Index').setTitle('午餐俱樂部 · 免費版').addMetaTag('viewport','width=device-width, initial-scale=1, viewport-fit=cover');}
function getBootstrap(){
  const p=PropertiesService.getScriptProperties(),rawLat=p.getProperty('ORIGIN_LAT'),rawLng=p.getProperty('ORIGIN_LNG');
  const lat=Number(rawLat),lng=Number(rawLng),verified=Boolean(rawLat&&rawLng&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180);
  return {origin:verified?{lat,lng}:{lat:25.0143,lng:121.4638},originName:(p.getProperty('ORIGIN_NAME')||'板橋車站・北二門').slice(0,80),originVerified:verified,sharedConfigured:Boolean(p.getProperty('SPREADSHEET_ID')),adminConfigured:Boolean(adminSecret_()),tileUrl:p.getProperty('TILE_URL')||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',tileAttribution:p.getProperty('TILE_ATTRIBUTION')||''};
}
function listCandidates(){const lock=LockService.getScriptLock();lock.waitLock(10000);try{return rows_(sheet_());}finally{lock.releaseLock();}}
function addCandidate(input,token){
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    requireAdmin_(token);
    const record=LunchCatalog.validate(input);
    const sheet=sheet_(),found=rows_(sheet).find(row=>LunchCatalog.fingerprint(row)===LunchCatalog.fingerprint(record));
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
function readCell_(value){const text=String(value);return /^'[=+@\-\t\r\n]/.test(text)?text.slice(1):text;}
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
  return sheet.getRange(2,1,n,FREE_HEADERS_.length).getValues().filter(r=>r[0]).map(r=>{
    const record={id:String(r[0]),name:readCell_(r[1]),address:readCell_(r[2]),location:{lat:Number(r[3]),lng:Number(r[4])},phone:readCell_(r[5]),category:String(r[6]),budget:r[7]===''?null:Number(r[7]),covered:String(r[8]),weeklyHours:JSON.parse(String(r[9])),mapsUrl:String(r[10]),addedAt:r[11] instanceof Date?r[11].toISOString():String(r[11]),diet:r[12]?String(r[12]):'unknown',coveredOrigin:r[13]?JSON.parse(String(r[13])):null};
    LunchCatalog.validate(record);return record;
  });
}

// Public community actions do not grant permission to add restaurants.
function listReviews(restaurantId,visitorToken,cursor){
  const id=LunchReviews.id(restaurantId,'店家識別碼'),voter=hash_(LunchReviews.visitor(visitorToken));
  const before=cursor?LunchReviews.id(cursor,'評論識別碼'):null;
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    requireRestaurant_(id);
    const reviews=reviewRows_().filter(r=>r.restaurantId===id).reverse(),votes=voteRows_();
    const start=before?reviews.findIndex(r=>r.id===before)+1:0;
    if(before&&start===0)throw Error('這頁評論已變動，請重新整理評論。');
    const page=reviews.slice(start,start+20);
    return {reviews:page.map(r=>publicReview_(r,votes,voter)),summary:reviewSummary_(reviews),nextCursor:start+20<reviews.length?page[page.length-1].id:null};
  }finally{lock.releaseLock();}
}
function addReview(input,visitorToken){
  const review=LunchReviews.validate(input),author=hash_(LunchReviews.visitor(visitorToken));
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    requireRestaurant_(review.restaurantId);
    const records=reviewRows_(),existing=records.find(r=>r.authorKey===author&&r.requestId===review.requestId);
    if(existing){
      if(existing.restaurantId!==review.restaurantId||existing.item!==review.item||existing.feedback!==review.feedback||existing.score!==review.score)throw Error('這次送出識別碼已使用，請重新開啟評論表單。');
      return {review:publicReview_(existing,voteRows_(),author),duplicate:true};
    }
    const now=Date.now(),mine=records.filter(r=>r.authorKey===author);
    if(mine.filter(r=>now-Date.parse(r.createdAt)<60000).length>=5||mine.filter(r=>now-Date.parse(r.createdAt)<86400000).length>=50)throw Error('評論送出太頻繁，請稍後再試；同一瀏覽器每分鐘最多 5 則、24 小時最多 50 則。');
    const record={...review,id:Utilities.getUuid(),authorKey:author,createdAt:new Date().toISOString()};
    communitySheet_('Reviews',REVIEW_HEADERS_).appendRow([record.id,record.restaurantId,safeCell_(record.item),safeCell_(record.feedback),record.score,author,record.requestId,record.createdAt]);
    SpreadsheetApp.flush();return {review:publicReview_(record,[],author),duplicate:false};
  }finally{lock.releaseLock();}
}
function setReviewVote(reviewId,value,visitorToken){
  const id=LunchReviews.id(reviewId,'評論識別碼'),choice=LunchReviews.vote(value),voter=hash_(LunchReviews.visitor(visitorToken));
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
function requireRestaurant_(id){if(!rows_(sheet_()).some(r=>r.id===id))throw Error('找不到這間共用店家，請重新整理名單。');}
function communitySheet_(name,headers){
  const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!id)throw Error('共用試算表尚未設定。');
  const book=SpreadsheetApp.openById(id);let sheet=book.getSheetByName(name);if(!sheet)sheet=book.insertSheet(name);
  if(sheet.getLastRow()===0){sheet.appendRow(headers);sheet.setFrozenRows(1);}
  if(sheet.getRange(1,1,1,headers.length).getValues()[0].join('|')!==headers.join('|'))throw Error(name+' 表頭不正確，請擁有者確認；資料未覆寫。');
  return sheet;
}
function reviewRows_(){
  const sheet=communitySheet_('Reviews',REVIEW_HEADERS_),n=sheet.getLastRow()-1;if(n<1)return [];
  return sheet.getRange(2,1,n,REVIEW_HEADERS_.length).getValues().filter(r=>r[0]).map(r=>({id:String(r[0]),restaurantId:String(r[1]),item:readCell_(r[2]),feedback:readCell_(r[3]),score:LunchReviews.score(Number(r[4])),authorKey:String(r[5]),requestId:String(r[6]),createdAt:r[7] instanceof Date?r[7].toISOString():String(r[7])}));
}
function voteRows_(){
  const sheet=communitySheet_('ReviewVotes',VOTE_HEADERS_),n=sheet.getLastRow()-1;if(n<1)return [];
  return sheet.getRange(2,1,n,VOTE_HEADERS_.length).getValues().map((r,i)=>({reviewId:String(r[0]),voterKey:String(r[1]),value:LunchReviews.vote(Number(r[2])),rowNumber:i+2})).filter(r=>r.reviewId);
}
function publicReview_(r,votes,voter){
  const related=votes.filter(v=>v.reviewId===r.id),mine=related.find(v=>v.voterKey===voter);
  return {id:r.id,restaurantId:r.restaurantId,item:r.item,feedback:r.feedback,score:r.score,createdAt:r.createdAt,likes:related.filter(v=>v.value===1).length,dislikes:related.filter(v=>v.value===-1).length,myVote:mine?mine.value:0};
}
function reviewSummary_(reviews){return {count:reviews.length,average:reviews.length?Math.round(reviews.reduce((sum,r)=>sum+r.score,0)/reviews.length*10)/10:null};}

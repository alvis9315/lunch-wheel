// Suggestions never write to the restaurant list. Curator-only reads and status updates.
const SUGGESTION_HEADERS_=['id','request_id','name','maps_url','note','submitter_key','submitter_email','created_at','status','reviewed_at'];
function suggestionInput_(input){
  if(!input||typeof input!=='object')throw Error('請填寫店名和 Google Maps 連結。');
  const name=typeof input.name==='string'?input.name.trim():'',mapsUrl=typeof input.mapsUrl==='string'?input.mapsUrl.trim():'',note=input.note==null?'':input.note;
  if(!name||name.length>100||/[\u0000-\u001f\u007f]/.test(name))throw Error('店名請填 1～100 個字，請勿換行。');
  if(typeof note!=='string'||note.length>1000)throw Error('推薦理由最多 1000 個字。');
  // Use the same trusted Google Maps host/path validation as curated restaurants.
  if(!mapsUrl||/[\s\u0000-\u001f\u007f]/.test(mapsUrl))throw Error('請貼上 Google Maps 店家的分享連結。');
  try{LunchCatalog.validate({name,location:{lat:0,lng:0},mapsUrl});}catch{throw Error('請到 Google Maps 店家頁按「分享」，複製連結後貼到這裡。');}
  return {requestId:LunchReviews.id(input.requestId,'這次投稿'),name,mapsUrl,note:note.trim()};
}
function suggestionRows_(){
  const sheet=communitySheet_('Suggestions',SUGGESTION_HEADERS_),n=sheet.getLastRow()-1;
  const rows=n>0?sheet.getRange(2,1,n,SUGGESTION_HEADERS_.length).getValues():[];
  return {sheet,rows:rows.map((r,i)=>({id:readCell_(r[0]),requestId:readCell_(r[1]),name:readCell_(r[2]),mapsUrl:readCell_(r[3]),note:readCell_(r[4]),key:readCell_(r[5]),email:readCell_(r[6]),createdAt:dateCell_(r[7]),status:readCell_(r[8])||'pending',row:i+2})).filter(r=>r.id&&r.name)};
}
function addSuggestion(input,memberToken){
  const member=requireMember_(memberToken),value=suggestionInput_(input),key=hash_('google:'+member.googleId),lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const {sheet,rows}=suggestionRows_(),previous=rows.find(r=>r.key===key&&r.requestId===value.requestId);
    if(previous){if(previous.name!==value.name||previous.mapsUrl!==value.mapsUrl||previous.note!==value.note)throw Error('這次投稿已送出，請重新開啟視窗再推薦另一間店。');return {received:true,duplicate:true};}
    if(rows.some(r=>r.status==='pending'&&r.name===value.name&&r.mapsUrl===value.mapsUrl))return {received:true,duplicate:true};
    const now=Date.now(),mine=rows.filter(r=>r.key===key);
    if(mine.filter(r=>now-Date.parse(r.createdAt)<600000).length>=3||mine.filter(r=>now-Date.parse(r.createdAt)<86400000).length>=10)throw Error('先讓團長看看這幾間吧！每 10 分鐘可推薦 3 間，一天最多 10 間，請稍後再來。');
    sheet.appendRow([Utilities.getUuid(),value.requestId,safeCell_(value.name),safeCell_(value.mapsUrl),safeCell_(value.note),key,safeCell_(member.email),new Date().toISOString(),'pending','']);
    SpreadsheetApp.flush();return {received:true,duplicate:false};
  }finally{lock.releaseLock();}
}
function listSuggestions(adminToken,cursor){
  requireAdmin_(adminToken);const before=cursor?LunchReviews.id(cursor,'上一則投稿'):null,lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    requireAdmin_(adminToken);const all=suggestionRows_().rows.filter(r=>r.status==='pending').reverse();
    const start=before?all.findIndex(r=>r.id===before)+1:0;if(before&&start===0)throw Error('投稿內容已更新，請重新整理。');
    const page=all.slice(start,start+30);
    return {items:page.map(r=>({id:r.id,name:r.name,mapsUrl:r.mapsUrl,note:r.note,email:r.email,createdAt:r.createdAt})),nextCursor:start+30<all.length?page[page.length-1].id:null,total:all.length};
  }finally{lock.releaseLock();}
}
function completeSuggestion(id,adminToken){
  requireAdmin_(adminToken);id=LunchReviews.id(id,'這則投稿');const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{requireAdmin_(adminToken);const {sheet,rows}=suggestionRows_(),row=rows.find(r=>r.id===id);if(!row)throw Error('找不到這則投稿，請重新整理。');
    if(row.status!=='done')sheet.getRange(row.row,9,1,2).setValues([['done',new Date().toISOString()]]);
    return {id,status:'done'};
  }finally{lock.releaseLock();}
}

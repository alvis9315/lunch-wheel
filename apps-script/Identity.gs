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
  const profile={...identity,nickname:nickname===undefined?(index>=0?readCell_(rows[index][3]):''):nickname};
  // Prefix numeric Google subjects so Sheets cannot round long IDs as numbers.
  const values=[storedId,safeCell_(profile.email),safeCell_(profile.name),safeCell_(profile.nickname),new Date().toISOString()];
  if(index<0)sheet.appendRow(values);else sheet.getRange(index+2,1,1,MEMBER_HEADERS_.length).setValues([values]);
  return profile;
}
function nickname_(value){if(typeof value!=='string'||value.trim().length>32||/[\u0000-\u001f\u007f]/.test(value))throw Error('暱稱最多 32 個字，請勿換行。');return value.trim();}
function memberProfile_(member){const {rows}=memberRows_(),row=rows.find(r=>String(r[0])==='google:'+member.googleId);return {...member,nickname:row?readCell_(row[3]):''};}
function saveMemberNickname(nickname,token){
  const member=requireMember_(token),value=nickname_(nickname),lock=LockService.getScriptLock();lock.waitLock(10000);
  try{const profile=upsertMember_(member,value);return {email:profile.email,name:profile.name,nickname:profile.nickname};}finally{lock.releaseLock();}
}
function memberLogout(token){requireMember_(token);CacheService.getScriptCache().remove('member:'+hash_(token));return true;}

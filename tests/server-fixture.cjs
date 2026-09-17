const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=function fixture({realtime=false}={}){
  const props=new Map([['SPREADSHEET_ID','fixture-sheet'],['ADMIN_PASSPHRASE','fixture-only-very-long-passphrase-12345']]),cache=new Map(),data=[],sheets=new Map();
  let held=false,now=Date.now(),activeUser='fixture-google-browser',identity=null;
  const clock=()=>realtime?Date.now():now;
  const requests=[];
  function makeSheet(name,rows=[]){const sheet={data:rows,getLastRow:()=>rows.length,setFrozenRows(){},getRange:(r,c,n=1,m=1)=>({getValues:()=>rows.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+m)),setValues:values=>{assert(held);assert.equal(values.length,n);values.forEach((row,i)=>{assert.equal(row.length,m);row.forEach((value,j)=>{rows[r-1+i][c-1+j]=value;});});}}),appendRow:r=>{assert(held);rows.push([...r]);}};sheets.set(name,sheet);return sheet;}
  makeSheet('RestaurantsFree',data);
  const box={Date:class extends Date{constructor(...args){super(...(args.length?args:[clock()]));}static now(){return clock();}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k)})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},LockService:{getScriptLock:()=>({waitLock:()=>{assert(!held);held=true;},releaseLock:()=>held=false})},SpreadsheetApp:{openById:()=>({getSheetByName:name=>sheets.get(name)||null,insertSheet:name=>{assert(held);return makeSheet(name);}}),flush(){}},Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(algorithm,value,encoding)=>[...crypto.createHash(algorithm).update(value,encoding).digest()]},UrlFetchApp:{fetch:()=>{throw Error('Unexpected external request');}}};
  vm.createContext(box);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/Code.gs'),'utf8'),box);
  box.Session={getTemporaryActiveUserKey:()=>activeUser};
  box.Utilities.base64EncodeWebSafe=value=>Buffer.from(value).toString('base64url');
  box.UrlFetchApp.fetch=(url,options)=>{
    requests.push({url,options});if(!identity)throw Error('Unexpected external request');
    if(url==='https://oauth2.googleapis.com/token')return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({access_token:'fixture-google-access-token'})};
    if(url==='https://openidconnect.googleapis.com/v1/userinfo')return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(identity)};
    throw Error('Unexpected external URL');
  };
  function configureGoogle(){props.set('GOOGLE_CLIENT_ID','fixture.apps.googleusercontent.com');props.set('GOOGLE_CLIENT_SECRET','fixture-google-secret-not-real');props.set('GOOGLE_REDIRECT_URI','https://script.google.com/macros/s/fixture/exec');}
  function issueMember(sub='fixture-'+crypto.randomUUID(),email='foodfriend@example.test'){
    configureGoogle();identity={sub,email,email_verified:true,name:'Fixture Food Friend'};
    const flow=box.beginGoogleSignIn();box.completeGoogleSignIn_({state:flow.state,code:'fixture-code'});
    return box.getGoogleSignInResult(flow.state,flow.pollToken).member;
  }
  return {box,props,cache,data,sheets,requests,issueMember,configureGoogle,setIdentity:value=>{identity=value;},setActiveUser:value=>{activeUser=value;},makeSheet,advance:ms=>{now+=ms;},held:()=>held};
};

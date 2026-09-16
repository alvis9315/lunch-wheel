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
  function qualitySummary(records){
    const filters=[['category','店家類型'],['diet','葷素'],['budget','每人預算'],['hours','營業時間'],['covered','避雨情況'],['coveredOrigin','避雨出發點']];
    const general=[['phone','電話'],['address','地址'],['mapsUrl','地圖連結']];
    const missing=(r,key)=>key==='category'?typeName(r.category)==='尚未分類':key==='coveredOrigin'?r.covered==='yes'&&(r.dataIssues||[]).includes(key):(r.dataIssues||[]).includes(key);
    const count=fields=>fields.map(([key,label])=>({key,label,count:records.filter(r=>missing(r,key)).length})).filter(row=>row.count);
    return {total:records.length,blocked:records.filter(r=>r.unavailable).length,optional:records.filter(r=>!r.unavailable&&[...filters,...general].some(([key])=>missing(r,key))).length,filters:count(filters),general:count(general)};
  }
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
  const api={validate,fingerprint,hydrate,read,collection,blank,number,point,issueLabels,categories,diets,typeName,typeOptions,matchesType,normalizeCategory,qualitySummary};root.LunchCatalog=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

(function(root){
  'use strict';
  const categories=['台式','日式','韓式','西式','輕食','其他'];
  const diets={unknown:'葷素未確認',meat:'葷食',vegetarian:'素食',both:'葷素皆有'};
  const text=(v,max,label,required=false)=>{
    if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error(label+'格式不正確');
    return v.trim();
  };
  function validate(input){
    if(!input||typeof input!=='object')throw Error('新增資料格式不正確');
    const name=text(input.name,100,'店名',true),address=text(input.address||'',250,'地址');
    const location=input.location;
    if(!location||typeof location.lat!=='number'||typeof location.lng!=='number'||!Number.isFinite(location.lat)||!Number.isFinite(location.lng)||Math.abs(location.lat)>90||Math.abs(location.lng)>180)throw Error('請填寫有效經緯度或點選地圖位置');
    const phone=text(input.phone||'',40,'電話');
    if(phone&&!/^[+\d\s()#-]+$/.test(phone))throw Error('電話只接受數字、空白、括號、+、-、#');
    if(!categories.includes(input.category))throw Error('料理分類不正確');
    const diet=input.diet||'unknown';if(!Object.prototype.hasOwnProperty.call(diets,diet))throw Error('葷素標記不正確');
    if(!['yes','no','unknown'].includes(input.covered))throw Error('遮雨標記不正確');
    const coveredOrigin=input.coveredOrigin??null;
    if(coveredOrigin!==null&&(!coveredOrigin||!Number.isFinite(coveredOrigin.lat)||!Number.isFinite(coveredOrigin.lng)||Math.abs(coveredOrigin.lat)>90||Math.abs(coveredOrigin.lng)>180))throw Error('避雨路線出發點不正確');
    if(input.budget!==null&&(!Number.isInteger(input.budget)||input.budget<1||input.budget>10000))throw Error('預算請填 1～10000 整數或留空');
    const mapsUrl=text(input.mapsUrl||'',1000,'Google Maps 連結');
    if(mapsUrl&&!/^https:\/\/(?:maps\.app\.goo\.gl\/|goo\.gl\/maps(?:\/|\?)|(?:www\.)?google\.(?:com|com\.tw)\/maps(?:\/|\?)|maps\.google\.(?:com|com\.tw)\/(?:maps)?)/i.test(mapsUrl))throw Error('請貼上有效的 HTTPS Google Maps 分享連結');
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
  function fingerprint(record){return record.name.replace(/\s+/g,'').toLocaleLowerCase()+'|'+record.location.lat.toFixed(4)+'|'+record.location.lng.toFixed(4);}
  function hydrate(record){
    // Missing optional values can arrive as omitted properties or blank cells.
    // Normalize reads only; writes still require a valid number or explicit null.
    const budget=record.budget==null||(typeof record.budget==='string'&&!record.budget.trim())?null:record.budget;
    const checked=validate({...record,budget}),days=['日','一','二','三','四','五','六'];
    const periods=checked.weeklyHours.flatMap((day,d)=>day.status==='open'?day.spans.map(span=>{
      const [h,m]=span.from.split(':').map(Number),[ch,cm]=span.to.split(':').map(Number);
      return {open:{day:d,hour:h,minute:m},close:{day:span.to<span.from?(d+1)%7:d,hour:ch,minute:cm}};
    }):[]);
    return {...record,...checked,loaded:true,manualHours:true,periods,hoursText:checked.weeklyHours.map((day,i)=>'週'+days[i]+'：'+(day.status==='unknown'?'未填寫':day.status==='closed'?'休息':day.spans.map(s=>s.from+'–'+s.to+(s.to<s.from?'（翌日）':'')).join('、')))};
  }
  const api={validate,fingerprint,hydrate,categories,diets};root.LunchCatalog=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

/* Pure domain logic, shared by the browser and local verification. */
(function (root) {
  'use strict';
  const WEEK = 10080;
  function taipeiDay(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }
  function weekday(date = new Date()) { return new Date(taipeiDay(date) + 'T12:00:00Z').getUTCDay(); }
  function minutes(time) { const [h, m] = time.split(':').map(Number); return h * 60 + m; }
  function distance(a, b) {
    if (!a || !b || ![a.lat, a.lng, b.lat, b.lng].every(Number.isFinite)||Math.abs(a.lat)>90||Math.abs(b.lat)>90||Math.abs(a.lng)>180||Math.abs(b.lng)>180) return null;
    const r = Math.PI / 180, dlat = (b.lat-a.lat)*r, dlng = (b.lng-a.lng)*r;
    const q = Math.sin(dlat/2)**2 + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlng/2)**2;
    return 6371 * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(Math.max(0, 1-q)));
  }
  function validateOrigin(input){
    if(!input||!Number.isFinite(input.lat)||!Number.isFinite(input.lng)||Math.abs(input.lat)>90||Math.abs(input.lng)>180)throw Error('請填寫有效出發點經緯度。');
    if(typeof input.name!=='string'||!input.name.trim()||input.name.length>80)throw Error('出發點名稱請填 1～80 字。');
    return {lat:input.lat,lng:input.lng,name:input.name.trim()};
  }
  function coveredFrom(place,origin){const km=distance(place.coveredOrigin,origin);return km!==null&&km<=0.01;}
  function rainProbability(data,day,from,to){
    if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||![from,to].every(t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))return null;
    const start=minutes(from),end=minutes(to),hourly=data?.hourly;if(end<=start||!Array.isArray(hourly?.time)||!Array.isArray(hourly?.precipitation_probability))return null;
    const values=[];
    for(let h=Math.floor(start/60)+1;h<=Math.ceil(end/60);h++){
      const date=new Date(day+'T00:00:00Z');if(!Number.isFinite(date.getTime()))return null;date.setUTCHours(h);
      const key=date.toISOString().slice(0,16),indices=[];hourly.time.forEach((t,i)=>{if(t===key)indices.push(i);});
      if(indices.length!==1)return null;const value=hourly.precipitation_probability[indices[0]];if(!Number.isFinite(value)||value<0||value>100)return null;values.push(value);
    }
    return values.length?Math.max(...values):null;
  }
  function intervals(periods) {
    return (Array.isArray(periods)?periods:[]).flatMap(p => {
      if (!p?.open) return [];
      const point = v => v.day * 1440 + v.hour * 60 + v.minute;
      const start = point(p.open);
      if (!Number.isFinite(start)) return [];
      if (!p.close) return [{start, end:start + WEEK}];
      let end = point(p.close);
      if (!Number.isFinite(end)) return [];
      if (end <= start) end += WEEK;
      return [{start, end}];
    }).flatMap(p => [-WEEK,0,WEEK].map(n => ({start:p.start+n, end:p.end+n})));
  }
  function opening(place, from = '12:00', to = '13:00', date = new Date()) {
    if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') return {today:false, lunch:false, reason:place.businessStatus === 'CLOSED_PERMANENTLY' ? '已永久停業' : '暫停營業'};
    if (!Array.isArray(place.periods)) return {today:null, lunch:null, reason:'營業時間待確認'};
    if(place.manualHours){
      const day=weekday(date),prior=(day+6)%7;
      if(place.weeklyHours?.[day]?.status==='unknown')return {today:null,lunch:null,reason:'當日營業時間未填寫'};
      if(place.weeklyHours?.[day]?.status==='closed'&&place.weeklyHours?.[prior]?.status==='unknown')return {today:null,lunch:null,reason:'前一日跨夜時段待確認'};
    }
    const d = weekday(date) * 1440, spans = intervals(place.periods);
    const today = spans.some(p => p.start < d + 1440 && p.end > d);
    const start = d + minutes(from), end = d + minutes(to);
    const lunch = end > start && spans.some(p => p.start <= start && p.end >= end);
    return {today, lunch, reason:place.manualHours?(!today?'營業時間顯示今日休息':lunch?'營業時間涵蓋午餐':'營業時間未涵蓋午餐'):(!today ? '今日沒營業' : lunch ? '午餐時段營業' : '午餐時段未完整營業')};
  }
  function reasons(place, filters, context) {
    const out = [], km = distance(context.origin, place.location);
    if (!place.loaded||place.unavailable) out.push('店家必要資料待補，暫不抽選');
    const status = opening(place, filters.from, filters.to, context.now);
    if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') out.push(status.reason);
    if (filters.open && status.lunch !== true) out.push(status.reason);
    if (filters.walk !== 'any') {
      const ranges = {near:[0,.5],medium:[0,1],far:[.5,2]};
      const [min,max] = ranges[filters.walk]||[Infinity,-Infinity];
      if (km === null) out.push('距離未知');
      else if (km < min || km > max) out.push('距離不符合');
    }
    const rain = filters.weather === 'rain' || (filters.weather === 'auto' && context.weather.rain === true);
    if (filters.weather === 'auto' && context.weather.rain === null) out.push('天氣未知，請手選天氣');
    if (rain && place.covered !== 'yes') out.push('未確認全程可避雨');
    else if(rain&&!coveredFrom(place,context.origin))out.push('此出發點的避雨路線待確認');
    if (filters.budget !== 'any' && !(Number.isFinite(place.budget) && place.budget <= Number(filters.budget))) out.push(place.budget == null ? '預算未標記' : '超出預算');
    if (filters.category !== 'all' && !(root.LunchCatalog?root.LunchCatalog.matchesType(place,filters.category):place.category===filters.category)) out.push('餐點類別不符合');
    if(filters.diet&&filters.diet!=='any'&&place.diet!==filters.diet&&place.diet!=='both')out.push(!place.diet||place.diet==='unknown'?'葷素未標記':filters.diet==='vegetarian'?'未標記提供素食':'未標記提供葷食');
    if (filters.rating !== 'any' && !(typeof place.rating === 'number' && place.rating >= Number(filters.rating))) out.push('評分不足或未知');
    if (filters.noRepeat && context.lastId === place.id) out.push('上次已吃過');
    return [...new Set(out)];
  }
  function randomIndex(n, cryptoSource = root.crypto) {
    if (!Number.isInteger(n) || n < 2 || n > 20) throw Error('抽選需 2～20 間店家');
    const limit = Math.floor(4294967296/n)*n, bytes = new Uint32Array(1);
    do { cryptoSource.getRandomValues(bytes); } while (bytes[0] >= limit);
    return bytes[0] % n;
  }
  function rotation(index, count, current = 0) {
    const target = (360 - (index + .5) * 360/count) % 360;
    return current + 360*6 + ((target - current%360 + 360) % 360);
  }
  const api = {taipeiDay,weekday,minutes,distance,validateOrigin,coveredFrom,rainProbability,opening,reasons,randomIndex,rotation};
  root.LunchCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);

(function () {
  'use strict';
  const C = window.LunchCore, Catalog=window.LunchCatalog, $ = id => document.getElementById(id);
  const COLORS = ['#e7b978','#c4b9df','#b9caa3','#f1cfb7','#d4dbaa','#ec987d','#b5c9cf','#e8d7a7'];
  const ICONS = {'台式':'🍚','日式':'🍜','韓式':'🍲','西式':'🍝','輕食':'🥗','其他':'🍽'};
  const DEFAULT_FILTERS = {walk:'any',weather:'any',budget:'any',category:'all',diet:'any',rating:'any',from:'12:00',to:'13:00',open:false,noRepeat:false};
  const ORIGIN_STORAGE='lunch-club-origin-v1';
  let defaultOrigin={lat:25.0143,lng:121.4638,name:'板橋車站・北二門'},defaultOriginVerified=false,originCustom=false,originPicking=false,originRequest=0;
  const STORAGE = 'lunch-club-v3-';
  let adminSession=null,adminTimer,adminConfigured=false;
  let state = {mode:'loading',records:[],selected:new Set(),filters:{...DEFAULT_FILTERS},weather:{rain:null},origin:{lat:25.0143,lng:121.4638},lastId:null,rotation:0,busy:false,ready:false,detail:null};
  let toastTimer, weatherRequest = 0, detailRequest = 0, searchRequest = 0, mapView, markerLayer, originMarker, dateKey = C.taipeiDay();
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let sourceRequest=0,sourceLoading=false,sourceTimer=null,localSourceRecords=[];
  let stage='type',chosenType=null,confirmedIds=null;
  const typeIcons={'正餐':'🍚','早餐店':'🍳','便當／快餐':'🍱','小吃':'🥟','麵食':'🍜','拉麵':'🍜','牛排':'🥩','火鍋':'🍲','咖哩':'🍛','義大利麵':'🍝','咖啡廳':'☕','甜點':'🍰','冰品':'🍧'};
  const accountUI=window.createLunchAccountUI({rpc,onChange(){renderAccess();if($('detail-dialog').open&&state.detail&&state.mode==='live'){const host=$('detail-content').querySelector('.restaurant-reviews');if(host)reviewUI.mount(host,state.detail.id);}}});
  const reviewUI=window.createLunchReviewUI({rpc,escape:e,account:accountUI});
  function readOrigin(){try{const raw=localStorage.getItem(ORIGIN_STORAGE);return raw?C.validateOrigin(JSON.parse(raw)):null;}catch{return null;}}
  function updateOriginView(){
    $('origin-name').textContent=state.origin.name||defaultOrigin.name;
    $('map-placeholder').querySelector('.map-station').textContent='▣ '+(state.origin.name||defaultOrigin.name);
    $('map-placeholder').querySelector('.l1').textContent='示意道路';$('map-placeholder').querySelector('.l2').textContent='非實際地圖';
    $('origin-note').textContent=originCustom?'／自行設定':defaultOriginVerified?'':'／請確認出發位置';
    if(mapView){mapView.setView([state.origin.lat,state.origin.lng],16);originMarker.setLatLng([state.origin.lat,state.origin.lng]);const label=document.createElement('span');label.textContent=state.origin.name||defaultOrigin.name;originMarker.setTooltipContent(label);}
  }
  function applyOrigin(origin,custom=true){
    state.origin=C.validateOrigin(origin);originCustom=custom;state.weather={rain:null};originPicking=false;$('origin-pick-panel').hidden=true;
    try{if(custom)localStorage.setItem(ORIGIN_STORAGE,JSON.stringify(state.origin));else localStorage.removeItem(ORIGIN_STORAGE);}catch{message('這台裝置無法記住出發點，這次設定只在目前頁面有效。');}
    updateOriginView();render();loadWeather();
  }
  function openOrigin(position){
    if(state.busy||!state.ready)return;
    originPicking=false;$('origin-pick-panel').hidden=true;
    $('origin-input-name').value=position?'自訂出發點':state.origin.name||defaultOrigin.name;
    $('origin-lat').value=position?.lat??state.origin.lat;$('origin-lng').value=position?.lng??state.origin.lng;
    $('origin-feedback').textContent='儲存在這台裝置，私人與現有名單都可使用。';
    if(!$('origin-dialog').open)$('origin-dialog').showModal();
  }
  function chooseOriginOnMap(){
    if(!mapView){$('origin-feedback').textContent='這裡暫時無法選地圖位置，請使用目前位置或填寫經緯度。';return;}
    $('origin-dialog').close();originPicking=true;page('map');document.querySelector('.map-layout').dataset.view='map';
    document.querySelectorAll('.mobile-view button').forEach(b=>b.classList.toggle('active',b.dataset.view==='map'));
    $('origin-pick-panel').hidden=false;mapView.invalidateSize();$('google-map').scrollIntoView({block:'center'});
  }
  function locateOrigin(){
    if(!navigator.geolocation){$('origin-feedback').textContent='這台裝置不支援定位，請用地圖或填寫座標。';return;}
    const request=++originRequest;$('origin-geolocate').disabled=true;$('origin-feedback').textContent='正在取得位置，瀏覽器可能會詢問定位權限…';
    navigator.geolocation.getCurrentPosition(position=>{
      if(request!==originRequest||!$('origin-dialog').open)return;
      $('origin-lat').value=position.coords.latitude;$('origin-lng').value=position.coords.longitude;$('origin-input-name').value='目前位置';
      $('origin-feedback').textContent='位置已帶入，請確認後按「使用這個出發點」。';$('origin-geolocate').disabled=false;
    },()=>{if(request!==originRequest||!$('origin-dialog').open)return;$('origin-feedback').textContent='未取得定位權限或定位失敗，可以改用地圖選點或自行填座標。';$('origin-geolocate').disabled=false;},{enableHighAccuracy:false,timeout:10000,maximumAge:60000});
  }
  function message(text) {
    const dialog=document.querySelector('dialog[open]');
    if(dialog){let note=dialog.querySelector('.dialog-feedback');if(!note){note=document.createElement('p');note.className='notice dialog-feedback';note.setAttribute('role','alert');(dialog.querySelector('#detail-content, #result-content')||dialog).append(note);}note.textContent=text;note.scrollIntoView({block:'nearest'});return;}
    $('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').hidden=true;},5500);
  }
  const categoryName=Catalog.typeName;
  const hydrateCatalog=rows=>Catalog.collection(rows).map(record=>Catalog.hydrate(record));
  function getLocal(mode=state.mode) {
    try {
      const raw=localStorage.getItem(STORAGE+mode);
      if(raw){const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||(mode==='local'&&parsed.localRecords!==undefined&&!Array.isArray(parsed.localRecords)))throw Error();return parsed;}
      // Migrate personal additions from v2; never copy shared rows into personal data.
      const old=JSON.parse(localStorage.getItem('lunch-club-free-v2')||'{}');
      return mode==='local'&&old.mode==='demo'?{...old,localRecords:(Array.isArray(old.localRecords)?old.localRecords:[]).filter(p=>p&&!p.demo)}:{};
    } catch { if(mode==='local')throw Error('這台裝置保存的名單無法讀取，原內容已保留，請聯絡管理者協助。');return {}; }
  }
  function saveLocal() {
    if(!state.ready)return;
    try { localStorage.setItem(STORAGE+state.mode,JSON.stringify({selected:[...state.selected],lastId:state.lastId,localRecords:state.mode==='local'?localSourceRecords:undefined})); }
    catch { message('這台裝置無法記住名單，關閉頁面後這次的選擇會消失。'); }
  }
  function canAdd(){return state.ready&&(state.mode==='local'||(state.mode==='live'&&adminSession&&Date.now()<adminSession.expiresAt));}
  function renderAccess(){
    const member=accountUI.current();$('account-button').hidden=state.mode!=='live';$('account-button').textContent=member?(member.nickname||member.name||'我的帳號'):'Google 登入';
    const active=state.mode==='live'&&adminSession&&Date.now()<adminSession.expiresAt;
    $('manual-add-button').hidden=!canAdd();$('demo-explore').hidden=!canAdd();
    $('admin-button').hidden=state.mode!=='live';$('admin-button').textContent=active?'管理員登出':'管理員登入';
    $('source-label').textContent=state.mode==='local'?'我的名單':active?'現有名單 · 管理者':'現有名單';
    $('mode-banner').textContent=state.mode==='local'?'自己的名單只留在這台裝置。清除網站紀錄後，名單也會一併清除。':active?'管理者已登入，可以新增名單中的店家。登入最長 30 分鐘；網站不提供刪除功能。':'店家由管理者整理。挑選午餐，也歡迎登入分享吃過的心得。';
  }
  function clearAdmin(){adminSession=null;clearTimeout(adminTimer);$('admin-passphrase').value='';renderAccess();}
  async function signOut(){
    const token=adminSession?.token;clearAdmin();
    if(token)try{await rpc('adminLogout',token);}catch{message('已離開管理模式。請關閉這個頁面以完成登出。');}
  }
  async function adminAction(){
    if(state.busy)return;
    if(adminSession){await signOut();return;}
    if(!adminConfigured){message('管理功能尚未準備好，請聯絡名單管理者。');return;}
    $('admin-feedback').textContent='登入有效 30 分鐘，關閉或重新整理頁面後需重新登入。';
    $('admin-dialog').showModal();$('admin-passphrase').focus();
  }
  async function loginAdmin(event){
    event.preventDefault();const button=event.target.querySelector('button[type="submit"]');
    if(button.disabled)return;button.disabled=true;$('admin-feedback').textContent='正在確認通關密語…';
    let passphrase=$('admin-passphrase').value;$('admin-passphrase').value='';
    try{
      const pending=rpc('adminLogin',passphrase);passphrase='';const session=await pending;
      if(state.mode!=='live'||!$('admin-dialog').open){await rpc('adminLogout',session.token);return;}
      adminSession=session;clearTimeout(adminTimer);adminTimer=setTimeout(()=>{clearAdmin();message('管理員登入已到期，新增店家前請重新登入。');},Math.max(0,session.expiresAt-Date.now()));
      $('admin-dialog').close();renderAccess();message('登入成功，可以新增名單中的店家。');
    }catch(err){$('admin-feedback').textContent=err.message;}
    finally{passphrase='';button.disabled=false;}
  }
  function rpc(method,...args) {
    return new Promise((resolve,reject)=> {
      const timer=setTimeout(()=>reject(Error(/^(add|set|save)/.test(method)?'送出時間較久，請重新整理，確認是否已經成功。':'等待時間較久，請再試一次。')),20000);
      const fail=err=>{clearTimeout(timer);let text=typeof err?.message==='string'?err.message:'暫時連不上，請稍後再試。';const code=text.includes('MEMBER_REQUIRED:')?'MEMBER_REQUIRED':text.includes('AUTH_REQUIRED:')?'AUTH_REQUIRED':'';text=text.replace(/^(?:Error: |Exception: )/,'').replace(/(?:MEMBER_REQUIRED|AUTH_REQUIRED):\s*/,'');if(/SPREADSHEET_ID|表頭|JSON|Unexpected|TypeError|ReferenceError|Script function|伺服器函式|Authorization|授權|permission/i.test(text))text='名單暫時無法開啟，請聯絡名單管理者確認設定後再試。';const error=Error(text);error.code=code;reject(error);};
      try{google.script.run.withSuccessHandler(value=>{clearTimeout(timer);resolve(value);}).withFailureHandler(fail)[method](...args);}catch(err){fail(err);}
    });
  }
  function demoPlaces() {
    const day = C.weekday();
    return [
      ['巷口好食堂','台式',130,'yes',4.4,.002,.001],['日日咖哩所','日式',220,'yes',4.5,-.002,.003],['青禾沙拉','輕食',180,'yes',4.2,.001,-.003],['小島拉麵','日式',260,'no',4.6,.004,.002],['暖暖韓食','韓式',230,'no',4.3,.001,.008],['轉角義麵屋','西式',280,'unknown',4.1,-.006,.003],['慢慢吃便當','台式',120,'yes',4.3,-.003,-.002],['森林餐桌','輕食',320,'no',4.7,.008,-.003],['週末小廚','西式',290,'unknown',4.0,.003,.004],['好日子定食','日式',240,'yes',4.4,-.004,.002]
    ].map((p,i)=>({id:'demo-'+i,name:p[0],category:p[1],budget:p[2],covered:p[3],rating:p[4],location:{lat:state.origin.lat+p[5],lng:state.origin.lng+p[6]},businessStatus:'OPERATIONAL',loaded:true,phone:null,address:'虛構示範店家，非真實店址',periods:i===8?[]:[{open:{day,hour:10,minute:0},close:{day,hour:21,minute:0}}],hoursText:['示範時段：10:00–21:00'],demo:true}));
  }
  function context() { return {origin:state.origin,weather:state.weather,lastId:state.lastId,now:new Date()}; }
  function selectedPlaces() { return state.records.filter(p=>state.selected.has(p.id)); }
  function inType(p){return Catalog.matchesType(p,chosenType||'all');}
  function eligible() { return selectedPlaces().filter(p=>inType(p)&&C.reasons(p,state.filters,context()).length===0); }
  function wheelPlaces(){return eligible().filter(p=>confirmedIds?.has(p.id));}
  function visiblePlaces(){const query=$('pick-search').value.trim().toLowerCase();return state.records.filter(p=>inType(p)&&(p.name+' '+p.address).toLowerCase().includes(query)&&C.reasons(p,state.filters,context()).length===0);}
  function renderTypes(){
    $('type-options').innerHTML=Catalog.typeOptions(state.records).map(t=>'<button class="type-card" data-type="'+e(t.value)+'"><span aria-hidden="true">'+(t.value==='all'?'✳':typeIcons[t.value]||'🍽')+'</span><strong>'+e(t.label)+'</strong><small>'+t.count+' 間店</small><b aria-hidden="true">↗</b></button>').join('');
    const unknown=state.records.filter(p=>Catalog.typeName(p.category)==='尚未分類').length;
    $('type-note').textContent=!state.records.length?'名單還沒有店家，請聯絡管理者加入。':unknown?unknown+' 間店尚未分類，選「不限」或「尚未分類」仍能查看；不會自動當成其他類型。':'依名單已填寫的類型顯示，沒有店家的類型不會出現。正餐尚未細分；素食需求可在下一步選擇。';
  }
  function chooseType(value){
    if(state.busy||!Catalog.typeOptions(state.records).some(t=>t.value===value))return;
    chosenType=value;confirmedIds=null;state.selected=new Set();$('pick-search').value='';
    resetFilters();page('pick');saveLocal();
  }
  function confirmSelection(){
    if(state.busy||!validTime())return;
    const choices=eligible();if(choices.length<2||choices.length>20){message('請勾選 2–20 間符合條件的店家。');return;}
    // Only visible filter matches enter this round; hidden choices cannot reappear on refresh.
    state.selected=new Set(choices.map(p=>p.id));confirmedIds=new Set(state.selected);saveLocal();page('wheel');render();
  }
  function renderPick(){
    const list=visiblePlaces(),count=eligible().length,hidden=state.selected.size-count;
    const label=chosenType==='all'?'不限':chosenType==='unclassified'?'尚未分類':chosenType||'尚未選擇';
    $('type-summary').textContent='今天想吃：'+label+' · 先設定偏好，再勾選 2–20 間店。';
    $('pick-count').textContent='顯示 '+list.length+' 間 · 已勾選 '+count+' 間'+(hidden?'（另有 '+hidden+' 間不符合條件，確認時會略過）':'');
    $('confirm-note').textContent=count>=2?'這 '+count+' 間進入轉盤，每間機會相同':'再勾選 '+(2-count)+' 間就能抽午餐';
    $('confirm-selection').disabled=state.busy||!validTime()||count<2||count>20;
    $('select-visible').textContent=list.length>20?'勾選目前前 20 間':'勾選目前顯示的店家';
    $('select-visible').disabled=state.busy||!list.length;
    $('clear-selection').disabled=state.busy||!state.selected.size;
    $('restaurant-cards').innerHTML=list.map(p=>'<article class="restaurant-card '+(state.selected.has(p.id)?'selected':'')+'"><label class="restaurant-select"><input type="checkbox" data-select="'+e(p.id)+'" aria-label="本次抽選 '+e(p.name)+'" '+(state.selected.has(p.id)?'checked':'')+' '+(state.busy?'disabled':'')+'><span>加入今天名單</span></label><div class="restaurant-art" aria-hidden="true">'+(typeIcons[p.category]||ICONS[p.category]||'🍽')+'</div><button class="restaurant-info" data-detail="'+e(p.id)+'"><strong>'+e(p.name)+'</strong><span>'+e(categoryName(p.category))+' · '+e(Catalog.diets[p.diet]||Catalog.diets.unknown)+'</span><span>'+kmText(p)+' · '+(p.budget==null?'預算未提供':'NT$ '+p.budget)+'</span>'+statusHtml(p)+'<small>店家資訊與食友心得 ↗</small></button></article>').join('')||'<div class="empty-state">沒有符合條件的店家。<br>試著放寬左側條件、清除搜尋，或重新選類型。<br>資料尚未確認的店，不會視為符合指定條件。</div>';
    document.querySelectorAll('.nav').forEach(b=>{b.disabled=state.busy||(b.dataset.page==='pick'&&chosenType===null)||(b.dataset.page==='wheel'&&!confirmedIds);});
  }
  function validTime() { return /^\d{2}:\d{2}$/.test(state.filters.from) && /^\d{2}:\d{2}$/.test(state.filters.to) && C.minutes(state.filters.to)>C.minutes(state.filters.from); }
  function kmText(p) { const km=C.distance(state.origin,p.location); return km===null?'距離未知':km.toFixed(2)+' km'; }
  function mapsUrl(p,directions=false) {
    if(p.demo||p.unavailable)return null;
    if(!directions&&p.mapsUrl)return p.mapsUrl;
    const location=p.location?p.location.lat+','+p.location.lng:p.name;
    const params=new URLSearchParams(directions?{api:'1',origin:state.origin.lat+','+state.origin.lng,destination:location,travelmode:'walking'}:{api:'1',query:location});
    return 'https://www.google.com/maps/'+(directions?'dir/':'search/')+'?'+params;
  }
  function statusHtml(p) {
    const s=C.opening(p,state.filters.from,state.filters.to);
    return '<span class="status-tag '+(s.lunch===null?'unknown':s.lunch?'':'closed')+'">'+e(s.reason)+'</span>';
  }
  function lockUI(busy) {
    state.busy=busy;
    document.querySelectorAll('main button, main input, main select, header button').forEach(el=>{el.disabled=busy;});
    document.body.classList.toggle('spinning',busy);
  }
  function renderWheel(places) {
    const n=places.length || 1, size=400, center=200, radius=199, step=360/n;
    let svg='<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">';
    if (n===1) svg+='<circle cx="200" cy="200" r="199" fill="#e0e4d4"/>';
    places.forEach((p,i)=>{
      const a=(i*step-90)*Math.PI/180,b=((i+1)*step-90)*Math.PI/180;
      if(n>1) svg+='<path d="M200 200 L'+(center+radius*Math.cos(a))+' '+(center+radius*Math.sin(a))+' A199 199 0 '+(step>180?1:0)+' 1 '+(center+radius*Math.cos(b))+' '+(center+radius*Math.sin(b))+' Z" fill="'+COLORS[i%COLORS.length]+'" stroke="#fffefa" stroke-width="1.5"/>';
      const mid=(i+.5)*step-90, label=p.name||'店家資訊待載入', clipped=label.length>8?label.slice(0,7)+'…':label;
      svg+='<g transform="rotate('+mid+' 200 200)"><text x="380" y="204" text-anchor="end" font-size="'+(n>12?11:13)+'">'+e(clipped)+'</text></g>';
    });
    if(!places.length) svg+='<text x="200" y="90" text-anchor="middle" font-size="16">等你選好午餐名單</text>';
    $('wheel-disc').innerHTML=svg+'</svg>';
    $('wheel-disc').style.transition='none';$('wheel-disc').style.transform='rotate(0deg)';state.rotation=0;
    $('wheel-disc').getBoundingClientRect();$('wheel-disc').style.transition='';
  }
  function render() {
    renderAccess();
    const incomplete=state.records.filter(p=>p.dataIssues?.length),unavailable=state.records.filter(p=>p.unavailable);
    $('data-status').hidden=!state.ready||!incomplete.length;$('data-status').textContent=incomplete.length+' 間店有資料待補'+(unavailable.length?'，其中 '+unavailable.length+' 間暫時無法抽選':'')+'。未確認的資料不會視為符合指定條件；點店家可查看。';
    const choices=stage==='wheel'?wheelPlaces():eligible(), count=state.selected.size;
    $('nav-count').textContent=state.records.length;
    $('filter-summary').innerHTML=validTime()?'已勾選 '+count+' 間，<strong>'+choices.length+'</strong> 間符合今天的條件。<br>至少 2 間符合條件才能抽選。':'用餐結束時間必須晚於開始時間。';
    $('spin-button').disabled=state.busy||!state.ready||!confirmedIds||choices.length<2||count>20||!validTime();
    $('chance-label').textContent=choices.length>=2?choices.length+' 間候選 · 每間 '+(100/choices.length).toFixed(1)+'% 機會':'至少選 2 間符合條件的店';
    if(!state.busy) renderWheel(choices);
    renderSaved();renderTypes();renderPick();
  }
  function renderSaved() {
    $('saved-count').textContent=state.records.length;
    $('selection-count').textContent='本次已勾選 '+state.selected.size+' / 20 間 · '+(state.mode==='local'?'記在這台裝置':'現有名單由管理者維護');
    const query=$('list-search').value.trim().toLowerCase();
    const list=state.records.filter(p=>(p.name||'店家資訊待載入').toLowerCase().includes(query));
    $('saved-list').innerHTML=list.map(p=>'<article class="saved-card '+(state.selected.has(p.id)?'selected':'')+'"><input type="checkbox" data-select="'+e(p.id)+'" aria-label="本次抽選 '+e(p.name||p.id)+'" '+(state.selected.has(p.id)?'checked':'')+' '+(state.busy||p.unavailable?'disabled':'')+'><span class="food-icon">'+(ICONS[p.category]||'🍽')+'</span><button class="card-main" data-detail="'+e(p.id)+'"><strong>'+e(p.name||'店家資訊待載入')+'</strong><small>'+e(categoryName(p.category))+' · '+e(Catalog.diets[p.diet]||Catalog.diets.unknown)+' · '+kmText(p)+' · '+(p.budget==null?'預算未知':'NT$ '+p.budget)+'</small>'+statusHtml(p)+'</button></article>').join('')||'<div class="empty-state">'+(query?'沒有符合搜尋的店家。':'還沒有店家，從右側地圖找一間吧！')+'</div>';
  }
  function page(name) {
    if(state.busy||!state.ready) return;
    if(!['type','pick','wheel','map'].includes(name))return;
    if(name==='pick'&&chosenType===null)return;
    if(name==='wheel'&&!confirmedIds)return;
    if(name==='pick')confirmedIds=null;
    stage=name;document.body.dataset.stage=name;
    if(name!=='map'){originPicking=false;$('origin-pick-panel').hidden=true;}
    ['type','pick','wheel','map'].forEach(p=>$(p+'-page').hidden=name!==p);
    document.querySelectorAll('.nav').forEach(el=>{const active=el.dataset.page===name;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    if(name==='map'&&mapView)requestAnimationFrame(()=>mapView.invalidateSize());
    render();const heading=$(name==='type'?'type-title':name==='pick'?'pick-title':name==='wheel'?'wheel-page-title':'map-page');heading?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
  }
  function setChoice(group,key,value) { document.querySelectorAll(group+' button').forEach(b=>{const active=b.dataset[key]===value;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}); }
  function resetFilters() {
    state.filters={...DEFAULT_FILTERS};setChoice('#walk-choices','walk','any');setChoice('#weather-choices','weather','any');setChoice('#diet-choices','diet','any');
    $('budget-filter').value='any';$('lunch-from').value='12:00';$('lunch-to').value='13:00';$('open-filter').checked=false;$('repeat-filter').checked=false;render();loadWeather();
  }
  async function loadWeather() {
    const request=++weatherRequest;
    state.weather={rain:null};$('weather-status').textContent='☁ 正在讀取午餐天氣…';
    if(!validTime()) {$('weather-status').textContent='請設定有效用餐時段';return;}
    try {
      const params=new URLSearchParams({latitude:String(state.origin.lat),longitude:String(state.origin.lng),hourly:'precipitation_probability',timezone:'Asia/Taipei',forecast_days:'1'});
      const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),12000);
      let response;try {response=await fetch('https://api.open-meteo.com/v1/forecast?'+params,{signal:controller.signal});} finally {clearTimeout(timeout);}
      if(!response.ok) throw Error();
      const data=await response.json(), day=C.taipeiDay();
      // Open-Meteo accumulated precipitation probabilities describe the preceding hour.
      const probability=C.rainProbability(data,day,state.filters.from,state.filters.to);
      if(probability===null) throw Error();
      if(request!==weatherRequest)return;
      state.weather={rain:probability>=50,probability,day,from:state.filters.from,to:state.filters.to};
      $('weather-status').textContent=(probability>=50?'☂':'☀')+' 午餐降雨機率 '+probability+'% · Open-Meteo';
    } catch {if(request!==weatherRequest)return;state.weather={rain:null};$('weather-status').textContent='☁ 天氣暫時讀取不到，可手選晴／雨';}
    if(!state.busy)render();
  }
  function loadMaps(config={}) {
    if(!/^https?:$/.test(location.protocol)){
      $('map-placeholder').querySelector('p').textContent='目前顯示示意地圖。請從正式網站開啟，或按下方按鈕填寫店家位置。';return;
    }
    if(!window.L){message('地圖暫時打不開，可以先用「新增店家」填寫店家資訊。');return;}
    mapView=L.map('google-map',{zoomControl:false}).setView([state.origin.lat,state.origin.lng],16);
    const tiles=L.tileLayer(config.tileUrl||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,updateWhenIdle:true,keepBuffer:1,referrerPolicy:'strict-origin-when-cross-origin',attribution:config.tileAttribution?e(config.tileAttribution):'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(mapView);
    let warned=false;tiles.on('tileerror',()=>{if(!warned){warned=true;message('底圖暫時無法載入，仍可使用名單與新增按鈕。');}});
    L.control.zoom({position:'bottomleft'}).addTo(mapView);markerLayer=L.layerGroup().addTo(mapView);
    const originLabel=document.createElement('span');originLabel.textContent=state.origin.name||defaultOrigin.name;
    originMarker=L.circleMarker([state.origin.lat,state.origin.lng],{radius:8,color:'#253f32',fillColor:'#e66b45',fillOpacity:1}).addTo(mapView).bindTooltip(originLabel);
    originMarker.on('click',()=>{if(originPicking)openOrigin(state.origin);});
    mapView.on('click',event=>{if(originPicking)openOrigin(event.latlng);else if(canAdd())manualForm(event.latlng);});$('map-placeholder').hidden=true;
  }
  async function fetchPlace(record) {return record.demo?record:Catalog.hydrate(record);}
  async function readCatalog(){
    const payload=await rpc('listCandidates','json');
    let rows;try{rows=typeof payload==='string'?JSON.parse(payload):payload;}catch{throw Error('收到的名單無法讀取，請重新整理後再試。');}
    if(!Array.isArray(rows))throw Error('名單沒有完整載入，請再試一次。');
    return hydrateCatalog(rows);
  }
  async function refreshDetails(){
    if(state.mode!=='live')return;
    state.records=await readCatalog();
    state.selected=new Set([...state.selected].filter(id=>state.records.some(p=>p.id===id&&!p.unavailable)));
  }
  function drawMarkers(places){
    if(!markerLayer)return;markerLayer.clearLayers();
    places.filter(p=>p.location).forEach(p=>{
      const icon=L.divIcon({className:'food-map-pin',html:ICONS[p.category]||'🍽',iconSize:[38,38],iconAnchor:[19,38]});
      const label=document.createElement('span');label.textContent=p.name;
      L.marker([p.location.lat,p.location.lng],{icon,title:p.name}).addTo(markerLayer).bindTooltip(label).on('click',()=>{if(originPicking)openOrigin(p.location);else openDetail(p.id,p);});
    });
  }
  async function refreshCatalog() {
    if(state.busy)return;lockUI(true);$('pick-page').setAttribute('aria-busy','true');$('refresh-picks').textContent='正在更新名單…';$('refresh-list').textContent='正在更新名單…';
    try {
      if(state.mode==='live')state.records=await readCatalog();
      else state.records=hydrateCatalog(localSourceRecords);
      state.selected=new Set([...state.selected].filter(id=>state.records.some(p=>p.id===id&&!p.unavailable)));
      saveLocal();drawMarkers(state.records);message('已更新名單；營業資訊依自行維護的營業時間推估。');
    } catch(err){message(err.message);}finally{lockUI(false);$('pick-page').removeAttribute('aria-busy');$('refresh-picks').textContent='重新整理';$('refresh-list').textContent='重新整理';render();}
  }
  async function searchMap(query) {
    const places=state.records.filter(p=>(p.name+' '+p.address+' '+p.category).toLowerCase().includes(query.toLowerCase()));
    showSearchResults(places);drawMarkers(places);
  }
  let searchPlaces=[];
  function showSearchResults(places) {
    searchPlaces=places;$('search-results').hidden=false;
    $('search-results').innerHTML='<div class="panel-heading"><span class="field-note">'+(state.mode==='local'?'我的名單搜尋結果':'現有名單搜尋結果')+'</span><button class="text-button" id="close-search">收起</button></div>'+ (places.map(p=>'<button class="search-result" data-search-id="'+e(p.id)+'">'+e(p.name)+'<small>'+e(p.address||'地址未提供')+'</small></button>').join('')||'<p class="field-note">名單還沒有這間店。可先到 Google Maps 查看，再按「新增店家」填入。</p>');
  }
  async function openDetail(id, supplied) {
    if(state.busy)return;
    reviewUI.dispose();
    const request=++detailRequest;state.detail=null;
    $('detail-content').innerHTML='<h2 id="detail-title">正在讀取店家資訊…</h2>';
    if(!$('detail-dialog').open)$('detail-dialog').showModal();
    try {
      let p=state.records.find(p=>p.id===id)||supplied||{id,category:'其他',budget:null,covered:'unknown'};
      p=await fetchPlace(p);
      if(request!==detailRequest||!$('detail-dialog').open)return;
      state.detail=p;
      const existing=state.records.find(r=>r.id===id);if(existing)Object.assign(existing,p);
      if(mapView&&p.location)mapView.panTo([p.location.lat,p.location.lng]);
      renderDetail(p,Boolean(existing));
    } catch(err){if(request===detailRequest)$('detail-content').innerHTML='<h2 id="detail-title">暫時無法取得店家資訊</h2><p>'+e(err.message)+'</p><p>請稍後重新點選店家。</p>';}
  }
  function phoneHtml(p) {const phone=String(p.phone||'').replace(/[^+\d]/g,'');return phone?'<a class="secondary" href="tel:'+phone+'">撥打 '+e(p.phone)+'</a>':'';}
  function renderDetail(p,existing) {
    const status=C.opening(p,state.filters.from,state.filters.to), category=p.category||'其他';
    let warning='';
    if(status.today===false) warning=(p.demo?'該店家今日沒營業。':'依填寫的營業時間，該店家今日沒營業；臨時調整請另行確認。')+(p.phone?'實際營業狀況請撥電話確認。':'');
    else if(status.today===null)warning='店家未提供足夠營業時間，今日營業狀況待確認。';
    else if(!status.lunch)warning='今天有營業，但未涵蓋完整用餐時段 '+state.filters.from+'–'+state.filters.to+'。';
    const mapLink=p.unavailable?null:mapsUrl(p),issues=(p.dataIssues||[]).map(key=>Catalog.issueLabels[key]).filter(Boolean);
    const issueHtml=issues.length?'<div class="notice"><strong>店家資料待補</strong><p>'+issues.map(e).join('、')+'</p>'+(p.unavailable?'<p>必要資料完整後，就能加入抽選。</p>':'')+'</div>':'';
    $('detail-content').innerHTML='<p class="eyebrow">'+(p.demo?'DEMO · 虛構示範店家':'OUR SHARED FOOD LIST')+'</p><div class="detail-hero"><span class="food-icon">'+(ICONS[category]||'🍽')+'</span><div><h2 id="detail-title">'+e(p.name)+'</h2><p>直線 '+kmText(p)+'</p></div></div><p>'+e(p.address||'地址未提供')+'</p>'+statusHtml(p)+issueHtml+'<p class="diet-detail">'+e(Catalog.diets[p.diet]||Catalog.diets.unknown)+(p.covered==='yes'&&!C.coveredFrom(p,state.origin)?' · 此出發點的避雨路線待確認':'')+'</p>'+(warning?'<div class="notice">'+e(warning)+(p.phone?'<br>'+phoneHtml(p):'')+'</div>':'')+(p.demo?'':'<p class="field-note">以上為自行填寫的營業時間，臨時營業異動請致電確認。</p>')+'<details><summary class="field-note">查看營業時間</summary><p>'+p.hoursText.map(e).join('<br>')+'</p></details>'+(mapLink?'<p><a target="_blank" rel="noopener" href="'+e(mapLink)+'">在 Google Maps 查看 ↗</a></p>':'')+
      (existing?'<div class="notice">已在目前名單。可用勾選框調整本次抽選，不會刪除店家。</div><button class="primary" id="detail-select" '+(p.unavailable?'disabled':'')+'>'+(state.selected.has(p.id)?'退出本次抽選':'加入本次抽選')+'</button>':'<form id="add-form"><div class="detail-form"><label>店家類型（自行標記）<select id="add-category">'+Catalog.categories.map(c=>'<option'+(c===category?' selected':'')+'>'+c+'</option>').join('')+'</select></label><label>葷／素（自行確認）<select id="add-diet">'+Object.entries(Catalog.diets).map(([value,label])=>'<option value="'+value+'"'+(value===(p.diet||'unknown')?' selected':'')+'>'+e(label)+'</option>').join('')+'</select></label><label>每人預算 NT$（選填）<input id="add-budget" type="number" min="1" max="10000" step="1" placeholder="例如 180" value="'+(p.budget??'')+'"></label><label class="wide">從 '+e(state.origin.name||defaultOrigin.name)+' 出發，全程可避雨？<select id="add-covered"><option value="unknown">尚未確認</option><option value="yes"'+(p.covered==='yes'?' selected':'')+'>是，已確認全程有遮蔽</option><option value="no"'+(p.covered==='no'?' selected':'')+'>否，需要走露天路段</option></select></label></div><p class="field-note">'+(state.mode==='local'?'這些資料只儲存在這台裝置，不會上傳。':'這些資料會加入現有名單，供大家抽選。')+'營業中與否仍由抽選條件決定。</p><div class="detail-actions"><button type="submit" class="primary">'+(status.today===false?'已知今日休息，仍儲存店家':(state.mode==='local'?'加入我的口袋名單 ＋':'加入共用口袋名單 ＋'))+'</button></div></form>');
    if(existing&&state.mode==='live'&&!p.unavailable){
      const host=document.createElement('section');host.className='restaurant-reviews';host.setAttribute('aria-label','品項評論與評分');$('detail-content').append(host);reviewUI.mount(host,p.id);
    }
  }
  function manualForm(position){
    if(state.busy)return;
    if(!canAdd()){message('現有名單僅限管理者新增，請先登入管理員。');return;}
    const lat=position?.lat??'',lng=position?.lng??'';
    const days=['日','一','二','三','四','五','六'];
    $('detail-content').innerHTML='<p class="eyebrow">ADD A GOOD PLACE</p><h2 id="detail-title">新增一間口袋店家</h2><p>'+(state.mode==='local'?'這間店只會加入你的我的名單。':'這間店會加入大家使用的現有名單。')+'不會自動讀取 Google 店家資料。</p><form id="manual-form"><div class="detail-form"><label class="wide">店名<input id="manual-name" maxlength="100" required></label><label class="wide">地址（選填）<input id="manual-address" maxlength="250"></label><label>緯度<input id="manual-lat" type="number" step="any" min="-90" max="90" value="'+lat+'" required></label><label>經度<input id="manual-lng" type="number" step="any" min="-180" max="180" value="'+lng+'" required></label><label class="wide">電話（選填）<input id="manual-phone" type="tel" maxlength="40"></label><label class="wide">Google Maps 分享連結（選填）<input id="manual-url" type="url" maxlength="1000" placeholder="https://maps.app.goo.gl/…"></label></div><p class="field-note">可以點地圖位置自動帶入座標；或填入你確認的位置。分享連結只用於開啟 Google Maps，不會自動解析店家資料。</p><details class="hours-editor"><summary>填寫每週營業時間（選填）</summary><p class="field-note">未知就留白；休息日請明確選休息。每日可填兩段，涵蓋午休／晚餐；關門時間較早表示跨到翌日。</p>'+days.map((day,i)=>'<fieldset class="hours-day"><legend>星期'+day+'</legend><label>狀態<select id="day-'+i+'-status" aria-label="星期'+day+'狀態"><option value="unknown">尚未確認</option><option value="closed">休息</option><option value="open">有營業</option></select></label><div class="hours-times"><input type="time" id="day-'+i+'-from" aria-label="星期'+day+'第一段開始"><span>至</span><input type="time" id="day-'+i+'-to" aria-label="星期'+day+'第一段結束"><input type="time" id="day-'+i+'-from2" aria-label="星期'+day+'第二段開始"><span>至</span><input type="time" id="day-'+i+'-to2" aria-label="星期'+day+'第二段結束"></div></fieldset>').join('')+'</details><button class="primary" type="submit">下一步：確認店家資訊</button></form>';
    if(!$('detail-dialog').open)$('detail-dialog').showModal();
  }
  function previewManual(){
    if(!$('manual-form').reportValidity())return;
    try{
      const weeklyHours=Array.from({length:7},(_,i)=>{
        const status=$('day-'+i+'-status').value,spans=[];
        if(status==='open'){
          spans.push({from:$('day-'+i+'-from').value,to:$('day-'+i+'-to').value});
          if($('day-'+i+'-from2').value||$('day-'+i+'-to2').value)spans.push({from:$('day-'+i+'-from2').value,to:$('day-'+i+'-to2').value});
        }
        return {status,spans};
      });
      const input={id:'local-'+crypto.randomUUID(),name:$('manual-name').value,address:$('manual-address').value,phone:$('manual-phone').value,mapsUrl:$('manual-url').value,location:{lat:Number($('manual-lat').value),lng:Number($('manual-lng').value)},category:'其他',budget:null,covered:'unknown',weeklyHours};
      const p=Catalog.hydrate({...input,...Catalog.validate(input)});
      state.detail=p;renderDetail(p,false);
    }catch(err){message(err.message);}
  }
  function toggleSelection(id, checked) {
    if(checked&&!state.records.some(p=>p.id===id&&!p.unavailable)){message('這間店的必要資料尚未完整，暫時無法抽選。');return false;}
    if(checked&&state.selected.size>=20){message('本次最多選 20 間；先取消勾選其他店家。');renderSaved();renderPick();return false;}
    if(checked)state.selected.add(id);else state.selected.delete(id);
    saveLocal();render();return true;
  }
  async function addCurrent() {
    const p=state.detail;if(!p||state.busy)return;
    if(!canAdd()){message('請關閉視窗並重新登入管理員，再新增店家。');return;}
    const form=$('add-form');if(!form.reportValidity())return;
    const record={...p,category:$('add-category').value,diet:$('add-diet').value,budget:$('add-budget').value===''?null:Number($('add-budget').value),covered:$('add-covered').value,coveredOrigin:$('add-covered').value==='unknown'?null:{lat:state.origin.lat,lng:state.origin.lng}};
    const submit=form.querySelector('button[type=submit]');submit.disabled=true;submit.textContent=state.mode==='local'?'正在存入這台裝置…':'正在存入現有名單…';
    state.busy=true;
    try {
      const validated=Catalog.validate(record);
      let result;
      if(state.mode==='live') result=await rpc('addCandidate',record,adminSession.token);
      else {const duplicate=state.records.find(r=>!r.demo&&Catalog.fingerprint(r)===Catalog.fingerprint(record));result={record:duplicate||{...record,...validated},duplicate:Boolean(duplicate)};}
      const saved=p.demo?{...p,...result.record}:Catalog.hydrate(result.record);
      if(!state.records.some(r=>r.id===saved.id)){state.records.push(saved);if(state.mode==='local')localSourceRecords.push(result.record);}
      if(state.selected.size<20&&inType(saved))state.selected.add(saved.id);
      saveLocal();$('detail-dialog').close();drawMarkers(state.records);
      message(result.duplicate?'這間店已被加入，已同步既有資料。':state.selected.has(saved.id)?'已加入'+(state.mode==='local'?'私人':'共用')+'名單與本次抽選。':'已保存到名單。本次已滿 20 間，可稍後勾選。');
    } catch(err){if(err.code==='AUTH_REQUIRED')clearAdmin();message(err.message);submit.disabled=false;submit.textContent='再試一次';}
    finally {state.busy=false;render();}
  }
  function setSpinLabel(title='開吃!',caption='點我抽選 ↗'){
    $('spin-button').querySelector(':scope > span').textContent=title;
    $('spin-button').querySelector(':scope > small').textContent=caption;
  }
  async function spin() {
    if(state.busy||$('spin-button').disabled)return;
    lockUI(true);setSpinLabel('確認中','更新營業資訊');
    try {
      if(dateKey!==C.taipeiDay()){dateKey=C.taipeiDay();if(state.mode==='demo'){state.records=state.records.map(p=>p.demo?(demoPlaces().find(d=>d.id===p.id)||p):Catalog.hydrate(p));}}
      if(state.mode==='live')await refreshDetails(selectedPlaces());
      if(state.filters.weather==='auto')await loadWeather();
      const choices=wheelPlaces();
      if(!validTime()||choices.length<2||choices.length>20)throw Error('更新後不足 2 間符合條件，請調整條件或增加勾選店家。');
      renderWheel(choices);
      const index=C.randomIndex(choices.length), winner=choices[index], target=C.rotation(index,choices.length,state.rotation);
      setSpinLabel('轉呀轉','好吃的快來了');$('wheel-title').textContent='美味，正在靠近。';
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      await new Promise(resolve=>{requestAnimationFrame(()=>{$('wheel-disc').style.transform='rotate('+target+'deg)';setTimeout(resolve,reduced?120:2500);});});
      state.rotation=target;lockUI(false);
      setSpinLabel();$('wheel-title').textContent='讓選擇，變成期待。';
      showResult(winner,choices.length);
    } catch(err){lockUI(false);setSpinLabel();message(err.message);render();}
  }
  let resultPlace=null;
  function showResult(p,count) {
    resultPlace=p;const link=mapsUrl(p,true);
    $('result-content').innerHTML='<h3>'+e(p.name)+'</h3><p>'+e(categoryName(p.category))+' · '+(p.budget==null?'預算未標記':'NT$ '+p.budget)+' · 直線 '+kmText(p)+'</p><p>'+e(p.address||'地址未提供')+'</p><p class="field-note">'+count+' 間店每間機會相同'+(p.demo?' · 虛構示範結果':' · 營業時段由名單維護，臨時異動請致電確認')+'</p><div class="result-actions"><button id="confirm-lunch" class="primary">今天就吃這家 ✓</button>'+(link?'<a class="secondary" target="_blank" rel="noopener" href="'+e(link)+'">步行導航 ↗</a>':'')+'</div>'+phoneHtml(p)+'<button id="spin-again" class="text-button">還想轉一次</button>';
    $('result-dialog').showModal();
  }
  function enterSource(mode){
    if(mode!=='live'){message('「自己建立」正在調整，請先使用現有名單。');return;}
    if(state.busy)return;
    const request=++sourceRequest;sourceLoading=true;lockUI(true);state.ready=false;clearAdmin();
    const trace=(step,extra={})=>console.info('[Lunch Club 6.2.0] shared entry', {request,step,...extra});
    const current=()=>request===sourceRequest&&sourceLoading;
    $('source-page').setAttribute('aria-busy','true');$('cancel-source').hidden=false;$('cancel-source').disabled=false;
    $('source-status').textContent=mode==='live'?'正在打開現有名單，請稍候…':'正在打開你的名單…';
    function unlock(){
      clearTimeout(sourceTimer);sourceTimer=null;sourceLoading=false;
      $('source-page').removeAttribute('aria-busy');$('cancel-source').hidden=true;lockUI(false);
    }
    function failed(error){
      if(!current())return;
      const raw=typeof error?.message==='string'?error.message:typeof error==='string'?error:'';
      const messageText=!raw?'名單暫時無法開啟，請再試一次。':/SPREADSHEET_ID|表頭|JSON|Unexpected|TypeError|ReferenceError|Script function|伺服器函式|Authorization|授權|permission/i.test(raw)?'名單暫時無法開啟，請聯絡名單管理者確認設定後再試。':raw.replace(/^(?:Error: |Exception: )/,'');
      trace('failed',{message:messageText});
      state.ready=false;state.mode='loading';state.records=[];state.selected=new Set();
      $('source-page').hidden=false;$('source-workspace').hidden=true;$('main-nav').hidden=true;
      $('source-status').textContent=messageText;
      unlock();$('choose-shared').focus();
    }
    function received(payload){
      if(!current())return;
      trace('received',{kind:typeof payload});
      $('source-status').textContent='名單已收到，正在整理店家…';
      try{
        let config={},records;
        if(mode==='live'){
          // Accept the old object response while deployments are being updated.
          let data;try{data=typeof payload==='string'?JSON.parse(payload):payload;}catch{throw Error('收到的名單無法讀取，請重新開啟網站後再試。');}
          if(!data||!data.config||!Array.isArray(data.records))throw Error('名單沒有完整載入，請再試一次。');
          config=data.config;records=hydrateCatalog(data.records);
          try{defaultOrigin=C.validateOrigin({...config.origin,name:config.originName||'板橋車站・北二門'});defaultOriginVerified=config.originVerified===true;}catch{defaultOriginVerified=false;}
          adminConfigured=config.adminConfigured===true;accountUI.configure(config.googleLoginConfigured===true);
        }else{
          const personal=getLocal('local');localSourceRecords=personal.localRecords||[];records=hydrateCatalog(localSourceRecords);
        }
        trace('prepared',{count:records.length});
        const customOrigin=readOrigin();state.origin=customOrigin||{...defaultOrigin};originCustom=Boolean(customOrigin);
        state.records=records;state.mode=mode;state.filters={...DEFAULT_FILTERS};state.detail=null;resultPlace=null;
        const local=getLocal(mode);state.lastId=typeof local.lastId==='string'?local.lastId:null;
        chosenType=null;confirmedIds=null;state.selected=new Set();state.ready=true;
        $('list-search').value='';$('map-query').value='';$('search-results').hidden=true;searchPlaces=[];
        $('source-status').textContent='正在顯示今天的午餐名單…';
        $('source-page').hidden=true;$('source-workspace').hidden=false;$('main-nav').hidden=false;
        try{if(!mapView)loadMaps(config);updateOriginView();drawMarkers(records);}
        catch{try{mapView?.remove();}catch{}mapView=null;originMarker=null;markerLayer=null;$('map-placeholder').hidden=false;message('地圖暫時無法開啟，仍可從口袋名單挑選午餐。');}
        saveLocal();lockUI(false);resetFilters();page('type');
        unlock();trace('visible',{count:records.length});
      }catch(error){failed(error);}
    }
    trace('request');
    // Keep this watchdog until the screen is ready, not just until Google replies.
    clearTimeout(sourceTimer);sourceTimer=setTimeout(()=>{if(current()){trace('timeout');failed(Error('等待時間較久，請再試一次。'));}},20000);
    try{
      if(mode==='live'){
        if(!window.google?.script?.run)throw Error('請從正式網站開啟現有名單，或聯絡名單管理者確認網址。');
        // The Google callback directly completes navigation; no Promise wrapper in this path.
        google.script.run.withSuccessHandler(received).withFailureHandler(failed).getSharedHome('json');
      }else received(null);
    }catch(error){failed(error);}
  }
  function switchSource(){
    if(state.busy&&!sourceLoading)return;
    sourceRequest++;clearTimeout(sourceTimer);sourceTimer=null;sourceLoading=false;saveLocal();const token=adminSession?.token;clearAdmin();
    if(token)rpc('adminLogout',token).catch(()=>{});
    weatherRequest++;originPicking=false;$('origin-pick-panel').hidden=true;state.ready=false;state.mode='loading';state.records=[];state.selected=new Set();
    document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());reviewUI.dispose();state.detail=null;
    $('source-workspace').hidden=true;$('main-nav').hidden=true;$('source-page').hidden=false;
    $('source-page').removeAttribute('aria-busy');$('cancel-source').hidden=true;
    chosenType=null;confirmedIds=null;delete document.body.dataset.stage;
    $('source-status').textContent='選好類型，開始今天的午餐冒險。';lockUI(false);render();$('choose-shared').focus();
  }
  function boot(){
    $('date-stamp').innerHTML=new Intl.DateTimeFormat('en',{timeZone:'Asia/Taipei',month:'short',day:'2-digit'}).format(new Date()).toUpperCase()+'<br>LUNCH TIME';
    render();
    if(window.google?.script?.run)enterSource('live');
    else $('source-status').textContent='請從正式網站開啟現有名單。';
  }

  document.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.type)chooseType(b.dataset.type);
    if(b.dataset.page)page(b.dataset.page);
    if(b.hasAttribute('data-close'))b.closest('dialog').close();
    if(b.dataset.walk&&!state.busy){state.filters.walk=b.dataset.walk;setChoice('#walk-choices','walk',state.filters.walk);render();}
    if(b.dataset.weather&&!state.busy){state.filters.weather=b.dataset.weather;setChoice('#weather-choices','weather',state.filters.weather);render();}
    if(b.dataset.diet&&!state.busy){state.filters.diet=b.dataset.diet;setChoice('#diet-choices','diet',state.filters.diet);render();}
    if(b.dataset.detail)openDetail(b.dataset.detail);
    if(b.dataset.searchId){$('search-results').hidden=true;openDetail(b.dataset.searchId,searchPlaces.find(p=>p.id===b.dataset.searchId));}
    if(b.dataset.view){document.querySelector('.map-layout').dataset.view=b.dataset.view;document.querySelectorAll('.mobile-view button').forEach(x=>x.classList.toggle('active',x===b));if(mapView)requestAnimationFrame(()=>mapView.invalidateSize());}
    if(b.id==='close-search')$('search-results').hidden=true;
    if(b.id==='detail-select'&&state.detail){toggleSelection(state.detail.id,!state.selected.has(state.detail.id));b.textContent=state.selected.has(state.detail.id)?'退出本次抽選':'加入本次抽選';}
    if(b.id==='confirm-lunch'&&resultPlace){state.lastId=resultPlace.id;saveLocal();$('result-dialog').close();message('記下來了，祝你有個好吃的午餐！');render();}
    if(b.id==='spin-again'){$('result-dialog').close();render();spin();}
  });
  document.addEventListener('change',event=>{if(event.target.dataset.select&&!state.busy)toggleSelection(event.target.dataset.select,event.target.checked);});
  [['budget-filter','budget'],['lunch-from','from'],['lunch-to','to'],['open-filter','open'],['repeat-filter','noRepeat']].forEach(([id,key])=>$(id).addEventListener('change',()=>{state.filters[key]=$(id).type==='checkbox'?$(id).checked:$(id).value;render();if(key==='from'||key==='to')loadWeather();}));
  $('pick-search').addEventListener('input',renderPick);
  $('toggle-filters').addEventListener('click',()=>{const button=$('toggle-filters'),expanded=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(expanded));button.textContent='篩選條件 · '+(expanded?'收起':'展開');$('pick-filters').classList.toggle('expanded',expanded);});
  $('confirm-selection').addEventListener('click',confirmSelection);
  $('refresh-picks').addEventListener('click',refreshCatalog);
  $('clear-selection').addEventListener('click',()=>{if(state.busy)return;state.selected.clear();saveLocal();render();});
  $('select-visible').addEventListener('click',()=>{if(state.busy)return;state.selected=new Set(visiblePlaces().slice(0,20).map(p=>p.id));saveLocal();render();});
  $('list-search').addEventListener('input',renderSaved);$('reset-filters').addEventListener('click',resetFilters);$('spin-button').addEventListener('click',spin);$('refresh-list').addEventListener('click',refreshCatalog);
  $('map-query').addEventListener('input',()=>{$('google-search-link').href='https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:$('map-query').value||'板橋車站 餐廳'});});
  $('map-search-form').addEventListener('submit',event=>{event.preventDefault();if(!state.busy)searchMap($('map-query').value.trim());});
  $('detail-content').addEventListener('submit',event=>{event.preventDefault();if(event.target.id==='add-form')addCurrent();if(event.target.id==='manual-form')previewManual();});
  $('demo-explore').addEventListener('click',()=>manualForm());$('manual-add-button').addEventListener('click',()=>manualForm());
  $('choose-shared').addEventListener('click',()=>enterSource('live'));
  $('brand-home').addEventListener('click',event=>{event.preventDefault();switchSource();});$('cancel-source').addEventListener('click',switchSource);$('account-button').addEventListener('click',()=>accountUI.open());
  $('switch-source').addEventListener('click',switchSource);$('admin-button').addEventListener('click',adminAction);$('admin-form').addEventListener('submit',loginAdmin);
  $('admin-dialog').addEventListener('close',()=>{$('admin-passphrase').value='';});
  $('map-home').addEventListener('click',()=>{if(mapView){mapView.setView([state.origin.lat,state.origin.lng],16);}else message('示意地圖：正式版會回到目前設定的出發點。');});
  const originPanel=document.createElement('div');originPanel.id='origin-pick-panel';originPanel.className='origin-pick-panel';originPanel.hidden=true;originPanel.innerHTML='<strong>點一下地圖，選擇你的出發點。</strong><p>選好後會開啟確認視窗，店家位置不會更動。</p><button type="button" class="secondary" id="origin-pick-cancel">取消選點</button>';document.querySelector('.map-panel').append(originPanel);
  $('change-origin').addEventListener('click',()=>openOrigin());$('origin-pick-map').addEventListener('click',chooseOriginOnMap);$('origin-geolocate').addEventListener('click',locateOrigin);
  $('origin-pick-cancel').addEventListener('click',()=>{originPicking=false;originPanel.hidden=true;});
  $('origin-form').addEventListener('submit',event=>{event.preventDefault();if(state.busy||!$('origin-form').reportValidity())return;try{const origin=C.validateOrigin({name:$('origin-input-name').value,lat:Number($('origin-lat').value),lng:Number($('origin-lng').value)});$('origin-dialog').close();applyOrigin(origin);}catch(err){$('origin-feedback').textContent=err.message;}});
  $('origin-reset').addEventListener('click',()=>{if(state.busy)return;$('origin-dialog').close();applyOrigin(defaultOrigin,false);});
  $('origin-dialog').addEventListener('close',()=>{originRequest++;$('origin-geolocate').disabled=false;});
  ['about-button','privacy-button'].forEach(id=>$(id).addEventListener('click',()=>$('about-dialog').showModal()));
  $('detail-dialog').addEventListener('close',()=>{detailRequest++;reviewUI.dispose();});
  $('result-dialog').addEventListener('close',()=>{if(!state.busy)render();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.ready&&!state.busy&&dateKey!==C.taipeiDay()){dateKey=C.taipeiDay();render();loadWeather();message('已跨日，將依新日期的營業時間重新篩選。');}});
  boot();
})();

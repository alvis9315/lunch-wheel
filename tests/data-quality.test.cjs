const assert=require('node:assert/strict'),crypto=require('node:crypto'),Catalog=require('../src/catalog.js'),C=require('../src/core.js'),fixture=require('./server-fixture.cjs');
const id=()=>crypto.randomUUID(),origin={lat:25.0143,lng:121.4638},hours=Array.from({length:7},()=>({status:'open',spans:[{from:'10:00',to:'21:00'}]}));
const good={id:id(),name:'完整店家',address:'板橋',location:origin,phone:'02-12345678',category:'台式',diet:'both',budget:150,covered:'yes',coveredOrigin:origin,mapsUrl:'https://maps.app.goo.gl/example',weeklyHours:hours};
const filters={walk:'any',weather:'any',budget:'any',category:'all',diet:'any',rating:'any',open:false,noRepeat:false,from:'12:00',to:'13:00'},context={origin,weather:{rain:false},now:new Date('2026-09-15T04:00Z')};
let cases=0;
// Every restaurant property, including corrupt nested data, must be safe to read and render.
for(const field of Object.keys(good))for(const value of [undefined,null,'',' ',false,[],{}, {toString:null},'broken',NaN]){
 const read=Catalog.hydrate({...good,[field]:value});assert.doesNotThrow(()=>C.reasons(read,filters,context));assert.equal(read.weeklyHours.length,7);assert(Array.isArray(read.dataIssues));assert(!JSON.stringify(read).includes('NaN'));cases++;
}
for(const value of [undefined,null,false,[],{},'broken']){const r=Catalog.hydrate(value);assert(r.unavailable);assert.equal(r.location,null);cases++;}
const bare=Catalog.hydrate({id:id(),name:'只有基本資料',location:origin});assert(!bare.unavailable);assert.equal(C.reasons(bare,filters,context).length,0);
for(const override of [{budget:'150'},{diet:'vegetarian'},{category:'其他'},{weather:'rain'},{open:true}])assert(C.reasons(bare,{...filters,...override},context).length>0);
for(const location of [{lat:'',lng:121},{lat:null,lng:null},{lat:91,lng:121},{lat:false,lng:121},null]){const r=Catalog.hydrate({...good,location});assert.equal(r.location,null);assert(r.unavailable);assert(C.reasons(r,filters,context).length);}
assert.deepEqual(Catalog.read({...good,location:{lat:'25.0143',lng:'121.4638'}}).location,origin);
for(const weeklyHours of ['{bad json',null,{},[],[...hours,null]])assert.equal(C.opening(Catalog.hydrate({...good,weeklyHours}),'12:00','13:00',context.now).lunch,null);
const partial=structuredClone(hours);partial[2]={status:'open',spans:[{from:'25:00',to:'26:00'}]};const partialRead=Catalog.read({...good,weeklyHours:partial});assert.equal(partialRead.weeklyHours[2].status,'unknown');assert.equal(partialRead.weeklyHours[1].status,'open');
const harmful=Catalog.hydrate({...good,mapsUrl:'javascript:alert(1)',phone:'<script>2</script>',diet:{toString:null}});assert.equal(harmful.mapsUrl,'');assert.equal(harmful.phone,'');assert.equal(harmful.diet,'unknown');
for(const phone of ['---','+++','()']){assert.equal(Catalog.read({...good,phone}).phone,'');assert.throws(()=>Catalog.validate({...good,phone}));}
const forecast=values=>({hourly:{time:['2026-09-15T13:00','2026-09-15T14:00'],precipitation_probability:values}});
assert.equal(C.rainProbability(forecast([0,80]),'2026-09-15','12:30','13:30'),80);
for(const values of [[],[0],[0,null],[0,-1],[0,101],[0,'80']])assert.equal(C.rainProbability(forecast(values),'2026-09-15','12:30','13:30'),null);
assert.equal(C.rainProbability(null,'2026-09-15','12:00','13:00'),null);
const duplicate=Catalog.collection([good,{...good,name:'同編號'}, {name:'缺編號',location:origin},null]);assert(duplicate.every(r=>r.unavailable));assert.equal(new Set(duplicate.map(r=>r.id)).size,4);
// Missing optional inputs get unknown defaults; provided invalid inputs remain rejected on writes.
assert.equal(Catalog.validate({name:'新增',location:origin}).weeklyHours.length,7);
for(const bad of [{name:''},{location:{lat:'',lng:''}},{budget:0},{budget:false},{diet:'vegan'},{mapsUrl:'javascript:bad'},{weeklyHours:[]}])assert.throws(()=>Catalog.validate({...good,...bad}));
const f=fixture(),admin=f.box.adminLogin(f.props.get('ADMIN_PASSPHRASE')).token;f.box.addCandidate(good,admin);const rows=f.data;
const row=rows[1];row[5]='bad phone';row[7]='oops';row[9]='{bad';row[13]='{bad';rows.push([...row]);rows[2][0]=id();rows[2][1]='位置缺漏';rows[2][3]='';rows[2][4]='';rows.push(Array(14).fill(''));rows.push([id(),'第三間',null,25,121]);
const snapshot=JSON.stringify(rows),catalog=JSON.parse(f.box.listCandidates('json'));assert.equal(catalog.length,3);assert.equal(catalog[0].budget,null);assert(catalog[0].dataIssues.includes('hours'));assert(catalog[1].unavailable);assert.equal(catalog[1].location,null);assert.equal(catalog[2].category,'unknown');assert.equal(JSON.stringify(rows),snapshot);
f.props.set('ORIGIN_LAT',' ');f.props.set('ORIGIN_LNG',' ');assert.equal(f.box.getBootstrap().originVerified,false);
assert.doesNotThrow(()=>f.box.addCandidate({...good,name:'還能新增'},admin));assert.equal(rows[1][9],'{bad');
// Incomplete reviews do not become zero scores or prevent healthy reviews from loading.
const member=f.issueMember(),rid=catalog[0].id;
const valid=f.box.addReview({restaurantId:rid,item:'雞腿飯',feedback:'好吃',score:0,requestId:id()},member.token).review;
const reviewSheet=f.sheets.get('Reviews').data;reviewSheet.push([id(),rid,'漏分數','不能當零分','', '',id(),'']);reviewSheet.push([id(),rid,'壞分數','不能阻擋其他人',201,'',id(),'']);reviewSheet.push([...reviewSheet[1]]);reviewSheet.at(-1)[0]=id();reviewSheet.at(-1)[7]='bad date';
f.box.listReviews(rid,null);const votes=f.sheets.get('ReviewVotes').data;votes.push([valid.id,'same-voter',1,'']);votes.push([valid.id,'same-voter',-1,'']);votes.push([valid.id,'bad-voter','', '']);votes.push([valid.id,'bad-value',99,'']);votes.push(['',null,null,null]);
const before=JSON.stringify({reviews:reviewSheet,votes}),result=f.box.listReviews(rid,null);assert.equal(result.summary.count,2);assert.equal(result.summary.average,0);assert.equal(result.reviews.find(r=>r.id===valid.id).likes,0);assert.equal(result.reviews.find(r=>r.id===valid.id).dislikes,1);assert.equal(result.unavailableCount,5);assert.equal(JSON.stringify({reviews:reviewSheet,votes}),before);assert(result.reviews.some(r=>r.createdAt===''));
// Required schema errors remain explicit; they do not silently expose or rewrite unrelated sheets.
rows[0][0]='wrong';assert.throws(()=>f.box.listCandidates(),/表頭/);assert.equal(rows[0][0],'wrong');assert.equal(f.held(),false);
console.log('PASS data quality: '+cases+' malformed/empty field cases, unknown filters, invalid coordinates/hours/links, duplicate IDs, strict writes, intact source rows, review score integrity, deduplicated votes, invalid origin and schema errors.');

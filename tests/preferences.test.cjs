const assert=require('node:assert/strict'),C=require('../src/core.js'),Catalog=require('../src/catalog.js');
const fixture=require('./server-fixture.cjs')(),{box,props,sheets}=fixture;
const origin={lat:25.0143,lng:121.4638,name:'板橋車站'},far={lat:25.05,lng:121.52,name:'另一個出發點'};
const record={name:'葷素測試餐廳',address:'',phone:'',location:{lat:origin.lat,lng:origin.lng},category:'台式',budget:120,covered:'yes',coveredOrigin:origin,diet:'both',mapsUrl:'',weeklyHours:Array.from({length:7},()=>({status:'open',spans:[{from:'10:00',to:'21:00'}]}))};
const filters={walk:'any',weather:'any',budget:'any',category:'all',diet:'any',rating:'any',open:false,noRepeat:false,from:'12:00',to:'13:00'},context={origin,weather:{rain:false},now:new Date('2026-09-15T04:00Z')};
for(const budget of [undefined,null,'',' ']){
 const unknown=Catalog.hydrate({...record,budget});
 assert.deepEqual(C.reasons(unknown,filters,context),[]);
 assert(C.reasons(unknown,{...filters,budget:'150'},context).includes('預算未標記'));
}
assert(C.reasons(Catalog.hydrate({...record,budget:200}),{...filters,budget:'150'},context).includes('超出預算'));
for(const diet of ['meat','vegetarian']){
 assert.equal(C.reasons(Catalog.hydrate(record),{...filters,diet},context).length,0);
 assert.equal(C.reasons(Catalog.hydrate({...record,diet}),{...filters,diet},context).length,0);
 assert(C.reasons(Catalog.hydrate({...record,diet:'unknown'}),{...filters,diet},context).includes('葷素未標記'));
 assert(C.reasons(Catalog.hydrate({...record,diet:diet==='meat'?'vegetarian':'meat'}),{...filters,diet},context).length);
}
assert.throws(()=>Catalog.validate({...record,diet:'veganish'}));assert.throws(()=>Catalog.validate({...record,coveredOrigin:{lat:91,lng:121}}));
assert.equal(C.reasons(Catalog.hydrate(record),{...filters,weather:'rain'},context).length,0);
assert(C.reasons(Catalog.hydrate(record),{...filters,weather:'rain'},{...context,origin:far}).includes('此出發點的避雨路線待確認'));
assert(C.reasons(Catalog.hydrate({...record,coveredOrigin:null}),{...filters,weather:'rain'},context).includes('此出發點的避雨路線待確認'));
assert(C.reasons(Catalog.hydrate(record),{...filters,walk:'near'},{...context,origin:far}).includes('距離不符合'));
assert.deepEqual(C.validateOrigin({...origin,name:' 公司 '}),{...origin,name:'公司'});
for(const bad of [{lat:''},{lat:NaN},{lng:181},{name:''},{name:'x'.repeat(81)}])assert.throws(()=>C.validateOrigin({...origin,...bad}));
const token=box.adminLogin(props.get('ADMIN_PASSPHRASE')).token;
const saved=box.addCandidate(record,token).record;assert.equal(saved.diet,'both');assert.equal(saved.coveredOrigin.lat,origin.lat);
assert.equal(box.listCandidates()[0].diet,'both');assert.equal(sheets.get('RestaurantsFree').data[0].length,14);
// Migrate old 12-column data without changing IDs, rows, or adding reviews.
const legacy=require('./server-fixture.cjs')(),old=legacy.sheets.get('RestaurantsFree').data;
old.push(['id','name','address','lat','lng','phone','category','budget_twd','covered_route','weekly_hours','maps_url','added_at']);
old.push([saved.id,'原店家','',25.0143,121.4638,'','台式',120,'yes',JSON.stringify(record.weeklyHours),'','2026-09-15T04:00Z']);
const migrated=legacy.box.listCandidates();assert.equal(migrated.length,1);assert.equal(migrated[0].id,saved.id);assert.equal(migrated[0].diet,'unknown');assert.equal(migrated[0].coveredOrigin,null);assert.equal(old[0].length,14);assert.equal(old[1].length,12);
legacy.box.listCandidates();assert.equal(old.length,2);assert.equal(legacy.sheets.size,1);
console.log('PASS preferences: mixed/vegetarian/meat/unknown filters, origin validation, distance and rain origin binding, new schema persistence, non-destructive legacy migration.');

const assert=require('node:assert/strict'),crypto=require('node:crypto');
const Catalog=require('../src/catalog.js'),Core=require('../src/core.js'),fixture=require('./server-fixture.cjs');
const base={id:crypto.randomUUID(),name:'多餐點測試店',location:{lat:25.0143,lng:121.4638},category:'早餐／早午餐、義大利麵、咖啡／甜點'};
const hydrated=Catalog.hydrate(base),expected=['早餐／早午餐','義大利麵','咖啡／甜點'];
assert.deepEqual(hydrated.foodTypes,expected);
for(const category of expected)assert(Catalog.matchesType(hydrated,category));
assert(!Catalog.matchesType(hydrated,'牛排'));assert(Catalog.matchesType(hydrated,'all'));
assert.deepEqual(Catalog.foodTypesFor({...base,foodTypes:['牛排']}),expected,'derived types cannot override the source category');
for(const category of ['正餐','台式','日式','韓式','西式','麵食','便當／快餐','其他','unknown','']){
 const r=Catalog.hydrate({...base,category});assert.deepEqual(r.foodTypes,[]);assert(Catalog.matchesType(r,'unclassified'));assert(Catalog.matchesType(r,'all'));assert(!r.unavailable);assert(r.dataIssues.includes('category'));
}
for(const category of ['牛肉麵、牛肉麵，拉麵;拉麵','牛肉麵\n拉麵','牛肉麵|拉麵','牛肉麵；拉麵',['牛肉麵','拉麵','牛肉麵']])assert.deepEqual(Catalog.parseCategories(category).foodTypes,['牛肉麵','拉麵']);
assert.deepEqual(Catalog.parseCategories(' 早餐/早午餐 , 咖啡/甜點 ').foodTypes,['早餐／早午餐','咖啡／甜點']);
assert.deepEqual(Catalog.parseCategories('早餐店、咖啡廳、甜點、咖啡店').foodTypes,['早餐／早午餐','咖啡／甜點']);
assert.deepEqual(Catalog.parseCategories('便當店').foodTypes,['便當']);
assert.equal(Catalog.typeName(base.category),'早餐／早午餐、義大利麵、咖啡／甜點');
const records=Catalog.collection([base,{...base,id:crypto.randomUUID(),name:'另一間',category:'咖啡／甜點、牛排'},{...base,id:crypto.randomUUID(),name:'舊店',category:'正餐'}]);
const counts=Catalog.typeOptions(records);
assert.equal(counts[0].count,3);assert.equal(counts.find(t=>t.value==='咖啡／甜點').count,2);
assert.equal(counts.find(t=>t.value==='unclassified').count,1);assert(!counts.some(t=>t.value==='正餐'));
assert.equal(Catalog.typeOptions(records,{includeEmpty:true}).find(t=>t.value==='牛肉麵').count,0);
assert(counts.filter(t=>t.value!=='all').reduce((n,t)=>n+t.count,0)>3,'multiple category counts may overlap without duplicating the all list');
for(const category of [false,123,{},['牛排',null],['牛排',{}],'__proto__','constructor','牛排/<script>','牛排、<script>alert(1)</script>','拉麵'.repeat(300)]){
 assert.doesNotThrow(()=>Catalog.read({...base,category}));assert.throws(()=>Catalog.validate({...base,category}),/餐點類別/);
}
const mixed=Catalog.read({...base,category:'牛肉麵、打錯的分類'});assert.deepEqual(mixed.foodTypes,['牛肉麵']);assert(mixed.dataIssues.includes('category'));assert.equal(Catalog.qualitySummary([mixed]).filters.find(f=>f.key==='category').count,1);
const filters={walk:'any',weather:'any',budget:'any',category:'義大利麵',diet:'any',rating:'any',from:'12:00',to:'13:00',open:false,noRepeat:false};
const context={origin:base.location,weather:{rain:false}};
assert.deepEqual(Core.reasons(hydrated,filters,context),[]);
assert(Core.reasons(hydrated,{...filters,category:'牛肉麵'},context).length>0);
assert.deepEqual(Core.reasons(Catalog.hydrate({...base,category:'正餐'}),{...filters,category:'all'},context),[]);
// Persist multiple types in the existing G column, preserving IDs, schema and review relationships.
const f=fixture(),admin=f.box.adminLogin(f.props.get('ADMIN_PASSPHRASE')).token;
const saved=f.box.addCandidate(base,admin).record;
assert.equal(f.data[0].length,14);assert.equal(f.data[1][6],base.category);assert.equal(saved.id,f.data[1][0]);
let rows=JSON.parse(f.box.listCandidates('json'));assert.deepEqual(rows[0].foodTypes,expected);
const member=f.issueMember();const review=f.box.addReview({restaurantId:saved.id,item:'測試餐點',feedback:'分類更新不影響評論',score:0,requestId:crypto.randomUUID()},member.token).review;
f.box.setReviewVote(review.id,1,member.token);
f.data[1][6]='牛排、牛肉麵、牛肉麵';const snapshot=JSON.stringify(f.data);
rows=JSON.parse(f.box.listCandidates('json'));assert.deepEqual(rows[0].foodTypes,['牛排','牛肉麵']);assert.equal(JSON.stringify(f.data),snapshot);
assert.equal(f.box.listReviews(saved.id,member.token).reviews[0].likes,1);
f.makeSheet('原始清單',[['系統店家 ID','店家類型'],[saved.id,'咖啡廳']]);
assert.deepEqual(JSON.parse(f.box.listCandidates('json'))[0].foodTypes,['牛排','牛肉麵'],'explicit G-column types win over original import');
assert.throws(()=>f.box.addCandidate({...base,name:'不合法',category:'牛肉麵、沒這分類'},admin));
assert.equal(f.box.addCandidate({...base,name:'完全未分類',category:[]},admin).record.category,'unknown');
console.log('PASS food types: multiple meals, aliases and delimiters, unique counts, coarse legacy labels stay unclassified, partial bad reads and strict writes, persisted G-column tags, unchanged IDs/reviews/votes, shared category filtering.');

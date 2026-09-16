const assert=require('node:assert/strict'),crypto=require('node:crypto');
const C=require('../src/catalog.js'),Core=require('../src/core.js'),fixture=require('./server-fixture.cjs');
const types=["速食","咖哩","拉麵","烏龍麵","早餐店","早午餐","牛肉麵","牛排","小吃店","快餐便當","咖啡廳","輕食咖啡廳","韓式","鍋物","素食","冰店","甜點","粥店","港式","台式","飯糰飯捲","鵝肉專賣","燒臘","義式","壽司","泰式","日式定食"];
const base={id:crypto.randomUUID(),name:'測試店',location:{lat:25,lng:121},category:'早午餐、輕食咖啡廳、義式'};
for(const category of types){const r=C.hydrate({...base,category});assert.deepEqual(r.foodTypes,[category]);assert(C.matchesType(r,category));assert(!r.dataIssues.includes('category'));}
assert.deepEqual(C.foodCategories,types);
const h=C.hydrate(base);assert.deepEqual(h.foodTypes,['早午餐','輕食咖啡廳','義式']);assert(!C.matchesType(h,'咖啡廳'));assert(!C.matchesType(h,'早餐店'));
const rows=C.collection([...types.map(category=>({...base,id:crypto.randomUUID(),category})),base,{...base,id:crypto.randomUUID(),category:'新分類壽司'},{...base,id:crypto.randomUUID(),category:'正餐'}]);
const options=C.typeOptions(rows);assert.equal(options[0].value,'all');assert.equal(options[0].count,types.length+3);assert.equal(options.find(t=>t.value==='早午餐').count,2);assert(!options.some(t=>t.value==='新分類壽司'));assert(!options.some(t=>t.value==='火鍋'));
assert.equal(options.find(t=>t.value==='unclassified').count,2);assert(!C.typeOptions([],{includeEmpty:true}).some(t=>t.value==='台式'));
for(const category of ['其他','unknown','正餐','尚未分類','']){const r=C.hydrate({...base,category});assert(C.matchesType(r,'unclassified'));assert(C.matchesType(r,'all'));assert(!r.unavailable);}
for(const category of ['牛排、牛排，拉麵','牛排\n拉麵','牛排;拉麵','牛排|拉麵',['牛排','拉麵','牛排']])assert.deepEqual(C.parseCategories(category).foodTypes,['牛排','拉麵']);
assert.equal(C.parseCategories('早餐/早午餐').valid,false);
assert.deepEqual(C.parseCategories('韓式料理、韓式').foodTypes,['韓式']);
for(const category of [false,42,{},['台式',null],'__proto__','constructor','<script>','台式、javascript:alert(1)','a'.repeat(33),'拉麵'.repeat(300)]){assert.doesNotThrow(()=>C.read({...base,category}));assert.throws(()=>C.validate({...base,category}),/餐點類別/);}
const mixed=C.read({...base,category:'台式、<script>'});assert.deepEqual(mixed.foodTypes,['台式']);assert(mixed.dataIssues.includes('category'));
assert.deepEqual(C.foodTypesFor({...base,foodTypes:['牛排']}),h.foodTypes);
const filters={walk:'any',weather:'any',budget:'any',category:'早午餐',diet:'any',rating:'any',open:false,noRepeat:false};
assert.deepEqual(Core.reasons(h,filters,{origin:base.location}),[]);assert(Core.reasons(h,{...filters,category:'台式'},{origin:base.location}).length);
const f=fixture(),b=f.box,token=b.adminLogin(f.props.get('ADMIN_PASSPHRASE')).token;
const saved=b.addCandidate(base,token).record,m=f.issueMember(),review=b.addReview({restaurantId:saved.id,item:'飯',feedback:'測試',score:0,requestId:crypto.randomUUID()},m.token).review;b.setReviewVote(review.id,1,m.token);
f.data[1][6]='台式、港式';const snapshot=JSON.stringify(f.data);const refreshed=b.listCandidates();assert.deepEqual(JSON.parse(JSON.stringify(refreshed[0].foodTypes)),['台式','港式']);assert.equal(JSON.stringify(f.data),snapshot);assert.equal(b.listReviews(saved.id).reviews[0].likes,1);assert.equal(f.data[0].length,14);
f.data[1][6]='新分類壽司';assert(!C.typeOptions(b.listCandidates()).some(t=>t.value==='新分類壽司'));
assert(C.matchesType(b.listCandidates()[0],'unclassified'));
assert.equal(f.data[1][6],'新分類壽司');
assert.throws(()=>b.addCandidate({...base,name:'未知類別',category:'新分類壽司'},token),/餐點類別/);
assert.deepEqual(options.slice(1,types.length+1).map(t=>t.value),types);
assert.deepEqual(JSON.parse(JSON.stringify(b.LunchCatalog.foodCategories)),types);
for(const category of types)assert.notEqual(C.categoryIcon(category),'🍽');
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'src/catalog.js'),'utf8');
assert(fs.readFileSync(path.join(root,'dist/Code.gs'),'utf8').startsWith(source));
assert(fs.readFileSync(path.join(root,'dist/Index.html'),'utf8').includes(source));
console.log('PASS food types: owner categories incl 台式, exact separate labels, shared fixed 27-category master in both deployment files, unique counts, safe unknowns, multi-tag filtering, refresh and unchanged review links.');

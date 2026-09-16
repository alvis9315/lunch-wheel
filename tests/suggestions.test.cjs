const assert=require('node:assert/strict'),crypto=require('node:crypto'),fixture=require('./server-fixture.cjs');
const f=fixture(),b=f.box,admin=b.adminLogin(f.props.get('ADMIN_PASSPHRASE')).token,member=f.issueMember('submitter','submitter@example.test');
b.listCandidates();const restaurants=JSON.stringify(f.data);
const input=extra=>({name:'測試店',mapsUrl:'https://maps.app.goo.gl/fixture',note:'雞腿飯好吃',requestId:crypto.randomUUID(),...extra});
const first=input();assert.throws(()=>b.addSuggestion(first,null),/MEMBER_REQUIRED/);assert.throws(()=>b.addSuggestion(first,admin),/MEMBER_REQUIRED/);
for(const bad of [{name:''},{name:' '},{name:'x'.repeat(101)},{mapsUrl:''},{mapsUrl:'https://evil.test/maps'},{mapsUrl:'https://google.com.evil.test/maps/a'},{mapsUrl:'javascript:alert(1)'},{mapsUrl:'http://maps.app.goo.gl/abc'},{note:'x'.repeat(1001)},{requestId:'bad'}])assert.throws(()=>b.addSuggestion({...first,...bad},member.token));
assert(b.addSuggestion({...first,email:'forged@example.test'},member.token).received);assert.equal(b.addSuggestion(first,member.token).duplicate,true);
assert.throws(()=>b.addSuggestion({...first,note:'改了內容'},member.token),/已送出/);
assert.equal(f.sheets.get('Suggestions').data.length,2);assert.equal(f.sheets.get('Suggestions').data[1][6],'submitter@example.test');
for(const token of [null,'fake',member.token]){assert.throws(()=>b.listSuggestions(token),/AUTH_REQUIRED/);assert.throws(()=>b.completeSuggestion(crypto.randomUUID(),token),/AUTH_REQUIRED/);}
const inbox=b.listSuggestions(admin);assert.equal(inbox.items.length,1);assert.equal(inbox.items[0].email,'submitter@example.test');
const other=f.issueMember();assert.equal(b.addSuggestion(input(),other.token).duplicate,true);assert.equal(f.sheets.get('Suggestions').data.length,2);
assert.equal(JSON.stringify(b.addSuggestion(first,member.token)).includes('@'),false);
b.addSuggestion(input({name:'=IMPORTXML("x")',mapsUrl:'https://www.google.com/maps/place/test',note:'=1+1\n<script>x</script>'}),member.token);
assert(f.sheets.get('Suggestions').data[2][2].startsWith("'="));assert(f.sheets.get('Suggestions').data[2][4].startsWith("'="));
b.addSuggestion(input({name:'第三家'}),member.token);assert.throws(()=>b.addSuggestion(input({name:'第四家'}),member.token),/10 分鐘/);
f.advance(600001);assert(b.addSuggestion(input({name:'第四家'}),member.token).received);
assert.equal(JSON.stringify(f.data),restaurants,'suggestions never mutate the restaurant pool');
b.completeSuggestion(inbox.items[0].id,admin);assert.equal(b.listSuggestions(admin).total,3);b.completeSuggestion(inbox.items[0].id,admin);assert.equal(f.sheets.get('Suggestions').data.length,5);
assert.equal(f.sheets.get('Suggestions').data[1][8],'done');
for(let i=0;i<31;i++){const m=f.issueMember();b.addSuggestion(input({name:'分頁店 '+i}),m.token);}
const p1=b.listSuggestions(admin),p2=b.listSuggestions(admin,p1.nextCursor);assert.equal(p1.items.length,30);assert.equal(p2.items.length,4);assert.equal(p2.nextCursor,null);
assert.equal(new Set([...p1.items,...p2.items].map(r=>r.id)).size,34);
b.adminLogout(admin);assert.throws(()=>b.listSuggestions(admin),/AUTH_REQUIRED/);
const expires=b.adminLogin(f.props.get('ADMIN_PASSPHRASE')).token;f.advance(1800001);assert.throws(()=>b.listSuggestions(expires),/AUTH_REQUIRED/);
assert.equal(JSON.stringify(f.data),restaurants);assert.equal(f.held(),false);assert.equal(f.requests.filter(r=>r.url.includes('maps')).length,0,'links are not fetched/scraped');
console.log('PASS suggestions: login, trusted Maps links, safe text, verified submitter, retry/duplicate prevention, rate limit, private curator inbox, pagination, status updates and expiry, unchanged restaurant list.');

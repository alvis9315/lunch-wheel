const assert=require('node:assert/strict'),crypto=require('node:crypto'),fixture=require('./server-fixture.cjs');
const f=fixture(),b=f.box,admin=b.adminLogin(f.props.get('ADMIN_PASSPHRASE')).token;
const shop=b.addCandidate({name:'Privacy fixture',location:{lat:25.01,lng:121.46}},admin).record;
const member=f.issueMember('private-person','private-person@example.test'),other=f.issueMember('other-person','other@example.test');
const input=extra=>({restaurantId:shop.id,item:'飯',feedback:'測試',score:0,requestId:crypto.randomUUID(),...extra});
assert.equal(member.displayMode,'anonymous');
const firstInput=input(),anonymous=b.addReview(firstInput,member.token).review;
assert.equal(anonymous.authorLabel,'匿名食友');
b.saveMemberDisplay({mode:'anonymous',nickname:'不公開的暱稱'},member.token);
const hidden=b.addReview(input({display:{mode:'anonymous',nickname:'不公開的暱稱'},authorEmail:'forged@example.test'}),member.token).review;
assert.equal(hidden.authorLabel,'匿名食友');
assert.throws(()=>b.addReview(input({display:{mode:'nickname',nickname:'偽造暱稱'}}),member.token),/顯示名稱已變更/);
b.saveMemberDisplay({mode:'nickname',nickname:'  午餐大師  '},member.token);
const namedInput=input({display:{mode:'nickname',nickname:'  午餐大師  '}}),named=b.addReview(namedInput,member.token).review;
assert.equal(named.authorLabel,'午餐大師');assert.equal(b.addReview(namedInput,member.token).duplicate,true);
assert.throws(()=>b.addReview({...namedInput,display:{mode:'anonymous',nickname:'午餐大師'}},member.token),/已送出/);
for(const display of [{mode:'nickname',nickname:''},{mode:'nickname',nickname:' '},{mode:'name',nickname:'bad'},{mode:'nickname',nickname:'x'.repeat(33)},{mode:'anonymous',nickname:12},null]){
 assert.throws(()=>b.addReview(input({display}),member.token));assert.throws(()=>b.saveMemberDisplay(display,member.token));
}
for(const t of [undefined,null,'fake',member.token,other.token])assert.throws(()=>b.getReviewAuthor(hidden.id,t),/AUTH_REQUIRED/);
const identity=b.getReviewAuthor(hidden.id,admin);
assert.equal(identity.publicName,'匿名食友');assert.equal(identity.nickname,'不公開的暱稱');assert.equal(identity.email,'private-person@example.test');
for(const value of [b.listReviews(shop.id,null),b.listReviews(shop.id,other.token),b.addReview(firstInput,member.token),b.setReviewVote(hidden.id,1,other.token),b.setReviewVote(hidden.id,-1,other.token)]){
 const json=JSON.stringify(value);for(const secret of ['private-person@example.test','Fixture Food Friend','不公開的暱稱','authorEmail','authorName','authorKey','googleId',member.token])assert(!json.includes(secret),'public data leaked '+secret);
}
assert.throws(()=>b.addReview(input(),null),/MEMBER_REQUIRED/);assert.throws(()=>b.setReviewVote(hidden.id,1,null),/MEMBER_REQUIRED/);
b.saveMemberDisplay({mode:'anonymous',nickname:'私人的暱稱'},member.token);
assert.equal(b.addReview(namedInput,member.token).duplicate,true,'retry keeps original identity even after profile changes');
const next=b.addReview(input(),member.token).review;assert.equal(next.authorLabel,'匿名食友','new reviews use current stored profile');
assert.equal(f.issueMember('private-person','private-person@example.test').displayMode,'anonymous');
assert.equal(b.listReviews(shop.id).reviews.find(r=>r.id===named.id).authorLabel,'午餐大師','preferences do not rewrite existing reviews');
assert.equal(f.sheets.get('Reviews').data[0].length,12);assert.equal(f.sheets.get('Members').data[0].length,6);
b.adminLogout(admin);assert.throws(()=>b.getReviewAuthor(hidden.id,admin),/AUTH_REQUIRED/);
const expired=b.adminLogin(f.props.get('ADMIN_PASSPHRASE')).token;f.advance(1800001);assert.throws(()=>b.getReviewAuthor(hidden.id,expired),/AUTH_REQUIRED/);
const rotated=b.adminLogin(f.props.get('ADMIN_PASSPHRASE')).token;f.props.set('ADMIN_PASSPHRASE','a-new-private-fixture-passphrase-123');assert.throws(()=>b.getReviewAuthor(hidden.id,rotated),/AUTH_REQUIRED/);
// Upgrade both previous schemas without changing any historical row or association.
for(const columns of [8,11]){
 const old=fixture(),ob=old.box,ot=ob.adminLogin(old.props.get('ADMIN_PASSPHRASE')).token,rid=ob.addCandidate({name:'Legacy',location:{lat:25,lng:121}},ot).record.id;
 const headers=['id','restaurant_id','item','feedback','score','author_key','request_id','created_at','author_email','author_name','author_nickname'].slice(0,columns);
 const rows=[headers,[crypto.randomUUID(),rid,'飯','心得',100,'old-key',crypto.randomUUID(),'2026-01-01T00:00:00Z','legacy@example.test','Never Public Google Name',''].slice(0,columns)];
 old.makeSheet('Reviews',rows);const before=JSON.stringify(rows[1]);const review=ob.listReviews(rid).reviews[0];
 assert.equal(review.authorLabel,columns===8?'以前的匿名食友':'匿名食友');assert(!JSON.stringify(review).includes('Never Public'));assert.equal(JSON.stringify(rows[1]),before);assert.equal(rows[0].length,12);
 assert.equal(ob.getReviewAuthor(review.id,ot).email,columns===8?null:'legacy@example.test');
 if(columns===11){rows[1][10]='自選名字';assert.equal(ob.listReviews(rid).reviews[0].authorLabel,'自選名字');rows[1][11]='BROKEN';assert.equal(ob.listReviews(rid).reviews[0].authorLabel,'匿名食友');}
}
const oldMember=fixture();oldMember.makeSheet('Members',[['google_id','email','google_name','nickname','updated_at'],['google:legacy-user','legacy@example.test','Google Name','舊暱稱','2026-01-01T00:00:00Z']]);
assert.equal(oldMember.issueMember('legacy-user','legacy@example.test').displayMode,'nickname');assert.equal(oldMember.sheets.get('Members').data[0].length,6);
// Truly logged-out visitors can browse and begin OAuth without a Google active-user key.
const guest=fixture(),g=guest.box;guest.configureGoogle();guest.setActiveUser('');assert.equal(g.getSharedHome().records.length,0);
const proof=crypto.randomBytes(36).toString('hex'),flow=g.beginGoogleSignIn(proof),bad=crypto.randomBytes(36).toString('hex');
assert(!JSON.stringify(flow).includes(proof));assert(!flow.url.includes(proof));assert.equal(g.getGoogleSignInResult(flow.state,flow.pollToken,proof).status,'pending');
for(const p of [undefined,null,'bad',bad]){
 assert.throws(()=>g.completeGoogleBrowserSignIn({state:flow.state,code:'fixture-code'},p));
 assert.throws(()=>g.getGoogleSignInResult(flow.state,flow.pollToken,p));
}
assert.equal(guest.requests.length,0,'unbound callbacks must never exchange a code');
guest.setIdentity({sub:'public-member',email:'public-member@example.test',email_verified:true,name:'Private Google Name'});
guest.setActiveUser('a-new-google-browser-key');g.completeGoogleBrowserSignIn({state:flow.state,code:'fixture-code'},proof);
const signed=g.getGoogleSignInResult(flow.state,flow.pollToken,proof).member;assert.equal(signed.email,'public-member@example.test');
guest.setActiveUser('');assert.equal(g.saveMemberDisplay({mode:'anonymous'},signed.token).displayMode,'anonymous');
assert.throws(()=>g.completeGoogleBrowserSignIn({state:flow.state,code:'fixture-code'},proof),/已處理/);
assert.throws(()=>g.getGoogleSignInResult(flow.state,'x'.repeat(72),proof),/失效/);
g.memberLogout(signed.token);assert.throws(()=>g.saveMemberDisplay({mode:'anonymous'},signed.token),/MEMBER_REQUIRED/);
const timed=g.beginGoogleSignIn(proof);guest.advance(600001);assert.throws(()=>g.getGoogleSignInResult(timed.state,timed.pollToken,proof),/失效/);
assert.equal(f.held(),false);assert.equal(guest.held(),false);
console.log('PASS review privacy: explicit anonymous/nickname, no public Google identity, admin-only author lookup with expiry/logout/rotation, no forged identity, write authentication, retries, non-destructive 8/11-column review and 5-column member migrations, logged-out OAuth proof binding and replay rejection.');

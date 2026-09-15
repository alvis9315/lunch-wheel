const assert=require('node:assert/strict'),crypto=require('node:crypto'),R=require('../src/reviews.js');
const fixture=require('./server-fixture.cjs')(),{box,props,sheets}=fixture;
const uuid=()=>crypto.randomUUID(),visitor=()=>fixture.issueMember().token,a=visitor(),b=visitor();
for(let score=-100;score<=200;score++){assert(R.band(score));assert.equal(R.bands.filter(b=>score>=b.min&&score<=b.max).length,1);}
assert.equal(R.band(0).label,'狗幹難吃');assert.equal(R.band(100).label,'頂上人間');
const record={name:'評論測試店',address:'',phone:'',location:{lat:25.0143,lng:121.4638},category:'台式',budget:null,covered:'unknown',mapsUrl:'',weeklyHours:Array.from({length:7},()=>({status:'unknown',spans:[]}))};
const token=box.adminLogin(props.get('ADMIN_PASSPHRASE')).token,id=box.addCandidate(record,token).record.id,other=box.addCandidate({...record,name:'另一家'},token).record.id;
const input={restaurantId:id,item:'雞腿飯',feedback:'便當菜不好吃，雞腿太小隻很盤',score:0,requestId:uuid()};
assert.equal(box.listReviews(id,a).summary.count,0);assert.equal(sheets.size,4);
for(const score of [-101,201,0.5,NaN,Infinity,'100',null])assert.throws(()=>box.addReview({...input,score},a),/分數/);
for(const bad of [{item:''},{feedback:' '},{item:'x'.repeat(101)},{feedback:'x'.repeat(1501)},{restaurantId:uuid()},{requestId:'bad'}])assert.throws(()=>box.addReview({...input,...bad},a));
assert.throws(()=>box.addReview(input,'fake'));assert.equal(sheets.get('Reviews').data.length,1);
const first=box.addReview(input,a);assert.equal(first.review.score,0);assert.equal(first.duplicate,false);
assert.equal(box.addReview(input,a).duplicate,true);assert.equal(sheets.get('Reviews').data.length,2);
assert.throws(()=>box.addReview({...input,item:'別的餐'},a),/這則評論已送出/);
const malicious=box.addReview({...input,requestId:uuid(),item:'=IMPORTXML("x")',feedback:'<img src=x onerror=alert(1)>\n=HYPERLINK("x")',score:-100},b);
assert(sheets.get('Reviews').data[2][2].startsWith("'="));assert.equal(box.listReviews(id,a).reviews[0].item,'=IMPORTXML("x")');
assert.equal(box.listReviews(other,a).summary.count,0);assert.equal(box.listReviews(id,a).summary.average,-50);
const publicJson=JSON.stringify(box.listReviews(id,a));assert(!publicJson.includes(a));assert(!publicJson.includes('authorKey'));assert(!publicJson.includes('requestId'));assert(!publicJson.includes('voterKey'));
let vote=box.setReviewVote(first.review.id,1,a);assert.equal(vote.likes,1);assert.equal(vote.myVote,1);
vote=box.setReviewVote(first.review.id,1,a);assert.equal(vote.likes,1);assert.equal(sheets.get('ReviewVotes').data.length,2);
vote=box.setReviewVote(first.review.id,-1,a);assert.equal(vote.likes,0);assert.equal(vote.dislikes,1);
vote=box.setReviewVote(first.review.id,1,b);assert.equal(vote.likes,1);assert.equal(vote.dislikes,1);
vote=box.setReviewVote(first.review.id,0,a);assert.equal(vote.dislikes,0);assert.equal(vote.likes,1);assert.equal(vote.myVote,0);
assert.equal(box.listReviews(id,b).reviews.find(r=>r.id===first.review.id).myVote,1);
assert.equal(box.listReviews(id,a).summary.average,-50); // Votes never alter meal scores.
assert.throws(()=>box.setReviewVote(first.review.id,2,a));assert.throws(()=>box.setReviewVote(first.review.id,'1',a));assert.throws(()=>box.setReviewVote(uuid(),1,a),/找不到/);
assert.throws(()=>box.addCandidate(record,a),/AUTH_REQUIRED/); // Community token is not an admin token.
for(let i=0;i<4;i++)box.addReview({...input,requestId:uuid(),item:'測試'+i},a);
assert.throws(()=>box.addReview({...input,requestId:uuid()},a),/頻繁/);fixture.advance(61000);assert(box.addReview({...input,requestId:uuid()},a).review.id);
for(let i=0;i<24;i++)box.addReview({...input,requestId:uuid(),item:'分頁'+i,score:200},visitor());
const page1=box.listReviews(id,a),page2=box.listReviews(id,a,page1.nextCursor);assert.equal(page1.reviews.length,20);assert.equal(page1.summary.count,31);assert.equal(page2.reviews.length,11);assert.equal(page2.nextCursor,null);assert.equal(new Set([...page1.reviews,...page2.reviews].map(r=>r.id)).size,31);
assert.throws(()=>box.listReviews(id,a,uuid()),/已變動/);assert.throws(()=>box.listReviews(other,a,page1.nextCursor),/已變動/);
// Permission policy stays independent when owner disables management.
props.delete('ADMIN_PASSPHRASE');assert(box.addReview({...input,requestId:uuid()},visitor()).review.id);assert.throws(()=>box.addCandidate(record,token),/AUTH_REQUIRED/);
assert.equal(fixture.held(),false);console.log('PASS reviews server: all 301 score labels, 3 linked sheets, invalid/orphan input rejection, retry dedupe, escaping, summary, pagination, no identity exposure, vote set/change/cancel isolation, throttle, restaurant admin boundary.');

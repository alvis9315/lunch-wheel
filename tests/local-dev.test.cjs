const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),{createLocalServer}=require('../scripts/local-dev.cjs');
(async()=>{
  const server=createLocalServer({delay:0});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  try{
    const html=await (await fetch(origin)).text(),key=html.match(/data-key="([a-f0-9]{64})"/)[1];
    assert(html.includes('本機測試'));assert(!fs.readFileSync(require('node:path').join(__dirname,'../dist/Index.html'),'utf8').includes('/__local/'),'deployment must not include dev bridge');
    const headers={'Content-Type':'application/json','Origin':origin,'X-Lunch-Local':key};
    const call=async(method,...args)=>{const response=await fetch(origin+'/__local/rpc',{method:'POST',headers,body:JSON.stringify({method,args})});const body=await response.json();if(!body.ok)throw Error(body.error);return body.result;};
    const rows=await call('listCandidates');assert.equal(rows.length,30);assert(rows.some(r=>r.category==='unknown'));assert(rows.every(r=>r.name.startsWith('範例')));
    for(const bad of [{...headers,Origin:'https://other.test'},{...headers,'X-Lunch-Local':'wrong'}])assert.equal((await fetch(origin+'/__local/reset',{method:'POST',headers:bad,body:'{}'})).status,403);
    assert.equal((await fetch(origin+'/apps-script/Identity.gs')).status,404);
    assert.equal(await new Promise((resolve,reject)=>require('node:http').get(origin,{headers:{Host:'other.test'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject)),403);
    await assert.rejects(()=>call('requireMember_','x'),/不支援/);
    await assert.rejects(()=>call('addReview',{},null),/MEMBER_REQUIRED/);
    const login=async(code)=>{const proof=crypto.randomBytes(36).toString('hex'),flow=await call('beginGoogleSignIn',proof);assert(flow.url.startsWith(origin+'/__local/sign-in?'));assert((await (await fetch(flow.url)).text()).includes('不會連接 Google'));assert((await (await fetch(origin+'/__local/callback?state='+flow.state+'&code='+code)).text()).includes('/__local/client.js'));await call('completeGoogleBrowserSignIn',{state:flow.state,code},proof);return (await call('getGoogleSignInResult',flow.state,flow.pollToken,proof)).member;};
    const alice=await login('alice');await call('saveMemberDisplay',{mode:'nickname',nickname:'本機暱稱'},alice.token);
    const input={restaurantId:rows[0].id,item:'本機雞腿飯',feedback:'測試評論內容',score:100,requestId:crypto.randomUUID(),display:{mode:'nickname',nickname:'本機暱稱'}};
    const review=(await call('addReview',input,alice.token)).review;assert.equal(review.authorLabel,'本機暱稱');assert((await call('addReview',input,alice.token)).duplicate);
    const bob=await login('bob');assert.equal((await call('setReviewVote',review.id,1,bob.token)).likes,1);assert.equal((await call('setReviewVote',review.id,-1,bob.token)).dislikes,1);
    await fetch(origin);assert((await call('listReviews',rows[0].id)).reviews.some(r=>r.id===review.id),'refresh retains local writes');
    const author=await call('adminLogin','lunch-local-admin-only-12345');assert.equal((await call('getReviewAuthor',review.id,author.token)).email,'alice@example.test');
    await call('memberLogout',alice.token);const again=await login('alice');assert.equal(again.nickname,'本機暱稱');
    assert.equal((await fetch(origin+'/__local/reset',{method:'POST',headers,body:'{}'})).status,200);
    assert.equal((await call('listCandidates')).length,30);await assert.rejects(()=>call('saveMemberDisplay',{mode:'anonymous'},again.token),/MEMBER_REQUIRED/);
    console.log('PASS local development server: same backend validation, 30 fictional shops, two simulated identities, profile/review/vote persistence on refresh, reset, private author access, origin/token guards and no bridge in deployment.');
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});

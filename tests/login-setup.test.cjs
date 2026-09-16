const assert=require('node:assert/strict'),fixture=require('./server-fixture.cjs');
const f=fixture(),b=f.box;
const plain=value=>JSON.parse(JSON.stringify(value));
assert.deepEqual(plain(b.getGoogleLoginStatus()),{configured:false});
assert.throws(()=>b.getGoogleLoginSetup(),/AUTH_REQUIRED/);
const admin=b.adminLogin(f.props.get('ADMIN_PASSPHRASE')).token;
assert(b.getGoogleLoginSetup(admin).checks.every(row=>row.status==='missing'));
f.configureGoogle();
assert.deepEqual(plain(b.getGoogleLoginStatus()),{configured:true});
assert(b.getGoogleLoginSetup(admin).checks.every(row=>row.status==='ready'));
for(const [name,bad] of [['GOOGLE_CLIENT_ID','invalid'],['GOOGLE_CLIENT_SECRET','short'],['GOOGLE_REDIRECT_URI','https://example.test/exec']]){
 const original=f.props.get(name);f.props.set(name,bad);
 assert.equal(b.getGoogleLoginStatus().configured,false);
 const result=b.getGoogleLoginSetup(admin);assert.equal(result.checks.find(r=>r.name===name).status,'invalid');
 const text=JSON.stringify(result);assert(!text.includes(f.props.get('SPREADSHEET_ID')));assert(!text.includes('fixture-google-secret-not-real'));assert(!text.includes('fixture.apps.googleusercontent.com'));
 f.props.set(name,original);
}
const member=f.issueMember();assert.throws(()=>b.getGoogleLoginSetup(member.token),/AUTH_REQUIRED/);
b.adminLogout(admin);assert.throws(()=>b.getGoogleLoginSetup(admin),/AUTH_REQUIRED/);
console.log('PASS login setup: public boolean only, missing/invalid/ready checks, no credential values, curator-only with logout enforcement.');

// Deliberately fictional records. Never import a private sheet into this fixture.
const Catalog=require('../src/catalog.js'),crypto=require('node:crypto');
module.exports=function seed(f){
  f.configureGoogle();f.props.set('ADMIN_PASSPHRASE','lunch-local-admin-only-12345');
  const b=f.box,admin=b.adminLogin('lunch-local-admin-only-12345').token;
  const origin={lat:25.0143,lng:121.4638};
  const hours=()=>Array.from({length:7},()=>({status:'open',spans:[{from:'06:00',to:'23:00'}]}));
  const shops=Catalog.foodCategories.map((category,i)=>b.addCandidate({
    name:'範例・'+category+'食堂',category,address:'板橋車站附近（虛構測試店家）',
    location:{lat:origin.lat+(i%7)*0.0009,lng:origin.lng+Math.floor(i/7)*0.001},
    budget:60+(i%6)*50,diet:category==='素食'?'vegetarian':i%4===0?'both':'meat',
    covered:i%3===0?'yes':'no',coveredOrigin:origin,weeklyHours:hours()
  },admin).record);
  b.addCandidate({name:'範例・早餐與咖啡',category:'早餐店、輕食咖啡廳',location:origin,diet:'both',budget:150,covered:'yes',coveredOrigin:origin,weeklyHours:hours()},admin);
  b.addCandidate({name:'範例・資料還沒填齊',location:origin},admin);
  b.addCandidate({name:'範例・今日公休',category:'台式',location:origin,weeklyHours:Array.from({length:7},()=>({status:'closed',spans:[]}))},admin);
  const member=f.issueMember('local-seed','seed@example.test');
  b.saveMemberDisplay({mode:'nickname',nickname:'範例食友'},member.token);
  for(const score of [-100,0,100,200])b.addReview({restaurantId:shops[0].id,item:'範例餐點 '+score,feedback:'這是用來測試畫面與操作的範例評論。',score,requestId:crypto.randomUUID()},member.token);
  b.memberLogout(member.token);b.adminLogout(admin);f.setActiveUser('');
};

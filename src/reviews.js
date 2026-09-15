(function(root){
  'use strict';
  // Original lunch-specific copy; 0 and 100 preserve the owner's wording.
  const bands=[
    {min:-100,max:-51,label:'廚餘桶都申請退貨',tone:'disaster'},
    {min:-50,max:-1,label:'我付錢，味蕾坐牢',tone:'disaster'},
    {min:0,max:19,label:'狗幹難吃',tone:'bad'},
    {min:20,max:39,label:'能吃是它唯一的才華',tone:'bad'},
    {min:40,max:59,label:'吃的是飯，吞的是委屈',tone:'neutral'},
    {min:60,max:79,label:'有料，這次先不嘴你',tone:'neutral'},
    {min:80,max:99,label:'好吃到想幫老闆洗碗',tone:'good'},
    {min:100,max:124,label:'頂上人間',tone:'good'},
    {min:125,max:149,label:'這口下去，直接原諒世界',tone:'great'},
    {min:150,max:174,label:'廚房是不是藏了小當家',tone:'great'},
    {min:175,max:199,label:'我吃一點，整盤都是我的',tone:'legend'},
    {min:200,max:200,label:'好吃到想把戶籍遷過來',tone:'legend'}
  ];
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function id(value,label='內容'){if(typeof value!=='string'||!uuid.test(value))throw Error('無法確認'+label+'，請重新開啟店家後再試。');return value.toLowerCase();}
  function visitor(value){if(typeof value!=='string'||value.length!==72||!uuid.test(value.slice(0,36))||!uuid.test(value.slice(36)))throw Error('登入資訊無效，請重新整理後再試。');return value.toLowerCase();}
  function score(value){if(typeof value!=='number'||!Number.isInteger(value)||value< -100||value>200)throw Error('分數請填 -100～200 的整數。');return value;}
  function band(value){return typeof value==='number'&&Number.isFinite(value)?bands.find(b=>value>=b.min&&value<=b.max)||null:null;}
  function text(value,max,label){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(label+'需填 1～'+max+' 字。');return value.trim();}
  function validate(input){
    if(!input||typeof input!=='object')throw Error('評論格式不正確。');
    return {restaurantId:id(input.restaurantId,'這間店'),requestId:id(input.requestId,'這次送出的評論'),item:text(input.item,100,'品項'),feedback:text(input.feedback,1500,'回饋'),score:score(input.score)};
  }
  function vote(value){if(![0,1,-1].includes(value))throw Error('投票只能是讚、踩或取消。');return value;}
  const api={bands,band,score,validate,vote,id,visitor};root.LunchReviews=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

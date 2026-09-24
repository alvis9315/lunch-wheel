const assert=require('node:assert/strict'),C=require('../src/core.js'),Catalog=require('../src/catalog.js');
for(const n of [2,21,83,200,500,4294967295]){
  for(const index of [0,Math.floor(n/2),n-1]){
    assert.equal(C.randomIndex(n,{getRandomValues:a=>{a[0]=index;}}),index);
    const landed=(360-C.rotation(index,n)%360)%360;
    assert(Math.abs(landed-(index+.5)*360/n)<1e-9,'pointer must land in chosen sector');
  }
}
for(const n of [0,1,-1,2.5,NaN,Infinity,'83',4294967296])assert.throws(()=>C.randomIndex(n));
let calls=0;
assert.equal(C.randomIndex(83,{getRandomValues:a=>{a[0]=calls++===0?4294967295:82;}}),82);
assert.equal(calls,2,'reject biased tail instead of reducing it modulo count');
const records=[{id:'a',category:'早餐店'},{id:'b',category:'牛肉麵'},{id:'c',category:'早餐店、牛肉麵'},{id:'d',category:'速食'},{id:'e',category:''}];
assert.deepEqual(records.filter(p=>Catalog.matchesTypes(p,new Set(['早餐店','牛肉麵']))).map(p=>p.id),['a','b','c']);
assert.equal(records.filter(p=>Catalog.matchesTypes(p,['all'])).length,5);
assert.deepEqual(records.filter(p=>Catalog.matchesTypes(p,['unclassified'])).map(p=>p.id),['e']);
assert.equal(Catalog.matchesTypes(records[0],[]),false);
console.log('PASS wheel selection: 2–500 shops, numeric bounds, unbiased rejection, pointer landing, OR category union without double entries.');

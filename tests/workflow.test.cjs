const assert=require('node:assert/strict'),crypto=require('node:crypto');
const Catalog=require('../src/catalog.js'),fixture=require('./server-fixture.cjs');
const f=fixture();f.box.listCandidates();
const types=['正餐','咖啡廳','甜點','冰品'];
const originals=[['原編號','店名','Google Maps 網址','地址（原文）','店家類型','葷素（原文）','店家簡介（原文）','系統店家 ID','緯度','經度','座標依據：分享連結轉址']];
for(let i=0;i<4;i++){
 const id=crypto.randomUUID();
 f.data.push([id,'測試店 '+i,'',25,121,'','其他','','unknown','[]','','','unknown','']);
 originals.push([i,'同名店','','',types[i],'','',''+id]);
}
const snapshot=JSON.stringify(f.data);
assert(JSON.parse(f.box.listCandidates('json')).every(r=>r.category==='其他'));
f.makeSheet('原始清單',originals);
let rows=JSON.parse(f.box.listCandidates('json'));
assert.deepEqual(rows.map(r=>r.category),types);
assert.equal(JSON.stringify(f.data),snapshot,'reading legacy types never rewrites RestaurantsFree');
assert.deepEqual(Catalog.typeOptions(rows).map(t=>t.label),['不限',...types]);
assert.equal(Catalog.typeOptions(rows)[0].count,4);
assert(Catalog.matchesType(rows[1],'咖啡廳'));assert(!Catalog.matchesType(rows[0],'咖啡廳'));
// Owner's explicit category always wins, and duplicate legacy IDs are not trusted.
f.data[1][6]='拉麵';assert.equal(f.box.listCandidates()[0].category,'拉麵');
originals.push([...originals[2]]);assert.equal(f.box.listCandidates()[1].category,'其他');
originals[3][4]='臆測的分類';assert.equal(f.box.listCandidates()[2].category,'其他');
f.data[4][6]='';originals[4][4]='';assert.equal(f.box.listCandidates()[3].category,'unknown');
rows=JSON.parse(f.box.listCandidates('json'));
assert.deepEqual(Catalog.typeOptions(rows).map(t=>[t.label,t.count]),[['不限',4],['拉麵',1],['尚未分類',3]]);
assert(Catalog.matchesType(rows[1],'unclassified'));assert(Catalog.matchesType(rows[3],'unclassified'));
assert(!Catalog.matchesType(rows[0],'unclassified'));
assert.deepEqual(Catalog.typeOptions([]),[{value:'all',label:'不限',count:0}]);
assert.equal(Catalog.normalizeCategory(' 冰店 '),'冰品');assert.equal(Catalog.read({category:'冰店'}).category,'冰品');
// Reordering source rows/columns does not associate a type with the wrong store.
originals.pop();originals.forEach(r=>{[r[4],r[7]]=[r[7],r[4]];});
originals[2][7]='早餐店';assert.equal(f.box.listCandidates()[1].category,'早餐店');
originals[0][4]='無效表頭';assert.equal(f.box.listCandidates()[1].category,'其他');
console.log('PASS workflow: type counts, unknowns, original type fallback by ID, duplicate protection, explicit category precedence, source header order, no source data writes.');

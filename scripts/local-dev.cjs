'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const fixture=require('../tests/server-fixture.cjs'),seed=require('./local-data.cjs');
const root=path.resolve(__dirname,'..');
const methods=new Set(['getSharedHome','listCandidates','addCandidate','adminLogin','adminLogout','getGoogleLoginStatus','getGoogleLoginSetup','beginGoogleSignIn','completeGoogleBrowserSignIn','getGoogleSignInResult','saveMemberDisplay','memberLogout','listReviews','addReview','setReviewVote','getReviewAuthor','addSuggestion','listSuggestions','completeSuggestion']);
const identities={alice:{sub:'local-alice',email:'alice@example.test',email_verified:true,name:'測試食友 A'},bob:{sub:'local-bob',email:'bob@example.test',email_verified:true,name:'測試食友 B'}};
function signature(){return ['src','apps-script','vendor'].flatMap(dir=>fs.readdirSync(path.join(root,dir)).map(file=>{const stat=fs.statSync(path.join(root,dir,file));return dir+'/'+file+':'+stat.mtimeMs+':'+stat.size;})).join('|');}
function createLocalServer({delay=200}={}){
  let f,stamp;const key=crypto.randomBytes(32).toString('hex');
  const install=()=>{f=fixture({realtime:true});seed(f);f.box.HtmlService={createHtmlOutput:html=>({html,setTitle(){return this;}})};};
  function rebuild(){
    const next=signature();if(stamp===next)return;
    const result=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,encoding:'utf8'});if(result.status!==0)throw Error(result.stderr||'本機建置失敗');
    const old=f;install();if(old){for(const [name,sheet] of old.sheets)f.makeSheet(name,structuredClone(sheet.data));f.cache.clear();for(const [k,v] of old.cache)f.cache.set(k,v);for(const [k,v] of old.props)f.props.set(k,v);}
    stamp=next;
  }
  rebuild();
  const inject=html=>html.replace('</head>','<script src="/__local/client.js" data-key="'+key+'"></script></head>');
  const send=(res,status,data,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN'});res.end(type.startsWith('application/json')?JSON.stringify(data):data);};
  const server=http.createServer(async(req,res)=>{
    try{
      const port=server.address().port,hosts=new Set(['localhost:'+port,'127.0.0.1:'+port]);
      if(!hosts.has(req.headers.host))return send(res,403,{ok:false,error:'僅限本機測試'});
      const origin='http://'+req.headers.host,url=new URL(req.url,origin);
      if(req.method==='GET'){
        if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
        if(url.pathname==='/__local/health')return send(res,200,{ok:true,mode:'local-fixture'});
        if(url.pathname==='/__local/client.js')return send(res,200,fs.readFileSync(path.join(__dirname,'local-client.js'),'utf8'),'text/javascript; charset=utf-8');
        if(url.pathname==='/'){
          rebuild();let html=inject(fs.readFileSync(path.join(root,'dist/Index.html'),'utf8'));
          html=html.replace(/(<body[^>]*>)/,'$1<section style="padding:10px 16px;background:#f2e5bf;color:#243f32;font:14px sans-serif;display:flex;gap:12px;flex-wrap:wrap;align-items:center"><strong>本機測試</strong><span>範例資料，不會寫入 Google 試算表</span><details><summary>測試說明</summary><p>用測試帳號 A／B 留評論與投票。團長測試密語：<code>lunch-local-admin-only-12345</code></p><p>重新整理保留資料；關閉測試服務後會清除。修改程式後重新整理即可。</p><button id="local-reset" type="button">恢復範例資料</button></details></section>');
          return send(res,200,html,'text/html; charset=utf-8');
        }
        const state=url.searchParams.get('state');
        if((url.pathname==='/__local/sign-in'||url.pathname==='/__local/callback')&&/^[a-f0-9-]{72}$/.test(state||'')){
          if(url.pathname==='/__local/callback')return send(res,200,inject(f.box.googleCallbackPage_({state,code:url.searchParams.get('code')}).html),'text/html; charset=utf-8');
          return send(res,200,'<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>選擇測試帳號</title><style>body{font:18px sans-serif;background:#f8f7f1;color:#243f32;padding:32px;max-width:560px;margin:auto}a{display:block;background:#243f32;color:white;padding:20px;margin:20px 0;border-radius:12px;text-decoration:none}</style></head><body><h1>選擇測試帳號</h1><p>這是本機模擬登入，不會連接 Google，也不需要輸入真實帳號或密碼。</p>'+Object.keys(identities).map(id=>'<a href="/__local/callback?state='+state+'&amp;code='+id+'">'+identities[id].name+'</a>').join('')+'</body></html>','text/html; charset=utf-8');
        }
        return send(res,404,{ok:false,error:'找不到此測試頁面'});
      }
      if(req.method!=='POST'||!['/__local/rpc','/__local/reset'].includes(url.pathname))return send(res,404,{ok:false,error:'找不到此測試操作'});
      if(req.headers['x-lunch-local']!==key||req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/json'))return send(res,403,{ok:false,error:'請由本機測試頁面操作'});
      let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>65536)return send(res,413,{ok:false,error:'測試內容過長'});body+=chunk;}
      let payload;try{payload=JSON.parse(body);}catch{return send(res,400,{ok:false,error:'測試內容格式不正確'});}
      if(url.pathname==='/__local/reset'){install();return send(res,200,{ok:true,result:true});}
      const {method,args}=payload||{};if(!methods.has(method)||!Array.isArray(args)||args.length>6)return send(res,400,{ok:false,error:'不支援此測試操作'});
      // Keep real validation, identity state, append and vote logic; only external services are simulated.
      if(method==='completeGoogleBrowserSignIn'){
        const identity=identities[args[0]?.code];if(!identity)return send(res,400,{ok:false,error:'請選擇測試帳號'});f.setIdentity(identity);
      }
      let result;try{result=f.box[method](...args);if(method==='beginGoogleSignIn')result={...result,url:origin+'/__local/sign-in?state='+result.state};}
      catch(error){return send(res,200,{ok:false,error:error.message});}
      if(delay)await new Promise(resolve=>setTimeout(resolve,delay));send(res,200,{ok:true,result});
    }catch(error){send(res,500,{ok:false,error:error.message});}
  });
  return server;
}
if(require.main===module){
  const port=Number(process.env.LUNCH_DEV_PORT||5173);if(!Number.isInteger(port)||port<1||port>65535)throw Error('LUNCH_DEV_PORT must be 1–65535');
  const server=createLocalServer();server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'本機測試網址已被使用；請先關閉先前的測試服務，或設定 LUNCH_DEV_PORT。':error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log('午餐俱樂部本機測試：http://127.0.0.1:'+port+'\n範例資料、模擬登入；不會寫入 Google 試算表。Ctrl+C 結束。'));
}
module.exports={createLocalServer};

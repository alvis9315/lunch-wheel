// Injected exclusively by the loopback development server; not in the deployment build.
(function(){
  'use strict';
  const key=document.currentScript.dataset.key;
  const post=async(path,data)=>{
    const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Lunch-Local':key},body:JSON.stringify(data)});
    const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error||'本機測試連線失敗');return body.result;
  };
  function runner(success,fail,user){
    return new Proxy({}, {get(_,method){
      if(method==='withSuccessHandler')return fn=>runner(fn,fail,user);
      if(method==='withFailureHandler')return fn=>runner(success,fn,user);
      if(method==='withUserObject')return value=>runner(success,fail,value);
      if(typeof method!=='string'||method==='then')return undefined;
      return (...args)=>{post('/__local/rpc',{method,args}).then(result=>success?.(result,user),error=>fail?fail(error,user):console.error(error));};
    }});
  }
  window.google={script:{run:runner()}};
  document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('account-google-login')?.replaceChildren('使用測試帳號登入');
    document.getElementById('local-reset')?.addEventListener('click',async event=>{
      if(!confirm('清除這次的本機評論、暱稱與投票，恢復範例資料？線上資料不受影響。'))return;
      const button=event.currentTarget;button.disabled=true;
      try{await post('/__local/reset',{});location.reload();}catch(error){alert(error.message);button.disabled=false;}
    });
  });
})();

(function(root){
  'use strict';
  root.createLunchAccountUI=function({rpc,onChange}){
    const $=id=>document.getElementById(id),dialog=$('account-dialog');
    let member=null,configured=false,flow=null,pollTimer=null,checking=false,epoch=0,expiryTimer=null;
    const flowKey=state=>'lunch-club-signin-'+state;
    function clearFlow(){if(flow)try{localStorage.removeItem(flowKey(flow.state));}catch{}flow=null;}
    function syncDisplay(){const named=$('account-mode-nickname').checked;$('account-nickname-label').hidden=!named;$('account-nickname').disabled=!named;$('account-nickname').required=named;}
    function displayValue(){return {mode:$('account-mode-nickname').checked?'nickname':'anonymous',nickname:$('account-nickname').value};}
    function feedback(text){$('account-feedback').textContent=text;}
    function render(){
      $('account-login-panel').hidden=Boolean(member);$('account-profile').hidden=!member;
      $('account-google-login').disabled=!configured;
      if(member){$('account-email').textContent=member.email;$('account-name').textContent=member.name;$('account-nickname').value=member.nickname||'';$('account-mode-nickname').checked=member.displayMode==='nickname';$('account-mode-anonymous').checked=member.displayMode!=='nickname';syncDisplay();}
      else{$('account-email').textContent='';$('account-name').textContent='';$('account-nickname').value='';}
      $('account-pending').hidden=!flow;
    }
    function notify(){render();onChange?.();}
    function configure(value){
      configured=Boolean(value);
      try{Object.keys(localStorage).filter(key=>key.startsWith('lunch-club-signin-')).forEach(key=>{let saved;try{saved=JSON.parse(localStorage.getItem(key));}catch{}if(!saved||Date.now()>=saved.expiresAt)localStorage.removeItem(key);});}catch{}
      render();
    }
    function open(){render();feedback(member?'這是新評論的預設顯示方式；每次留言都能另選匿名或暱稱。':configured?'瀏覽與抽午餐不用登入；留言、推薦店家、按讚或按爛前，請先用 Google 登入。':'Google 登入尚未準備好，請聯絡團長。');if(!dialog.open)dialog.showModal();if(flow)check();}
    function expire(){member=null;clearTimeout(expiryTimer);feedback('登入已到期，請重新用 Google 登入。');notify();}
    async function check(){
      clearTimeout(pollTimer);if(!flow||checking||!dialog.open)return;
      if(Date.now()>=flow.expiresAt){clearFlow();feedback('這次登入已逾時，請重新開始。');render();return;}
      checking=true;const request=epoch,attempt=flow;
      try{
        const result=await rpc('getGoogleSignInResult',attempt.state,attempt.pollToken,attempt.proof);
        if(request!==epoch)return;
        if(result.status==='done'){
          member=result.member;clearFlow();epoch++;
          clearTimeout(expiryTimer);expiryTimer=setTimeout(expire,Math.max(0,member.expiresAt-Date.now()));
          feedback('登入成功！可以選擇匿名或暱稱，再回去分享心得。');notify();
        }
      }catch(err){if(request===epoch){clearFlow();feedback(err.message);render();}}
      finally{checking=false;if(flow&&dialog.open&&!document.hidden)pollTimer=setTimeout(check,4000);}
    }
    async function signIn(){
      if(!configured)return;
      const request=++epoch;clearFlow();clearTimeout(pollTimer);
      // Open immediately on the click so Safari can recognize the user gesture.
      const popup=window.open('about:blank','_blank');
      if(popup)try{popup.opener=null;}catch{}
      $('account-google-login').disabled=true;feedback('正在開啟 Google 登入…');
      try{
        const proof=Array.from(crypto.getRandomValues(new Uint8Array(36)),b=>b.toString(16).padStart(2,'0')).join('');
        const result=await rpc('beginGoogleSignIn',proof);if(request!==epoch){popup?.close();return;}
        // Store only a ten-minute browser proof; never persist identity or member tokens.
        try{localStorage.setItem(flowKey(result.state),JSON.stringify({proof,expiresAt:result.expiresAt}));}catch{throw Error('瀏覽器未允許暫存登入確認資訊，請允許此網站儲存資料後再試。仍可直接瀏覽與抽午餐。');}
        flow={...result,proof};$('account-login-link').href=result.url;
        if(popup)popup.location.replace(result.url);
        feedback('請在 Google 分頁完成登入，再回到這裡。');render();check();
      }catch(err){popup?.close();feedback(err.message);render();}
    }
    $('account-google-login').addEventListener('click',signIn);
    $('account-check').addEventListener('click',check);
    $('account-cancel').addEventListener('click',()=>{epoch++;clearFlow();clearTimeout(pollTimer);render();feedback('已取消這次登入。');});
    for(const id of ['account-mode-anonymous','account-mode-nickname'])$(id).addEventListener('change',syncDisplay);
    $('account-profile').addEventListener('submit',async event=>{
      event.preventDefault();if(!member)return;const current=member,button=$('account-save');button.disabled=true;
      try{const profile=await rpc('saveMemberDisplay',displayValue(),current.token);if(member!==current)return;member={...current,...profile};notify();feedback('顯示方式已儲存。');}
      catch(err){if(err.code==='MEMBER_REQUIRED')expire();feedback(err.message);}finally{button.disabled=false;}
    });
    $('account-logout').addEventListener('click',async()=>{
      const current=member;member=null;clearTimeout(expiryTimer);notify();feedback('已登出午餐俱樂部。');
      if(current)try{await rpc('memberLogout',current.token);}catch{}
    });
    dialog.addEventListener('close',()=>clearTimeout(pollTimer));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&flow&&dialog.open)check();});
    return {configure,open,current:()=>member,invalidate:expire};
  };
})(typeof globalThis!=='undefined'?globalThis:this);

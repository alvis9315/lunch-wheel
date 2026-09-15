(function(root){
  'use strict';
  root.createLunchAccountUI=function({rpc,onChange}){
    const $=id=>document.getElementById(id),dialog=$('account-dialog');
    let member=null,configured=false,flow=null,pollTimer=null,checking=false,epoch=0,expiryTimer=null;
    function feedback(text){$('account-feedback').textContent=text;}
    function render(){
      $('account-login-panel').hidden=Boolean(member);$('account-profile').hidden=!member;
      $('account-google-login').disabled=!configured;
      if(member){$('account-email').textContent=member.email;$('account-name').textContent=member.name;$('account-nickname').value=member.nickname||'';}
      $('account-pending').hidden=!flow;
    }
    function notify(){render();onChange?.();}
    function configure(value){configured=Boolean(value);render();}
    function open(){render();feedback(member?'暱稱會顯示在之後的新評論；留空則使用 Google 名稱。':configured?'用 Google 登入後，就能分享心得、按讚或按爛。':'Google 登入尚未準備好，請聯絡名單管理者。');if(!dialog.open)dialog.showModal();if(flow)check();}
    function expire(){member=null;clearTimeout(expiryTimer);feedback('登入已到期，請重新用 Google 登入。');notify();}
    async function check(){
      clearTimeout(pollTimer);if(!flow||checking||!dialog.open)return;
      if(Date.now()>=flow.expiresAt){flow=null;feedback('這次登入已逾時，請重新開始。');render();return;}
      checking=true;const request=epoch,attempt=flow;
      try{
        const result=await rpc('getGoogleSignInResult',attempt.state,attempt.pollToken);
        if(request!==epoch)return;
        if(result.status==='done'){
          member=result.member;flow=null;epoch++;
          clearTimeout(expiryTimer);expiryTimer=setTimeout(expire,Math.max(0,member.expiresAt-Date.now()));
          feedback('登入成功！可以先設定暱稱，或直接回去分享心得。');notify();
        }
      }catch(err){if(request===epoch){flow=null;feedback(err.message);render();}}
      finally{checking=false;if(flow&&dialog.open&&!document.hidden)pollTimer=setTimeout(check,4000);}
    }
    async function signIn(){
      if(!configured)return;
      const request=++epoch;flow=null;clearTimeout(pollTimer);
      // Open immediately on the click so Safari can recognize the user gesture.
      const popup=window.open('about:blank','_blank');
      if(popup)try{popup.opener=null;}catch{}
      $('account-google-login').disabled=true;feedback('正在開啟 Google 登入…');
      try{
        const result=await rpc('beginGoogleSignIn');if(request!==epoch){popup?.close();return;}
        flow=result;$('account-login-link').href=result.url;
        if(popup)popup.location.replace(result.url);
        feedback('請在 Google 分頁完成登入，再回到這裡。');render();check();
      }catch(err){popup?.close();feedback(err.message);render();}
    }
    $('account-google-login').addEventListener('click',signIn);
    $('account-check').addEventListener('click',check);
    $('account-cancel').addEventListener('click',()=>{epoch++;flow=null;clearTimeout(pollTimer);render();feedback('已取消這次登入。');});
    $('account-profile').addEventListener('submit',async event=>{
      event.preventDefault();if(!member)return;const current=member,button=$('account-save');button.disabled=true;
      try{const profile=await rpc('saveMemberNickname',$('account-nickname').value,current.token);if(member!==current)return;member={...current,...profile};notify();feedback('暱稱已儲存。');}
      catch(err){feedback(err.message);}finally{button.disabled=false;}
    });
    $('account-logout').addEventListener('click',async()=>{
      const current=member;member=null;clearTimeout(expiryTimer);notify();feedback('已登出午餐俱樂部。');
      if(current)try{await rpc('memberLogout',current.token);}catch{}
    });
    dialog.addEventListener('close',()=>clearTimeout(pollTimer));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&flow&&dialog.open)check();});
    return {configure,open,current:()=>member,invalidate:expire,async nickname(value){if(!member)throw Error('請先用 Google 登入。');const current=member,profile=await rpc('saveMemberNickname',value,current.token);if(member!==current)throw Error('登入已變更，請重新送出。');member={...current,...profile};return member;}};
  };
})(typeof globalThis!=='undefined'?globalThis:this);

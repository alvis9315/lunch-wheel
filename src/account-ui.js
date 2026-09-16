(function(root){
  'use strict';
  root.createLunchAccountUI=function({rpc,onChange,admin}){
    const $=id=>document.getElementById(id),dialog=$('account-dialog');
    let member=null,configured=false,flow=null,pollTimer=null,checking=false,epoch=0,expiryTimer=null,setupEpoch=0;
    const flowKey=state=>'lunch-club-signin-'+state;
    function clearFlow(){if(flow)try{localStorage.removeItem(flowKey(flow.state));}catch{}flow=null;}
    function syncDisplay(){const named=$('account-mode-nickname').checked;$('account-nickname-label').hidden=!named;$('account-nickname').disabled=!named;$('account-nickname').required=named;}
    function displayValue(){return {mode:$('account-mode-nickname').checked?'nickname':'anonymous',nickname:$('account-nickname').value};}
    function feedback(text){$('account-feedback').textContent=text;}
    function render(){
      $('account-login-panel').hidden=Boolean(member);$('account-profile').hidden=!member;
      $('account-refresh-setup').hidden=Boolean(member);
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
    function access(){const active=Boolean(admin?.current());$('account-setup').hidden=!active;if(!active){setupEpoch++;$('account-setup-result').textContent='';}}
    async function refreshSetup(){
      $('account-refresh-setup').disabled=true;feedback('正在確認 Google 登入是否可用…');
      try{const result=await rpc('getGoogleLoginStatus');configure(result?.configured===true);if(dialog.open&&!member)feedback(configured?'Google 登入已開放，可以按上方按鈕登入。':'團長尚未完成 Google 登入設定。你仍可看店家、看評論與抽午餐。');}
      catch(err){if(dialog.open)feedback('暫時無法確認登入狀態，請再試一次。');}
      finally{$('account-refresh-setup').disabled=false;}
    }
    function open(){render();access();feedback(member?'這是新評論的預設顯示方式；每次留言都能另選匿名或暱稱。':configured?'瀏覽與抽午餐不用登入；留言、推薦店家、按讚或按爛前，請先用 Google 登入。':'正在確認 Google 登入…');if(!dialog.open)dialog.showModal();if(flow)check();else if(!member&&!configured)refreshSetup();}
    $('account-refresh-setup').addEventListener('click',refreshSetup);
    $('account-check-setup').addEventListener('click',async()=>{
      const session=admin?.current();if(!session)return;const request=++setupEpoch,button=$('account-check-setup');button.disabled=true;
      try{const result=await rpc('getGoogleLoginSetup',session.token);if(request!==setupEpoch||!dialog.open||admin.current()?.token!==session.token)return;
        const labels={missing:'尚未填寫',invalid:'格式需要確認',ready:'已填寫'};
        $('account-setup-result').textContent=result.checks.map(row=>row.name+'：'+labels[row.status]).join('\n')+'\n請到 Apps Script「專案設定 → 指令碼屬性」補齊設定。已填寫僅表示格式通過；仍需確認 Google 用戶端資料正確、重新導向網址與目前網站相同。';
        configure(result.configured);
      }catch(err){if(request===setupEpoch&&dialog.open)$('account-setup-result').textContent=err.message;}
      finally{button.disabled=false;}
    });
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
    function closeSetup(){clearTimeout(pollTimer);setupEpoch++;$('account-setup-result').textContent='';}
    dialog.addEventListener('close',closeSetup);dialog.addEventListener('cancel',closeSetup);dialog.querySelector('[data-close]').addEventListener('click',closeSetup);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&flow&&dialog.open)check();});
    return {configure,open,access,current:()=>member,invalidate:expire};
  };
})(typeof globalThis!=='undefined'?globalThis:this);

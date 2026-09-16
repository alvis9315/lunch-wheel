(function(root){
  'use strict';
  root.createLunchSuggestionsUI=function({rpc,account,admin,escape:e}){
    document.body.insertAdjacentHTML('beforeend','<dialog id="suggest-dialog" aria-labelledby="suggest-title"><button class="dialog-close" data-close aria-label="關閉推薦店家">×</button><p class="eyebrow">SHARE YOUR FAVORITE</p><h2 id="suggest-title">把你的愛店，推薦給大家。</h2><p>找不到喜歡的店？告訴團長，確認後就有機會加入午餐名單。</p><form id="suggest-form"><label>店名（必填）<input name="name" required maxlength="100" placeholder="請填完整店名與分店"></label><label>Google Maps 連結（必填）<input name="mapsUrl" type="url" required maxlength="1000" placeholder="https://maps.app.goo.gl/…"></label><p class="field-note">到 Google Maps 找到店家，按「分享」→「複製連結」，再貼到這裡。</p><label>為什麼推薦？（選填）<textarea name="note" maxlength="1000" rows="3" placeholder="例如：雞腿飯好吃，走路五分鐘就到"></textarea></label><p class="field-note">投稿前需 Google 登入。投稿內容與帳號只供團長查看，確認後才會加入名單；不用填位置座標。</p><button type="submit" class="primary" id="suggest-send">送出推薦 ↗</button></form><p id="suggest-feedback" role="status"></p></dialog><dialog id="suggest-inbox" aria-labelledby="suggest-inbox-title"><button class="dialog-close" data-close aria-label="關閉店家投稿">×</button><p class="eyebrow">FOR THE CLUB HOST</p><h2 id="suggest-inbox-title">大家推薦的好店</h2><p>確認店家後，再將店家加入名單。「標記已處理」只會收起這則投稿，不會自動加入轉盤。</p><button id="suggest-refresh" class="text-button">重新整理投稿</button><p id="suggest-inbox-status" role="status"></p><div id="suggest-items"></div><button id="suggest-more" class="secondary" hidden>看更多投稿</button></dialog>');
    const $=id=>document.getElementById(id),dialog=$('suggest-dialog'),form=$('suggest-form'),inbox=$('suggest-inbox');
    let posting=false,awaitingLogin=false,requestId=null,epoch=0,cursor=null,loading=false;
    const notice=text=>$('suggest-feedback').textContent=text;
    function access(){
      if(awaitingLogin&&account.current()){awaitingLogin=false;notice('登入完成，確認內容後按「送出推薦」。');}
      $('suggest-send').textContent=posting?'正在送出…':account.current()?'送出推薦 ↗':'Google 登入後投稿';
      $('suggest-inbox-button').hidden=!admin.current();
      if(!admin.current()){epoch++;loading=false;cursor=null;$('suggest-items').replaceChildren();$('suggest-inbox-status').textContent='';inbox.close();}
    }
    document.addEventListener('click',event=>{if(event.target.closest('[data-suggest]')){if(!dialog.open)dialog.showModal();access();}});
    form.addEventListener('input',()=>{requestId=null;notice('');});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(posting||!form.reportValidity())return;
      if(!account.current()){awaitingLogin=true;notice('先完成 Google 登入，再回來按「送出推薦」。填好的內容會保留。');account.open();return;}
      const value={name:form.elements.name.value,mapsUrl:form.elements.mapsUrl.value,note:form.elements.note.value,requestId:requestId||(requestId=crypto.randomUUID())};
      posting=true;form.querySelectorAll('input,textarea,button').forEach(n=>n.disabled=true);access();notice('正在把你的推薦交給團長…');
      try{const result=await rpc('addSuggestion',value,account.current().token);if(!result?.received)throw Error('暫時無法確認投稿是否成功，請稍後再試。');form.reset();requestId=null;notice(result.duplicate?'這間店已經在待確認清單裡，團長會一起查看。':'收到你的推薦了！團長確認後再加入午餐名單，謝謝你分享愛店。');}
      catch(err){if(err.code==='MEMBER_REQUIRED')account.invalidate();notice(err.message);}
      finally{posting=false;form.querySelectorAll('input,textarea,button').forEach(n=>n.disabled=false);access();}
    });
    function closeInbox(){epoch++;loading=false;cursor=null;$('suggest-items').replaceChildren();$('suggest-inbox-status').textContent='';}
    inbox.addEventListener('close',closeInbox);inbox.addEventListener('cancel',closeInbox);
    inbox.querySelector('[data-close]').addEventListener('click',closeInbox);
    function mapLink(url){try{const u=new URL(url);return u.protocol==='https:'&&['maps.app.goo.gl','goo.gl','google.com','www.google.com','google.com.tw','www.google.com.tw','maps.google.com','maps.google.com.tw'].includes(u.hostname)?'<a href="'+e(url)+'" target="_blank" rel="noopener noreferrer">到 Google Maps 看店家 ↗</a>':'<span>連結需要確認</span>';}catch{return '<span>連結需要確認</span>';}}
    async function load(more=false){
      const session=admin.current();if(!session||loading)return;const task=++epoch;loading=true;$('suggest-refresh').disabled=true;$('suggest-more').disabled=true;$('suggest-inbox-status').textContent='正在查看大家的推薦…';
      try{const result=await rpc('listSuggestions',session.token,more?cursor:null);if(task!==epoch||!inbox.open||admin.current()?.token!==session.token)return;
        if(!more)$('suggest-items').replaceChildren();
        $('suggest-items').insertAdjacentHTML('beforeend',result.items.map(r=>'<article class="suggest-card"><h3>'+e(r.name)+'</h3>'+mapLink(r.mapsUrl)+'<p class="suggest-note">'+e(r.note||'沒有另外補充')+'</p><small>投稿帳號：'+e(r.email)+'</small><button class="secondary" data-suggest-done="'+e(r.id)+'">標記已處理</button></article>').join(''));
        cursor=result.nextCursor;$('suggest-more').hidden=!cursor;$('suggest-inbox-status').textContent=result.total?'有 '+result.total+' 間店等你確認。':'目前沒有待確認的投稿。';
      }catch(err){if(task===epoch){if(err.code==='AUTH_REQUIRED')admin.invalidate();else $('suggest-inbox-status').textContent=err.message;}}
      finally{if(task===epoch){loading=false;$('suggest-refresh').disabled=false;$('suggest-more').disabled=false;}}
    }
    $('suggest-inbox-button').addEventListener('click',()=>{if(!admin.current())return;inbox.showModal();load();});
    $('suggest-refresh').addEventListener('click',()=>load());$('suggest-more').addEventListener('click',()=>load(true));
    $('suggest-items').addEventListener('click',async event=>{const button=event.target.closest('[data-suggest-done]'),session=admin.current();if(!button||button.disabled||loading||!session)return;button.disabled=true;
      const task=epoch;try{await rpc('completeSuggestion',button.dataset.suggestDone,session.token);if(task===epoch&&inbox.open&&admin.current()?.token===session.token)await load();}catch(err){if(task===epoch){if(err.code==='AUTH_REQUIRED')admin.invalidate();else $('suggest-inbox-status').textContent=err.message;}}finally{if(button.isConnected)button.disabled=false;}
    });
    return {access};
  };
})(window);

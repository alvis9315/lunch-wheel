(function(root){
  'use strict';
  root.createLunchReviewUI=function({rpc,escape:e,account,admin}){
    const R=root.LunchReviews,drafts=new Map();
    let generation=0,refreshAdminView=null;
    function clearPrivateView(){document.querySelectorAll('.review-admin').forEach(node=>node.remove());}
    function dispose(){generation++;refreshAdminView=null;clearPrivateView();}
    function mount(host,restaurantId){
      const version=++generation,token=account.current()?.token||null;let reviews=[],cursor=null,loading=false,posting=false,voting=false,loadEpoch=0;
      const alive=()=>version===generation&&host.isConnected;
      const find=selector=>host.querySelector(selector);
      const draft=drafts.get(restaurantId)||{item:'',feedback:'',score:'60',requestId:null};drafts.set(restaurantId,draft);
      const member=account.current();
      if(draft.memberToken!==token){draft.memberToken=token;draft.mode=member?.displayMode||'anonymous';draft.nickname=member?.nickname||'';}
      host.innerHTML='<div class="review-heading"><div><p class="eyebrow">NO FILTER. JUST FLAVOR.</p><h3>吃過的人，出來說兩句。</h3></div><span class="review-stamp" aria-hidden="true">食後<br>有感</span></div>'+
        '<div class="review-summary" role="status">正在讀取大家的真心話…</div><p class="field-note">本站食友的品項心得，分數不是 Google 評分。符合條件的每間店，抽中的機會都相同。</p>'+
        '<details class="review-compose"><summary>＋ 我吃過，讓我說</summary><form class="review-form">'+
        '<div class="review-identity">'+(member?'<fieldset class="display-choice"><legend>這則評論怎麼顯示？</legend><label><input type="radio" name="displayMode" value="anonymous" '+(draft.mode!=='nickname'?'checked':'')+'> 匿名</label><label><input type="radio" name="displayMode" value="nickname" '+(draft.mode==='nickname'?'checked':'')+'> 自訂暱稱</label></fieldset><label class="review-nickname-label">顯示的暱稱<input name="nickname" maxlength="32" placeholder="食友要怎麼稱呼你？" value="'+e(draft.nickname)+'"></label><p class="field-note">匿名時，其他食友只會看到「匿名食友」。團長仍可查看你的 Google 帳號與這則留言填寫的暱稱。</p>':'<p>瀏覽心得不用登入；想分享、按讚或按爛時再登入即可。</p><button type="button" class="secondary review-login">使用 Google 帳戶登入</button>')+'</div>'+
        '<label>01 · 品項<input name="item" required maxlength="100" placeholder="例如：雞腿飯" value="'+e(draft.item)+'"></label>'+
        '<label>02 · 回饋<textarea name="feedback" required maxlength="1500" rows="3" placeholder="便當菜不好吃，雞腿太小隻很盤">'+e(draft.feedback)+'</textarea><small class="review-char-count"></small></label>'+
        '<fieldset class="review-score-editor"><legend>03 · 分數</legend><div class="score-readout"><span class="score-mood" aria-live="polite"></span><label class="score-number-label">直接輸入<input name="score" type="number" min="-100" max="200" step="1" required value="'+e(draft.score)+'" aria-label="直接輸入分數"></label></div>'+
        '<input class="score-slider" type="range" min="-100" max="200" step="1" value="60" aria-label="評分滑桿"><div class="score-ticks"><span>−100 · 退貨</span><span>0 · 難吃</span><span>100 · 頂上人間</span><span>200 · 封神</span></div>'+
        '<details class="score-guide"><summary>看完整嘴砲分級表</summary><ul>'+R.bands.map(b=>'<li><b>'+b.min+(b.max===b.min?'':'～'+b.max)+'</b><span>'+e(b.label)+'</span></li>').join('')+'</ul></details></fieldset>'+
        '<p class="field-note">品項、回饋與分數必填。選擇自訂暱稱時需填寫名稱；Google 名稱和帳號不會自動顯示給其他食友。</p><button class="primary review-submit" type="submit">送出這口真心話 ↗</button></form></details>'+
        '<p class="review-feedback" role="status" hidden></p><div class="review-list-heading"><h4>食友實話區</h4><button type="button" class="text-button review-refresh">重新整理評論</button></div>'+
        '<p class="field-note">最新評論在前。對這則回饋按讚或爛；同一帳號可改票，再按一次取消。'+'</p><div class="review-list" aria-live="polite"></div><button type="button" class="secondary review-more" hidden>更多真心話 ↓</button>';
      find('.review-login')?.addEventListener('click',()=>account.open());
      find('.review-compose>summary').addEventListener('click',event=>{if(!account.current()){event.preventDefault();draft.wantsCompose=true;account.open();}});
      if(member&&draft.wantsCompose){find('.review-compose').open=true;draft.wantsCompose=false;}
      const form=find('.review-form'),number=form.elements.namedItem('score'),slider=find('.score-slider');
      function syncDisplay(){const input=form.elements.namedItem('nickname');if(!input)return;const named=form.elements.namedItem('displayMode').value==='nickname';input.required=named;input.disabled=!named||posting;find('.review-nickname-label').hidden=!named;}
      function notice(text,error=false){if(!alive())return;const node=find('.review-feedback');node.textContent=text;node.hidden=false;node.classList.toggle('error',error);}
      function syncScore(){
        const value=number.value===''?NaN:Number(number.value),band=Number.isInteger(value)?R.band(value):null;
        find('.score-mood').textContent=band?band.label:'請填 -100～200 的整數';
        find('.score-readout').dataset.tone=band?.tone||'neutral';
        if(band){slider.value=String(value);slider.setAttribute('aria-valuetext',value+' 分，'+band.label);}
        find('.review-char-count').textContent=form.elements.namedItem('feedback').value.length+' / 1500';
      }
      function saveDraft(){draft.item=form.elements.namedItem('item').value;draft.feedback=form.elements.namedItem('feedback').value;draft.score=number.value;draft.mode=form.elements.namedItem('displayMode')?.value||'anonymous';draft.nickname=form.elements.namedItem('nickname')?.value||'';draft.requestId=null;syncScore();syncDisplay();}
      form.addEventListener('input',event=>{if(event.target===slider)number.value=slider.value;saveDraft();});syncScore();syncDisplay();
      function dateText(iso){const date=new Date(iso);return Number.isNaN(date.getTime())?'時間未提供':new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(date);}
      function cards(){
        if(!alive())return;
        find('.review-list').innerHTML=reviews.map(r=>{
          const band=R.band(r.score),label=band?.label||'分數待確認';
          return '<article class="review-card" data-review="'+e(r.id)+'"><div class="review-card-top"><h4>'+e(r.item)+'</h4><div class="review-score" data-tone="'+e(band?.tone||'neutral')+'"><strong>'+r.score+'<small> 分</small></strong><span>'+e(label)+'</span></div></div><p class="review-body">'+e(r.feedback)+'</p><div class="review-card-bottom"><small>'+e(r.authorLabel||'匿名食友')+' · '+e(dateText(r.createdAt))+'</small><div class="review-votes" aria-label="評論投票"><button type="button" data-vote="1" data-id="'+e(r.id)+'" aria-pressed="'+(r.myVote===1)+'" aria-label="讚這則評論'+(r.myVote===1?'，再按取消':'')+'">👍 讚 <b>'+r.likes+'</b></button><button type="button" data-vote="-1" data-id="'+e(r.id)+'" aria-pressed="'+(r.myVote===-1)+'" aria-label="爛這則評論'+(r.myVote===-1?'，再按取消':'')+'">👎 爛 <b>'+r.dislikes+'</b></button></div></div>'+(admin?.current()?'<section class="review-admin"><button type="button" class="text-button" data-author="'+e(r.id)+'" aria-expanded="false">查看留言者帳號（團長）</button><div class="review-author" hidden></div></section>':'')+'</article>';
        }).join('')||'<div class="empty-state">這間還沒有評論。<br>吃過什麼？你的第一口情報很重要。</div>';
        find('.review-more').hidden=!cursor;
      }
      refreshAdminView=()=>{if(alive())cards();};
      find('.review-list').addEventListener('click',async event=>{
        const button=event.target.closest('[data-author]');if(!button||button.disabled)return;
        const current=admin?.current(),panel=button.nextElementSibling;if(!current)return;
        if(!panel.hidden){panel.replaceChildren();panel.hidden=true;button.setAttribute('aria-expanded','false');return;}
        button.disabled=true;button.textContent='正在確認留言者…';
        try{
          const author=await rpc('getReviewAuthor',button.dataset.author,current.token);
          if(!alive()||!button.isConnected||admin.current()?.token!==current.token)return;
          panel.innerHTML='<p><strong>僅團長可見</strong></p><p>其他食友看到的名稱：'+e(author.publicName)+'</p><p>填寫暱稱：'+e(author.nickname||'未填寫')+'</p><p>Google 帳號：'+e(author.email||'舊匿名評論，未留存帳號')+'</p>';
          panel.hidden=false;button.setAttribute('aria-expanded','true');
        }catch(err){if(err.code==='AUTH_REQUIRED')admin.invalidate();notice(err.message,true);}
        finally{if(button.isConnected){button.disabled=false;button.textContent='查看留言者帳號（團長）';}}
      });
      async function load(more=false){
        if(!alive()||loading||voting)return;loading=true;const epoch=++loadEpoch;
        find('.review-refresh').disabled=true;find('.review-more').disabled=true;
        find('.review-submit').disabled=true;
        try{
          const data=await rpc('listReviews',restaurantId,token,more?cursor:null);
          if(!alive()||epoch!==loadEpoch)return;
          if(!data||!Array.isArray(data.reviews)||!data.summary||!Number.isInteger(data.summary.count)||data.summary.count<0||(data.summary.count>0&&!Number.isFinite(data.summary.average)))throw Error('這次沒有讀取到完整的心得，請再試一次。');
          reviews=more?[...reviews,...data.reviews.filter(r=>!reviews.some(old=>old.id===r.id))]:data.reviews;cursor=data.nextCursor;
          const s=data.summary;find('.review-summary').innerHTML=s.count?'<strong>'+s.average.toFixed(1)+'<small> 分</small></strong><span>'+s.count+' 則品項心得的平均<br><b>'+e(R.band(Math.round(s.average))?.label||'')+'</b></span>':'<span>尚未有人評分，等你開第一槍。</span>';
          cards();
          if(data.unavailableCount>0)notice('有部分心得或投票資料不完整，暫未計入，請團長確認。',true);
        }catch(err){if(err.code==='MEMBER_REQUIRED')account.invalidate();if(alive()){find('.review-summary').textContent='評論暫時讀取失敗';notice(err.message,true);}}
        finally{if(alive()){loading=false;find('.review-refresh').disabled=false;find('.review-more').disabled=false;find('.review-submit').disabled=posting||!account.current();}}
      }
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(posting||loading||voting||!form.reportValidity())return;if(!account.current()){account.open();return;}
        let input;try{if(number.value==='')throw Error('請輸入分數。');input={...R.validate({restaurantId,item:form.elements.namedItem('item').value,feedback:form.elements.namedItem('feedback').value,score:Number(number.value),requestId:draft.requestId||(draft.requestId=crypto.randomUUID())}),display:{mode:form.elements.namedItem('displayMode').value,nickname:form.elements.namedItem('nickname').value}};}catch(err){notice(err.message,true);return;}
        posting=true;form.querySelectorAll('input,textarea,button').forEach(node=>node.disabled=true);find('.review-submit').textContent='正在送出…';
        try{
          const result=await rpc('addReview',input,account.current()?.token);
          if(draft.requestId===input.requestId){draft.item='';draft.feedback='';draft.score='60';draft.requestId=null;}
          if(!alive())return;
          form.elements.namedItem('item').value=draft.item;form.elements.namedItem('feedback').value=draft.feedback;number.value=draft.score;syncScore();find('.review-compose').open=false;
          notice(result.duplicate?'這則已送出，沒有重複新增。':'真心話已收下，謝謝你幫大家探路。');await load();
        }catch(err){if(err.code==='MEMBER_REQUIRED')account.invalidate();notice(err.message,true);}
        finally{if(alive()){posting=false;form.querySelectorAll('input,textarea,button').forEach(node=>node.disabled=false);syncDisplay();find('.review-submit').textContent='送出這口真心話 ↗';}}
      });
      find('.review-list').addEventListener('click',async event=>{
        const button=event.target.closest('button[data-vote]');if(!button||button.disabled||loading||voting||posting)return;if(!account.current()){account.open();return;}
        const review=reviews.find(r=>r.id===button.dataset.id);if(!review)return;
        const value=review.myVote===Number(button.dataset.vote)?0:Number(button.dataset.vote);
        voting=true;find('.review-list').querySelectorAll('button').forEach(b=>b.disabled=true);
        find('.review-refresh').disabled=true;find('.review-more').disabled=true;find('.review-submit').disabled=true;
        try{const result=await rpc('setReviewVote',review.id,value,account.current()?.token);if(alive()){Object.assign(review,result);cards();notice(value===0?'已取消這則投票。':value===1?'這則回饋，你按讚。':'這則回饋，你不買單。');}}
        catch(err){if(err.code==='MEMBER_REQUIRED')account.invalidate();notice(err.message,true);}
        finally{if(alive()){voting=false;cards();find('.review-refresh').disabled=false;find('.review-more').disabled=false;find('.review-submit').disabled=false;}}
      });
      find('.review-refresh').addEventListener('click',()=>{if(!posting)load();});find('.review-more').addEventListener('click',()=>{if(!posting)load(true);});load();
    }
    return {mount,dispose,refreshAdmin(){clearPrivateView();refreshAdminView?.();}};
  };
})(window);

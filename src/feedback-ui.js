(function(root){
  'use strict';
  root.createLunchLoading=function(){
    const node=document.getElementById('app-loading'),tasks=new Map(),dialogStack=[];let serial=0,hideTimer;
    const position=()=>{const focused=document.activeElement?.closest('dialog[open]'),parent=focused||dialogStack.filter(d=>d.open).at(-1)||document.body;if(node.parentNode!==parent)parent.append(node);};
    const draw=()=>{clearTimeout(hideTimer);if(tasks.size){position();node.hidden=false;node.querySelector('span').textContent=[...tasks.values()].at(-1);}else hideTimer=setTimeout(()=>{node.hidden=true;},180);};
    new MutationObserver(records=>{for(const {target} of records){if(target.tagName!=='DIALOG')continue;const i=dialogStack.indexOf(target);if(i>=0)dialogStack.splice(i,1);if(target.open)dialogStack.push(target);}if(tasks.size)position();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
    return {begin(label='正在載入，請稍候…'){
      const id=++serial;tasks.set(id,label);draw();let ended=false;
      return ()=>{if(ended)return;ended=true;tasks.delete(id);draw();};
    }};
  };
  root.createLunchReviewConfirmation=function(escape){
    const dialog=document.getElementById('review-confirm-dialog'),preview=document.getElementById('review-confirm-preview');let finish=null;
    const close=accepted=>{const done=finish;finish=null;dialog.close();preview.replaceChildren();done?.(accepted);};
    document.getElementById('review-confirm-send').addEventListener('click',()=>close(true));
    document.getElementById('review-confirm-cancel').addEventListener('click',()=>close(false));
    dialog.addEventListener('cancel',()=>close(false));dialog.addEventListener('close',()=>{if(!dialog.open&&finish)close(false);});
    return {cancel:()=>close(false),ask(input){close(false);return new Promise(resolve=>{
      finish=resolve;preview.innerHTML='<dl><dt>顯示名稱</dt><dd>'+escape(input.display.mode==='nickname'?input.display.nickname:'匿名食友')+'</dd><dt>品項</dt><dd>'+escape(input.item)+'</dd><dt>回饋</dt><dd class="confirm-review-text">'+escape(input.feedback)+'</dd><dt>分數</dt><dd>'+input.score+' 分</dd></dl>';
      dialog.showModal();document.getElementById('review-confirm-cancel').focus();
    });}};
  };
})(window);

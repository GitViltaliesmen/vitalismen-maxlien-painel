(() => {
 'use strict';
 const dashboard=document.getElementById('dashboard');if(!dashboard)return;
 const dialog=document.createElement('dialog');dialog.id='waIncomingDialogV226';dialog.setAttribute('aria-labelledby','waIncomingTitleV226');
 dialog.innerHTML='<header><h2 id="waIncomingTitleV226">WhatsApp recebido</h2><button type="button" data-close>Fechar ×</button></header><p data-status role="status"></p><nav aria-label="Conversas recebidas"></nav><section aria-label="Mensagem recebida"><h3></h3><time></time><p data-body></p></section><footer><button type="button" data-attend>Abrir no atendimento</button><small>O atendimento principal continua disponível. Este aviso não envia mensagens nem marca a conversa como lida.</small></footer>';
 dashboard.append(dialog);
 const launcher=document.createElement('button');launcher.type='button';launcher.id='waIncomingLauncherV226';launcher.hidden=true;dashboard.append(launcher);
 const get=selector=>dialog.querySelector(selector),queue=new Map(),seen=new Map(),signatures=new Map();let credential='',busy=false,pending=null,selected='',controller=null,epoch=0;
 const token=()=>typeof state!=='undefined'?String(state.token||''):'';
 const active=()=>!!token()&&!dashboard.classList.contains('hidden')&&!document.hidden;
 const phone=chat=>String(chat.phone||chat.id||'').replace(/\D/g,'');
 const valid=chat=>!chat.isGroup&&!/@g\.us|@lid|status@broadcast/.test(String(chat.id||''))&&(/^(593)\d{8,10}$/.test(phone(chat))||phone(chat)==='5515998038637');
 const seconds=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?(n>1e12?n/1000:n):Date.parse(value)/1000||0};
 const meta=message=>({id:String(message._id||message.id?._serialized||message.id||''),at:seconds(message.timestamp),body:String(message.body||'')});
 const msgKey=m=>m.id||`${m.at}:${m.body}`;
 const currentPhone=()=>typeof state!=='undefined'&&state.selectedChat?phone(state.selectedChat):'';
 function close(){if(dialog.open)dialog.close()}
 function clear(){epoch++;controller?.abort();pending=null;queue.clear();seen.clear();signatures.clear();selected='';close();get('nav').replaceChildren();get('[data-body]').textContent='';get('h3').textContent='';get('time').textContent='';get('[data-status]').textContent='';launcher.hidden=true}
 function render(){
  launcher.textContent=`WhatsApp recebido (${queue.size})`;launcher.hidden=queue.size===0;
  const rows=[...queue.values()].sort((a,b)=>b.message.at-a.message.at);get('nav').replaceChildren();
  for(const item of rows){const button=document.createElement('button');button.type='button';button.textContent=item.name;button.setAttribute('aria-pressed',String(item.phone===selected));button.addEventListener('click',()=>{selected=item.phone;render()});get('nav').append(button)}
  const row=queue.get(selected)||rows[0];if(!row)return;selected=row.phone;get('h3').textContent=row.name;get('time').textContent=new Date(row.message.at*1000).toLocaleString();get('time').dateTime=new Date(row.message.at*1000).toISOString();
  get('[data-body]').textContent=row.message.body||(row.type==='ptt'||row.type==='audio'?'Áudio recebido. Abra no atendimento para ouvir.':'Mídia recebida. Abra no atendimento para visualizar.');get('[data-status]').textContent='Nova mensagem recebida pelo WhatsApp.';
 }
 function open(){document.dispatchEvent(new CustomEvent('vitalismen:incoming-popup-open-v226',{detail:{source:'whatsapp'}}));render();if(queue.size&&!dialog.open)dialog.setAttribute('open','')}
 async function process(chats){
  if(!active())return;const key=token();if(credential!==key){clear();credential=key}
  pending=chats;if(busy)return;busy=true;
  try{while(pending&&active()){
   const rows=pending;pending=null;const run=epoch;controller=new AbortController();
   const candidates=rows.filter(valid).filter(c=>(Number(c.unreadCount)>0||seconds(c.lastInboundAt)>Date.now()/1000-900||(c.lastMessage?.isFromMe===false&&seconds(c.lastMessage?.timestamp)>Date.now()/1000-900))&&phone(c)!==currentPhone()).sort((a,b)=>seconds(b.lastMessage?.timestamp)-seconds(a.lastMessage?.timestamp)).slice(0,20);
   let changed=false;
   for(const chat of candidates){
    const p=phone(chat),signature=JSON.stringify([chat.unreadCount,chat.lastInboundAt,chat.lastMessage?.timestamp,chat.lastMessage?.body,chat.lastMessage?.isFromMe]);if(signatures.get(p)===signature)continue;
    try{
     const response=await fetch(`/api/whatsapp/messages/${encodeURIComponent(p)}?fast=1&limit=20`,{method:'GET',headers:{Authorization:`Bearer ${key}`},cache:'no-store',signal:controller.signal});
     if(!response.ok){if(response.status===401||response.status===403){clear();return}continue}
     const history=await response.json();if(run!==epoch||token()!==key||!active())return;
     if(!Array.isArray(history))continue;
     const incoming=history.filter(m=>m.isFromMe===false).sort((a,b)=>seconds(b.timestamp)-seconds(a.timestamp))[0];if(!incoming)continue;
     const message=meta(incoming),id=msgKey(message);signatures.set(p,signature);
     if(message.at<Date.now()/1000-86400||seen.get(p)===id)continue;
     seen.set(p,id);queue.set(p,{phone:p,id:chat.id,name:String(chat.name||chat.phone||p),type:incoming.type,message});changed=true;
    }catch(error){if(error.name==='AbortError')return}
   }
   for(const [p]of queue){const row=rows.find(c=>phone(c)===p);if(!row||p===currentPhone())queue.delete(p)}
   while(queue.size>20)queue.delete(queue.keys().next().value);
   if(changed&&queue.size){selected=[...queue.values()].sort((a,b)=>b.message.at-a.message.at)[0].phone;open()}else if(queue.size)render();else{close();launcher.hidden=true}
  }}finally{busy=false;controller=null}
 }
 get('[data-close]').addEventListener('click',close);launcher.addEventListener('click',open);
 get('[data-attend]').addEventListener('click',async()=>{
  const item=queue.get(selected);if(!item||!active())return;
  if(document.getElementById('messageInput')?.value.trim()&&currentPhone()!==item.phone){get('[data-status]').textContent='Há um rascunho no atendimento atual. Conclua ou guarde esse texto antes de trocar de cliente.';return}
  if(typeof selectChat!=='function')return;close();await selectChat(item.id,{markRead:true});queue.delete(item.phone);render();if(!queue.size)launcher.hidden=true;
 });
 document.addEventListener('vitalismen:whatsapp-chats-loaded-v226',event=>process(Array.isArray(event.detail)?event.detail:[]));
 document.addEventListener('vitalismen:incoming-popup-open-v226',event=>{if(event.detail?.source!=='whatsapp')close()});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog.open)close()});
 document.getElementById('logoutBtn')?.addEventListener('click',()=>{clear();credential=''});
 new MutationObserver(()=>{if(dashboard.classList.contains('hidden')){clear();credential=''}}).observe(dashboard,{attributes:true,attributeFilter:['class']});
})();

(() => {
 'use strict';
 const byId=id=>document.getElementById(id), dialog=byId('webChatDashboardDialogV222'), button=byId('webChatDashboardBtnV222'), list=byId('webChatDashboardListV222'), thread=byId('webChatDashboardThreadV222'), status=byId('webChatDashboardStatusV222'), dashboard=byId('dashboard');
 let generation=0,controller=null,selected=null,resumeId=null,activity=0;
 let timer=null,pollController=null,pollBusy=false,initialized=false,watchCredential='',deniedCredential='';
 const seen=new Map(), unread=new Set(), token=()=>typeof state!=='undefined'?state.token:'';
 const element=(tag,text,css)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(css)el.className=css;return el};
 const format=value=>{const d=new Date(value);return value&&Number.isFinite(+d)?d.toLocaleString('pt-BR'):'Horário indisponível'};
 const label=row=>row.name||'Visitante · '+String(row.id).slice(0,6);
 const summary=row=>({messageCount:row.messageCount,lastAt:row.lastAt});
 const eligible=()=>!document.hidden&&!dashboard.classList.contains('hidden')&&!!token()&&typeof state!=='undefined'&&state.user?.role==='admin'&&token()!==deniedCredential;
 function cancel(){generation++;controller?.abort();controller=null;}
 function remember(row){if(initialized)seen.set(row.id,summary(row));}
 async function request(suffix,signal){
  const credential=token();if(!credential)throw Error('Entre no painel como administrador para consultar as conversas do site.');
  const response=await fetch('/api/web-chat-admin/vitpower'+suffix,{method:'GET',cache:'no-store',credentials:'same-origin',headers:{Authorization:'Bearer '+credential},signal});
  if(response.status===401||response.status===403)throw Object.assign(Error('Acesso restrito a administrador autenticado. Sua conversa atual permanece aberta.'),{authDenied:true});
  if(response.status===404)throw Object.assign(Error('Esta conversa expirou ou foi removida pelo visitante. Atualize a lista.'),{notFound:true});
  if(!response.ok)throw Error('Não foi possível consultar o chat do site. Tente atualizar.');
  return response.json();
 }
 function renderList(rows){
  list.replaceChildren();
  for(const row of rows){const item=element('button');item.type='button';item.dataset.id=row.id;item.setAttribute('aria-pressed',String(row.id===selected));item.append(element('strong',label(row)),element('small',format(row.lastAt)),element('small',row.messageCount+' mensagens'));if(unread.has(row.id))item.append(element('small','Nova mensagem','vp226-new'));item.addEventListener('click',()=>{activity++;select(row)});list.append(item)}
 }
 function renderConversation(conversation,newMessage=false){
  selected=conversation.id;resumeId=conversation.id;unread.delete(conversation.id);for(const item of list.querySelectorAll('button'))if(item.dataset.id===conversation.id)item.querySelector('.vp226-new')?.remove();thread.replaceChildren(element('h3',label(conversation)));
  for(const item of list.querySelectorAll('button'))item.setAttribute('aria-pressed',String(item.dataset.id===selected));
  if(conversation.city||conversation.quantity)thread.append(element('p',[conversation.city,conversation.quantity?conversation.quantity+' frasco(s) informado(s)':''].filter(Boolean).join(' · ')));
  for(const message of conversation.history){const bubble=element('div',undefined,'vpweb222-bubble');bubble.dataset.role=message.role;bubble.append(element('span',message.content),element('small',(message.role==='assistant'?'Ana Lopez':'Visitante')+' · '+format(message.at)));thread.append(bubble)}
  remember(conversation);status.textContent=newMessage?'Nova mensagem do site. Você pode continuar o atendimento no painel.':'Consulta atualizada. Nenhuma mensagem é enviada por este chat.';thread.scrollTop=thread.scrollHeight;
 }
 async function select(row){
  cancel();const current=generation;controller=new AbortController();selected=row.id;resumeId=row.id;thread.replaceChildren();status.textContent='Carregando conversa…';
  for(const item of list.querySelectorAll('button'))item.setAttribute('aria-pressed',String(item.dataset.id===row.id));
  try{const data=await request('/'+encodeURIComponent(row.id),controller.signal);if(current!==generation||!dialog.open)return;renderConversation(data.conversation)}
  catch(error){if(current===generation&&error.name!=='AbortError')status.textContent=error.message}
 }
 async function load(){
  cancel();const current=generation;controller=new AbortController();selected=null;list.replaceChildren();thread.replaceChildren(element('p','Selecione uma conversa do site.'));status.textContent='Consultando conversas…';
  try{const data=await request('',controller.signal);if(current!==generation||!dialog.open)return;renderList(data.conversations);
   status.textContent=data.conversations.length?data.conversations.length+' conversa(s) disponível(is). Selecione um visitante.':'Nenhuma conversa do site com mensagens nos últimos 7 dias.';
   const previous=data.conversations.find(row=>row.id===resumeId);if(previous)await select(previous);else resumeId=null;
  }catch(error){if(current===generation&&error.name!=='AbortError')status.textContent=error.message}
 }
 function stop(reset=false){clearTimeout(timer);timer=null;pollController?.abort();if(reset){seen.clear();unread.clear();initialized=false;watchCredential='';deniedCredential='';resumeId=null}}
 function schedule(delay=10000){clearTimeout(timer);timer=null;if(!document.hidden&&!dashboard.classList.contains('hidden')&&token())timer=setTimeout(tick,delay);}
 async function tick(){
  if(pollBusy){schedule();return}
  if(!eligible()){schedule();return}
  const credential=token(),epoch=activity;
  if(watchCredential!==credential){seen.clear();initialized=false;watchCredential=credential}
  pollBusy=true;pollController=new AbortController();const signal=pollController.signal;
  try{
   const data=await request('',signal);if(signal.aborted||token()!==credential||!eligible())return;
   const rows=data.conversations;
   if(!initialized){for(const row of rows)seen.set(row.id,summary(row));initialized=true;button.title='Chat do site — avisos ativos';return}
   const changed=rows.filter(row=>{const old=seen.get(row.id);return !old||old.lastAt!==row.lastAt||old.messageCount!==row.messageCount}).slice(0,5);
   let incoming=null;const updates=[];
   for(const row of changed){
    let detail;try{detail=(await request('/'+encodeURIComponent(row.id),signal)).conversation}catch(error){if(error.notFound)continue;throw error}
    if(signal.aborted||token()!==credential||!eligible()||activity!==epoch)return;
    const old=seen.get(row.id),user=detail.history.filter(message=>message.role==='user').at(-1);
    const newer=!!user&&(!old||Date.parse(user.at)>Date.parse(old.lastAt)||(user.at===old.lastAt&&row.messageCount>=old.messageCount+2));
    updates.push({row,detail,newer});
    if(newer&&(!incoming||String(user.at)>String(incoming.at)))incoming={conversation:detail,at:user.at};
   }
   for(const update of updates){seen.set(update.row.id,summary(update.row));if(update.newer)unread.add(update.row.id);else if(dialog.open&&selected===update.row.id)renderConversation(update.detail)}
   const ids=new Set(rows.map(row=>row.id));for(const id of seen.keys())if(!ids.has(id)){seen.delete(id);unread.delete(id)}
   if(incoming&&eligible()&&activity===epoch){
    cancel();
    // Setting open keeps this nonmodal and leaves the operator's keyboard focus untouched.
    document.dispatchEvent(new CustomEvent('vitalismen:incoming-popup-open-v226',{detail:{source:'website'}}));
    if(!dialog.open)dialog.setAttribute('open','');
    renderList(rows);renderConversation(incoming.conversation,true);
   }
   button.title='Chat do site — avisos ativos';
  }catch(error){if(error.name!=='AbortError'){if(error.authDenied)deniedCredential=credential;button.title='Chat do site — atualização automática indisponível';}}
  finally{pollBusy=false;pollController=null;schedule();}
 }
 button.addEventListener('click',()=>{activity++;document.dispatchEvent(new CustomEvent('vitalismen:incoming-popup-open-v226',{detail:{source:'website'}}));if(!dialog.open)dialog.show();load()});
 byId('webChatDashboardRefreshV222').addEventListener('click',()=>{activity++;load()});
 function clearViewer(){activity++;cancel();selected=null;list.replaceChildren();thread.replaceChildren();status.textContent=''}
 function closeViewer(){if(dialog.open)dialog.close();clearViewer()}
 byId('webChatDashboardCloseV222').addEventListener('click',closeViewer);
 dialog.addEventListener('close',()=>{if(!dialog.open)clearViewer()});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog.open&&!event.defaultPrevented)closeViewer();});
 byId('logoutBtn')?.addEventListener('click',()=>{activity++;stop(true);cancel();closeViewer()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else schedule(0)});
 new MutationObserver(()=>{if(dashboard.classList.contains('hidden')){stop(true);if(dialog.open)closeViewer()}else schedule(0)}).observe(dashboard,{attributes:true,attributeFilter:['class']});
 window.addEventListener('pagehide',()=>stop());window.addEventListener('pageshow',()=>schedule(0));
 document.addEventListener('vitalismen:incoming-popup-open-v226',event=>{if(event.detail?.source!=='website'&&dialog.open)closeViewer()});
 schedule(0);
})();

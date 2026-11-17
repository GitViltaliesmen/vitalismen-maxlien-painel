/* PROJECT=VITALISMEN_EC. No analytics on this one-use credential exchange. */
(function(w,d){'use strict';
var match=/^#pedido=([a-f0-9]{64})$/.exec(w.location.hash), token=match?match[1]:'';
w.history.replaceState(null,'',w.location.pathname);
var status=d.getElementById('access-state');
function request(body){return w.fetch('/api/vitpower-chat',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)}).then(function(r){return r.json().then(function(v){if(!r.ok||!v.ok)throw Error('unavailable');return v;});});}
if(!token){status.textContent='Abre el enlace privado que recibiste en tu WhatsApp. No necesitas escribir códigos.';return;}
request({action:'start'}).then(function(){return request({action:'order_status',requestId:w.crypto.randomUUID().replace(/-/g,'_'),accessToken:token});}).then(function(){token='';w.location.replace('/vitpower_2026g#consulta-pedido');}).catch(function(){token='';status.textContent='Este enlace venció o ya se abrió en otro navegador. Pide un nuevo enlace por el WhatsApp oficial; no necesitas copiar códigos.';});
})(window,document);
/* PROJECT=VITALISMEN_EC. Additive text chat; original VSL/CTA/measurement remain the authority. */
(function (w, d) {
  'use strict';
  if (w.location.hostname !== 'taviazen.shop' || w.location.pathname !== '/vitpower_2026g' || w.__vpChatV220) return;
  w.__vpChatV220 = true;
  var endpoint = '/api/vitpower-chat', source = 'https://taviazen.shop/vitpower_2026g', phone = '553171862958';
  var host, root, dialog, launcher, log, input, send, status, handoff, invite, voiceToggle, orderPanel, orderCode, orderResult, pending = false, started = false, history = [], voiceEnabled = false, voiceBusy = false, audio = null, audioUrl = null, lastReplyId = 'welcome_ana_lopez_v231', voiceGeneration = 0;
  function element(tag, className, text) { var n = d.createElement(tag); if (className) n.className = className; if (text) n.textContent = text; return n; }
  function cta() { return d.getElementById('preco_89') || d.querySelector('a[data-product="vit_power_ec"][data-vsl-source="' + source + '"][data-whatsapp-phone="' + phone + '"]'); }
  function visible(n) {
    if (!n || !n.isConnected || !n.getClientRects().length) return false;
    for (var p = n; p && p.nodeType === 1; p = p.parentElement) { var s = w.getComputedStyle(p); if (p.hidden || s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false; }
    return true;
  }
  function bubble(role, content, at) {
    var row = element('div', 'vp-chat-bubble' + (role === 'user' ? ' user' : ''));
    row.setAttribute('aria-label', role === 'user' ? 'Tú' : 'Ana Lopez'); row.appendChild(element('p', '', content));
    if (at) { var time = element('time', 'vp-chat-time'); time.dateTime = at; try { time.textContent = new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit' }).format(new Date(at)); } catch (e) {} row.appendChild(time); }
    log.appendChild(row); log.scrollTop = log.scrollHeight; return row;
  }
  function render() {
    log.replaceChildren(); bubble('assistant', '¡Hola! Te doy la bienvenida a Vitalismen Ecuador. Puedo ayudarte con la información oficial de Vit Power y responder tus dudas. ¿Qué deseas saber?');
    history.slice(-40).forEach(function (m) { bubble(m.role, m.content, m.at); });
  }
  function request(body) {
    var controller = new AbortController(), timer = w.setTimeout(function () { controller.abort(); }, 35000);
    return w.fetch(endpoint, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal })
      .then(function (r) { return r.json().then(function (v) { if (!r.ok || !v.ok) throw Error(v.error || 'unavailable'); return v; }); }).finally(function () { w.clearTimeout(timer); });
  }
  function stopVoice() { voiceGeneration++; if (audio) { audio.pause(); audio = null; } if (audioUrl) { w.URL.revokeObjectURL(audioUrl); audioUrl = null; } }
  function close() { stopVoice(); if (dialog.open && typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); launcher.setAttribute('aria-expanded', 'false'); launcher.focus(); }
  function open() {
    invite.hidden = true; dialog.setAttribute('open', ''); launcher.setAttribute('aria-expanded', 'true');
    input.focus();
    if (started || pending) return;
    pending = true; send.disabled = true; status.textContent = 'Conectando…';
    request({ action: 'start' }).then(function (v) { started = true; history = v.history || []; lastReplyId = v.voiceReplyId || 'welcome_ana_lopez_v231'; render(); status.textContent = ''; })
      .catch(function () { status.textContent = 'El chat no está disponible ahora. Puedes continuar por el WhatsApp oficial.'; })
      .finally(function () { pending = false; send.disabled = !started || !input.value.trim(); });
  }
  function build() {
    host = element('div'); host.id = 'vp-web-chat-v220'; root = host.attachShadow({ mode: 'open' });
    var css = element('link'); css.rel = 'stylesheet'; css.href = '/vitpower_2026g/assets/chat-v220.css?v231-voice-status'; root.appendChild(css);
    launcher = element('button', 'vp-chat-launcher', '💬 Hablar con Ana'); launcher.type = 'button'; launcher.setAttribute('aria-label', 'Abrir chat con Ana'); launcher.setAttribute('aria-haspopup', 'dialog'); launcher.setAttribute('aria-controls', 'vp-chat-dialog'); launcher.addEventListener('click', open);
    invite = element('aside', 'vp-chat-invite'); invite.hidden = true; invite.setAttribute('aria-label', 'Invitación al chat');
    var inviteText = element('p', '', '¡Hola! Soy Ana Lopez, del equipo Vitalismen. ¿Qué te gustaría saber sobre Vit Power?'), inviteOpen = element('button', '', 'Conversar ahora'), inviteClose = element('button', '', 'Cerrar');
    inviteOpen.type = inviteClose.type = 'button'; inviteOpen.addEventListener('click', open); inviteClose.addEventListener('click', function () { invite.hidden = true; }); invite.append(inviteText, inviteOpen, inviteClose);
    dialog = element('dialog', 'vp-chat-panel'); dialog.id = 'vp-chat-dialog'; dialog.setAttribute('aria-labelledby', 'vp-chat-title');
    var layout = element('div', 'vp-chat-layout'), header = element('header', 'vp-chat-header'), heading = element('div');
    var title = element('h2', '', 'Ana Lopez'); title.id = 'vp-chat-title'; heading.appendChild(title); heading.appendChild(element('p', '', 'Atención Vitalismen · Ecuador'));
    var exit = element('button', 'vp-chat-close', '×'); exit.type = 'button'; exit.setAttribute('aria-label', 'Cerrar conversación'); exit.addEventListener('click', close);
    header.appendChild(element('span', 'vp-chat-avatar', '💬')); header.appendChild(heading); header.appendChild(exit);
    log = element('div', 'vp-chat-log'); log.setAttribute('role', 'log'); log.setAttribute('aria-label', 'Historial de conversación'); log.setAttribute('aria-live', 'polite'); log.setAttribute('aria-relevant', 'additions text');
    var footer = element('footer', 'vp-chat-footer'), form = element('form', 'vp-chat-compose'), label = element('label', 'vp-chat-sr', 'Escribe tu mensaje'); label.htmlFor = 'vp-chat-input';
    input = element('textarea'); input.id = 'vp-chat-input'; input.rows = 1; input.maxLength = 700; input.placeholder = 'Escribe tu mensaje…'; input.autocomplete = 'off'; input.setAttribute('aria-describedby', 'vp-chat-privacy');
    send = element('button', 'vp-chat-send', '➤'); send.type = 'submit'; send.disabled = true; send.setAttribute('aria-label', 'Enviar mensaje');
    input.addEventListener('input', function () { send.disabled = pending || !started || !input.value.trim(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!send.disabled) form.requestSubmit(); } });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); var text = input.value.trim(); if (pending || !started || !text || text.length > 700) return;
      var privateCode = text.match(/\b[a-f0-9]{64}\b/i); if (privateCode) { input.value = ''; orderPanel.hidden = false; orderCode.value = privateCode[0].toLowerCase(); status.textContent = 'Usa el formulario privado Estado de mi pedido. El código no se enviará a la conversación.'; orderCode.focus(); return; }
      pending = true; send.disabled = true; input.value = ''; status.textContent = 'Ana está respondiendo…';
      var at = new Date().toISOString(), row = bubble('user', text, at), id = w.crypto.randomUUID().replace(/-/g, '_');
      request({ action: 'message', requestId: id, message: text }).then(function (v) {
        var savedText = v.redactedInput ? 'Consulta privada: contenido no almacenado.' : text;
        if (v.redactedInput) row.querySelector('p').textContent = savedText;
        history.push({ role: 'user', content: savedText, at: at }, { role: 'assistant', content: v.reply, at: v.at }); history = history.slice(-40);
        bubble('assistant', v.reply, v.at); lastReplyId = id; if (voiceEnabled) speak(); status.textContent = v.handoff ? 'Para atención humana, continúa por WhatsApp.' : '';
      }).catch(function () { status.textContent = 'No se pudo confirmar la respuesta. No repetimos el envío automáticamente. Puedes continuar por WhatsApp.'; })
        .finally(function () { pending = false; send.disabled = !started || !input.value.trim(); input.focus(); });
    });
    form.append(label, input, send); status = element('p', 'vp-chat-meta'); status.setAttribute('role', 'status');
    handoff = element('a', 'vp-chat-whatsapp', 'Continuar por WhatsApp'); handoff.href = 'https://wa.me/' + phone;
    handoff.setAttribute('data-product', 'vit_power_ec'); handoff.setAttribute('data-vsl-source', source); handoff.setAttribute('data-whatsapp-phone', phone);
    // The inherited document capture handler opens the approved name form and records the human click once.
    var privacy = element('p', 'vp-chat-meta', 'Respuestas con IA a partir de información oficial. No compartas datos de pago, contraseñas, códigos ni información de salud. El estado de un pedido requiere un código privado; no escribas ese código en la conversación.'); privacy.id = 'vp-chat-privacy';
    var hint = element('p', 'vp-chat-meta', 'Historial de este navegador: hasta 7 días y 40 mensajes. No se sincroniza automáticamente con WhatsApp ni entre dispositivos.');
    var clear = element('button', 'vp-chat-clear', 'Borrar historial'); clear.type = 'button';
    clear.addEventListener('click', function () {
      if (pending || !started) return;
      pending = true; clear.disabled = true; send.disabled = true; status.textContent = 'Borrando historial…';
      request({ action: 'clear' }).then(function () { history = []; started = false; lastReplyId = 'welcome_ana_lopez_v231'; orderCode.value = ''; stopVoice(); render(); status.textContent = 'Historial borrado. Cierra y abre el chat para iniciar otra conversación.'; })
        .catch(function () { status.textContent = 'No se pudo confirmar el borrado. Inténtalo más tarde.'; }).finally(function () { pending = false; clear.disabled = false; });
    });
    var controls = element('div', 'vp-chat-controls'), listen = element('button', '', '🔊 Escuchar'), orderButton = element('button', '', 'Estado de mi pedido');
    voiceToggle = element('button', '', 'Activar voz'); voiceToggle.setAttribute('aria-pressed', 'false');
    listen.type = voiceToggle.type = orderButton.type = 'button'; listen.addEventListener('click', speak);
    voiceToggle.addEventListener('click', function () { voiceEnabled = !voiceEnabled; voiceToggle.setAttribute('aria-pressed', String(voiceEnabled)); voiceToggle.textContent = voiceEnabled ? 'Desactivar voz' : 'Activar voz'; if (voiceEnabled) speak(); else stopVoice(); });
    controls.append(listen, voiceToggle, orderButton);
    orderPanel = element('form', 'vp-chat-order'); orderPanel.hidden = true;
    var codeLabel = element('label', '', 'Código privado del pedido'), codeSend = element('button', '', 'Consultar'), support = element('a', '', 'Solicitar código por WhatsApp');
    orderCode = element('input'); orderCode.id = 'vp-order-code'; orderCode.type = 'password'; orderCode.autocomplete = 'off'; orderCode.maxLength = 64; orderCode.placeholder = 'Código facilitado por el equipo'; codeLabel.htmlFor = orderCode.id;
    codeSend.type = 'submit'; support.href = 'https://wa.me/' + phone + '?text=' + encodeURIComponent('Hola, quiero consultar el estado de mi pedido. ¿Me ayudan a verificar mi identidad?'); support.target = '_blank'; support.rel = 'noopener noreferrer';
    orderResult = element('p', 'vp-chat-meta'); orderResult.setAttribute('role', 'status');
    orderPanel.append(codeLabel, orderCode, codeSend, support, orderResult);
    orderButton.addEventListener('click', function () { orderPanel.hidden = !orderPanel.hidden; if (!orderPanel.hidden) orderCode.focus(); });
    orderPanel.addEventListener('submit', function (event) {
      event.preventDefault(); var code = orderCode.value.trim(); if (!started || pending || !/^[a-f0-9]{64}$/.test(code)) { orderResult.textContent = 'Introduce el código privado válido. Si no lo tienes, solicítalo al equipo por WhatsApp.'; return; }
      pending = true; send.disabled = true; codeSend.disabled = true; orderResult.textContent = 'Consultando…'; var id = w.crypto.randomUUID().replace(/-/g, '_');
      request({ action: 'order_status', requestId: id, accessToken: code }).then(function (v) { bubble('assistant', v.reply, v.at); lastReplyId = id; orderCode.value = ''; orderResult.textContent = ''; if (voiceEnabled) speak(); })
        .catch(function () { orderResult.textContent = 'No se pudo autorizar esta consulta. El código puede haber vencido o estar vinculado a otro navegador. Verifícalo con el equipo por WhatsApp.'; })
        .finally(function () { pending = false; send.disabled = !started || !input.value.trim(); codeSend.disabled = false; });
    });
    var voicePrivacy = element('p', 'vp-chat-meta', 'Al pulsar Escuchar o activar la voz, la respuesta se envía a ElevenLabs para reproducir la voz de Ana Lopez. El texto sigue disponible.');
    footer.append(form, status, controls, orderPanel, handoff, voicePrivacy, privacy, hint, clear); layout.append(header, log, footer); dialog.appendChild(layout); root.append(launcher, invite, dialog); d.body.appendChild(host); render();
  }
  function speak() {
    if (!started || voiceBusy) return;
    stopVoice(); voiceBusy = true; var generation = voiceGeneration;
    var controller = new AbortController(), timer = w.setTimeout(function () { controller.abort(); }, 30000);
    w.fetch(endpoint, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'voice', requestId: lastReplyId }), signal: controller.signal })
      .then(function (r) { if (!r.ok || !(r.headers.get('content-type') || '').startsWith('audio/')) throw Error('voice_unavailable'); return r.blob(); })
      .then(function (blob) { if (!dialog.open || !blob.size || generation !== voiceGeneration) return; audioUrl = w.URL.createObjectURL(blob); audio = new Audio(audioUrl); return audio.play(); })
      .catch(function () { status.textContent = 'La voz no está disponible ahora. Puedes seguir por texto.'; })
      .finally(function () { w.clearTimeout(timer); voiceBusy = false; });
  }
  w.setTimeout(function () {
    var seen = false; try { seen = w.sessionStorage.getItem('vp-chat-invite-v231') === '1'; } catch (e) { seen = true; }
    if (!seen && invite && !dialog.open && d.visibilityState === 'visible') { invite.hidden = false; try { w.sessionStorage.setItem('vp-chat-invite-v231', '1'); } catch (e) {} }
  }, 8000);
  var scheduled = false;
  function synchronize() {
    scheduled = false;
    if (!host) build();
    // The FAQ popup is available on entry; the existing offer still controls checkout access.
    var unlocked = visible(cta());
    handoff.hidden = !unlocked; handoff.style.display = unlocked ? '' : 'none';
    handoff.setAttribute('aria-hidden', String(!unlocked)); handoff.tabIndex = unlocked ? 0 : -1;
    if (unlocked) { handoff.href = 'https://wa.me/' + phone; handoff.setAttribute('data-whatsapp-phone', phone); }
    else { handoff.removeAttribute('href'); handoff.removeAttribute('data-whatsapp-phone'); }
  }
  function schedule() { if (!scheduled) { scheduled = true; w.requestAnimationFrame(synchronize); } }
  new MutationObserver(schedule).observe(d.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
  w.addEventListener('click', function (event) {
    var chain = event.composedPath ? event.composedPath() : [event.target];
    if (handoff && chain.indexOf(handoff) !== -1 && !visible(cta())) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  w.addEventListener('resize', schedule); schedule();
})(window, document);

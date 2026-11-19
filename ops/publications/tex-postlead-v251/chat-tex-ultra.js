(function () {
  'use strict';
  if (window.__texUltraChatV240 || !/^(www\.)?plusmen\.shop$/.test(location.hostname) || !/^\/tex\/?$/.test(location.pathname)) return;
  const player = document.querySelector('vturb-smartplayer#vid-6aafe87d665f0c5b457748ad');
  if (!player) return;
  window.__texUltraChatV240 = true;
  const ENDPOINT = '/api/public/tex-ultra-chat';
  const element = (tag, text, className) => { const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node; };
  const launcher = element('button', 'Continuar mi atención por chat · Tex Ultra', 'tx240-launcher');
  launcher.hidden = true; launcher.style.setProperty('display', 'none', 'important');
  launcher.type = 'button'; launcher.setAttribute('aria-controls', 'texUltraChatV240'); launcher.setAttribute('aria-expanded', 'false');
  const card = element('section', '', 'tx240-card'); card.id = 'texUltraChatV240'; card.hidden = true; card.setAttribute('aria-labelledby', 'texUltraChatTitleV240');
  const header = element('header', '', 'tx240-header'), title = element('div'), heading = element('h2', 'Tex Ultra Ecuador'); heading.id = 'texUltraChatTitleV240';
  title.append(heading, element('p', 'Ana Lopez · Asistente virtual'));
  const close = element('button', 'Cerrar ×'); close.type = 'button'; close.setAttribute('aria-label', 'Cerrar conversación Tex Ultra'); header.append(title, close);
  const messages = element('div', '', 'tx240-messages'); messages.setAttribute('role', 'log'); messages.setAttribute('aria-live', 'polite'); messages.setAttribute('aria-label', 'Conversación con Ana Lopez');
  const status = element('p', '', 'tx240-status'); status.setAttribute('role', 'status');
  const form = element('form', '', 'tx240-form'), label = element('label', 'Tu mensaje'); label.htmlFor = 'texUltraChatInputV240';
  const input = element('textarea'); input.id = 'texUltraChatInputV240'; input.maxLength = 700; input.rows = 2; input.placeholder = 'Escribe tu duda sobre Tex Ultra…';
  const send = element('button', 'Enviar'); send.type = 'submit'; form.append(label, input, send);
  const voiceControls = element('div', '', 'tx240-actions'), listen = element('button', 'Escuchar a Ana'), voice = element('button', 'Activar voz');
  listen.type = voice.type = 'button'; listen.disabled = voice.disabled = true; voice.setAttribute('aria-pressed', 'false'); voiceControls.append(listen, voice);
  const continueButton = element('button', 'Ir al botón WhatsApp del video', 'tx240-continue'); continueButton.type = 'button'; continueButton.hidden = true;
  const identityForm = element('form', '', 'tx242-identity'); identityForm.hidden = true;
  const identityTitle = element('h3', 'Continuemos por tu nombre');
  const nameLabel = element('label', 'Tu primer nombre'), nameInput = element('input'); nameInput.id = 'tx242-name'; nameLabel.htmlFor = nameInput.id;
  nameInput.name = 'given-name'; nameInput.autocomplete = 'given-name'; nameInput.required = true; nameInput.maxLength = 60;
  const phoneLabel = element('label', 'Tu WhatsApp de Ecuador'), phoneInput = element('input'); phoneInput.id = 'tx242-phone'; phoneLabel.htmlFor = phoneInput.id;
  phoneInput.type = 'tel'; phoneInput.inputMode = 'tel'; phoneInput.autocomplete = 'tel'; phoneInput.placeholder = '+593…'; phoneInput.required = true; phoneInput.maxLength = 16;
  const identityNotice = element('p', 'Confirma desde tu WhatsApp para continuar la misma atención sin repetir la presentación. Esto no registra un pedido.');
  const verify = element('button', 'Confirmar mi WhatsApp'); verify.type = 'submit';
  const verifyLink = element('a', 'Enviar confirmación por WhatsApp'); verifyLink.hidden = true; verifyLink.target = '_blank'; verifyLink.rel = 'noopener noreferrer';
  const identityStatus = element('p', ''); identityStatus.setAttribute('role', 'status');
  const skipIdentity = element('button', 'Solo tengo una pregunta'); skipIdentity.type = 'button';
  identityForm.append(identityTitle, nameLabel, nameInput, phoneLabel, phoneInput, identityNotice, verify, verifyLink, identityStatus, skipIdentity);
  const linkAgain = element('button', 'Vincular mi WhatsApp'); linkAgain.type = 'button'; linkAgain.hidden = true; voiceControls.append(linkAgain);
  const notice = element('p', 'Respuestas con IA. No compartas datos médicos, de pago ni documentos. Al elegir voz, el texto de la respuesta se envía a ElevenLabs. Este chat no confirma pedidos ni envía mensajes por WhatsApp.', 'tx240-notice');
  card.append(header, identityForm, messages, status, form, voiceControls, continueButton, notice);
  const videoBlock = player.closest('.uihiui') || player.parentElement; videoBlock.after(launcher); launcher.after(card);
  let ready = false, busy = false, epoch = 0, controller, audio, audioUrl, voiceController, voiceEnabled = false, handoff = false, voiceReplyId = 'welcome_ana_lopez_v231';
  let linkTimer = null, linkBusy = false, entrySyncAttempted = false, entryRecorded = false, linkedVersion = false, pollCount = 0;
  function stopLinkPoll() { if (linkTimer) clearTimeout(linkTimer); linkTimer = null; }
  function pauseVoice() { for (const media of (messages.querySelectorAll?.('audio') || [])) media.pause(); voiceController?.abort(); voiceController = null; if (audio) { audio.pause(); audio.src = ''; audio = null; } if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = null; }
  function bubble(role, content, block) {
    const keys = ['greeting', 'intro', 'proof', 'bottle', 'offer'];
    const sources = { intro: '/tex-assets/tex-entry-v242/intro.mp3', proof: '/tex-assets/tex-entry-v242/proof.jpeg', bottle: '/tex-assets/tex-entry-v242/bottle.png' };
    const valid = role === 'assistant' && block?.id === 'tex_ultra_inicio_completo' && block.version === 242 && block.productKey === 'tex_ultra_ec' && Array.isArray(block.steps) && block.steps.length === 5
      && block.steps.every((step, index) => step.key === keys[index] && typeof step.text === 'string' && step.text.length <= 1200
        && (sources[step.key] ? step.src === sources[step.key] && step.type === (step.key === 'intro' ? 'audio' : 'image') : step.type === 'text' && !step.src));
    if (valid) {
      for (const step of block.steps) {
        const row = element('div', '', 'tx240-message'); row.dataset.role = 'assistant'; row.append(element('small', 'Ana Lopez'));
        if (step.type === 'audio') { const media = element('audio'); media.controls = true; media.preload = 'none'; media.src = step.src; media.setAttribute('aria-label', step.text); row.append(element('p', step.text), media); }
        else if (step.type === 'image') { const media = element('img'); media.src = step.src; media.alt = step.text; media.loading = 'lazy'; media.decoding = 'async'; row.append(media, element('p', step.text)); }
        else row.append(element('p', step.text));
        messages.append(row);
      }
    } else { const row = element('div', '', 'tx240-message'); row.dataset.role = role; row.append(element('small', role === 'assistant' ? 'Ana Lopez' : 'Tú'), element('p', content)); messages.append(row); }
    messages.scrollTop = messages.scrollHeight;
  }
  function nativeButton() { return document.getElementById('preco_89') || player.querySelector('#preco_89') || player.shadowRoot?.querySelector('#preco_89'); }
  function visible(node) {
    if (!node || node.disabled || !node.getClientRects().length) return false;
    if (typeof node.checkVisibility === 'function') return node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    for (let parent = node; parent; parent = parent.parentElement) { const css = getComputedStyle(parent); if (parent.hidden || css.display === 'none' || css.visibility === 'hidden' || css.visibility === 'collapse' || Number(css.opacity) === 0) return false; }
    return true;
  }
  function updateContinuation() { const nextHidden = card.hidden || !handoff || !visible(nativeButton()); if (continueButton.hidden !== nextHidden) continueButton.hidden = nextHidden; }
  let refreshQueued = false;
  const observer = new MutationObserver(() => { if (!refreshQueued && !card.hidden) { refreshQueued = true; requestAnimationFrame(() => { refreshQueued = false; updateContinuation(); }); } });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'hidden', 'class'] });
  // V244: release chat only when the video's original WhatsApp CTA is rendered.
  let chatReleasedV244 = false, gateTimerV244 = null, gateRootV244 = null;
  let invitationVerifiedV251 = false, invitationBusyV251 = false;
  const invitationNoticeV251 = element('p', '', 'tx240-status'); invitationNoticeV251.hidden = true; invitationNoticeV251.setAttribute('role', 'status'); card.after(invitationNoticeV251);
  if (window.__texChatInvitationPageV251) { const back = element('a', 'Volver a WhatsApp', 'tx240-continue'); back.href = 'https://wa.me/553171862958'; back.target = '_blank'; back.rel = 'noopener noreferrer'; invitationNoticeV251.after(back); }
  const gateOptionsV244 = { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'hidden', 'class', 'disabled'] };
  const gateObserverV244 = new MutationObserver(checkChatReleaseV244);
  function checkChatReleaseV244() {
    if (chatReleasedV244) return;
    const root = player.shadowRoot;
    if (root && root !== gateRootV244) { gateObserverV244.observe(root, gateOptionsV244); gateRootV244 = root; }
    // V251: neither CTA visibility, a click nor returning from WhatsApp proves receipt.
    if (!invitationVerifiedV251) return;
    chatReleasedV244 = true;
    launcher.hidden = false; launcher.style.removeProperty('display');
    gateObserverV244.disconnect(); clearInterval(gateTimerV244); gateTimerV244 = null;
  }
  function watchChatReleaseV244() {
    if (chatReleasedV244) return;
    gateObserverV244.observe(document.body, gateOptionsV244); checkChatReleaseV244();
    if (!chatReleasedV244 && !gateTimerV244) gateTimerV244 = setInterval(checkChatReleaseV244, 500);
  }
  window.addEventListener('pagehide', () => { gateObserverV244.disconnect(); clearInterval(gateTimerV244); gateTimerV244 = null; gateRootV244 = null; });
  window.addEventListener('pageshow', event => { if (event.persisted) watchChatReleaseV244(); });
  watchChatReleaseV244();
  async function verifyInvitationV251() {
    if (invitationBusyV251 || document.hidden) return;
    invitationBusyV251 = true;
    const fragment = location.hash || '';
    const accessToken = window.__texInviteTokenV251 || /^#chat=([a-f0-9]{64})$/.exec(fragment)?.[1] || '';
    try { delete window.__texInviteTokenV251; } catch (_) {}
    if (accessToken) {
      try { history.replaceState(history.state, '', location.pathname + location.search); } catch (_) { invitationBusyV251 = false; return; }
      invitationNoticeV251.hidden = false; invitationNoticeV251.textContent = 'Verificando tu invitación de WhatsApp…';
    }
    try {
      const data = await (await request(accessToken ? { action: 'invite_accept', accessToken } : { action: 'link_status' })).json();
      const verified = data.ok === true && data.verified === true && data.humanHold !== true
        && (accessToken ? data.invitationVersion === 251 && data.firstChannel === 'whatsapp' : true);
      if (!verified) throw Error('invitation_unavailable');
      invitationVerifiedV251 = true; invitationNoticeV251.hidden = true;
      checkChatReleaseV244();
      if (accessToken) launcher.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (_) {
      invitationVerifiedV251 = false; chatReleasedV244 = false;
      launcher.hidden = true; launcher.style.setProperty('display', 'none', 'important');
      if (accessToken) { invitationNoticeV251.hidden = false; invitationNoticeV251.textContent = 'La invitación no está disponible o ya está vinculada a otro navegador. Continúa por el WhatsApp oficial donde recibiste el enlace.'; }
    } finally { invitationBusyV251 = false; }
  }
  window.addEventListener('focus', () => { if (card.hidden) verifyInvitationV251(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && card.hidden) verifyInvitationV251(); });
  window.addEventListener('pageshow', event => { if (event.persisted && card.hidden) verifyInvitationV251(); });
  verifyInvitationV251();

  async function request(body, signal) {
    const response = await fetch(ENDPOINT, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    if (!response.ok) throw Error(response.status === 429 ? 'El chat está ocupado. Puedes continuar con el WhatsApp de la página.' : 'No fue posible completar la consulta. No se reenviará automáticamente.');
    return response;
  }
  async function start() {
    if (busy) return; busy = true; const current = ++epoch; controller = new AbortController(); send.disabled = true; status.textContent = 'Conectando con Ana…';
    try {
      const response = await request({ action: 'start' }, controller.signal), data = await response.json();
      if (current !== epoch || card.hidden) return;
      if (!data.ok || data.identity?.productKey !== 'tex_ultra_ec' || data.identity?.origin !== 'https://plusmen.shop' || data.identity?.sourcePath !== '/tex' || !Array.isArray(data.history)) throw Error('La identificación Tex Ultra no está disponible. Continúa por el WhatsApp de la página.');
      messages.replaceChildren(); bubble('assistant', data.welcome || '¡Hola! Soy Ana Lopez, asistente virtual de Tex Ultra Ecuador. ¿Cómo puedo ayudarte?');
      for (const row of data.history) if (['user', 'assistant'].includes(row.role) && typeof row.content === 'string') bubble(row.role, row.content, row.entryBlock);
      voiceReplyId = data.voiceReplyId || 'welcome_ana_lopez_v231'; linkedVersion = data.linkedEntryVersion === 242; entryRecorded = data.entryLinked === true; entrySyncAttempted = entryRecorded; identityForm.hidden = !linkedVersion || entryRecorded || invitationVerifiedV251; linkAgain.hidden = !linkedVersion || invitationVerifiedV251; if (data.firstName) nameInput.value = data.firstName; ready = true; status.textContent = 'Conversación de Tex Ultra. Puedes escribir o elegir escuchar a Ana.';
    } catch (error) { if (current === epoch && error.name !== 'AbortError') { ready = false; status.textContent = error.message; } }
    finally { if (current === epoch) { busy = false; send.disabled = !ready; listen.disabled = voice.disabled = !ready; if (linkedVersion && ready) checkIdentity(); } }
  }
  async function speak() {
    if (!ready || card.hidden) return; pauseVoice(); const replyId = voiceReplyId, current = epoch; voiceController = new AbortController(); listen.disabled = true;
    try {
      const response = await request({ action: 'voice', requestId: replyId }, voiceController.signal);
      if (!String(response.headers.get('content-type')).startsWith('audio/') || Number(response.headers.get('content-length') || 0) > 2097152) throw Error('La voz no está disponible. La respuesta sigue disponible por texto.');
      const bytes = await response.arrayBuffer(); if (bytes.byteLength < 100 || bytes.byteLength > 2097152) throw Error('La voz no está disponible. Puedes seguir leyendo.');
      if (current !== epoch || card.hidden || replyId !== voiceReplyId) return;
      audioUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' })); audio = new Audio(audioUrl); await audio.play();
    } catch (error) { if (current === epoch && error.name !== 'AbortError') status.textContent = error.message || 'No se pudo reproducir la voz. Puedes seguir por texto.'; }
    finally { listen.disabled = false; }
  }
  async function syncEntry(current) {
    if (entryRecorded || entrySyncAttempted || linkBusy || busy) return;
    entrySyncAttempted = true; linkBusy = true; verify.disabled = true;
    try {
      const id = crypto.randomUUID().replace(/-/g, '');
      const data = await (await request({ action: 'tex_entry', requestId: id })).json();
      if (current !== epoch || card.hidden) return;
      if (!data.ok || typeof data.reply !== 'string') throw Error('No se pudo confirmar el inicio. No se repetirá automáticamente.');
      bubble('assistant', data.reply, data.entryBlock); voiceReplyId = id; entryRecorded = true;
      handoff = data.handoff === true; updateContinuation(); identityStatus.textContent = 'WhatsApp confirmado. Seguimos con tu atención de Tex Ultra.';
      identityForm.hidden = true;
    } catch (error) { if (current === epoch) { ready = false; send.disabled = true; identityStatus.textContent = error.message + ' Cierra y vuelve a abrir el chat para revisar el historial.'; } }
    finally { linkBusy = false; verify.disabled = false; }
  }
  async function checkIdentity() {
    stopLinkPoll(); if (!linkedVersion || card.hidden || document.hidden || !ready || busy || linkBusy) return;
    const current = epoch; linkBusy = true;
    try {
      const data = await (await request({ action: 'link_status' })).json();
      if (current !== epoch || card.hidden) return;
      if (data.verified === true) {
        identityStatus.textContent = 'WhatsApp ' + data.maskedPhone + ' confirmado. ' + (data.firstChannel === 'whatsapp' ? 'Continuamos la atención iniciada por WhatsApp.' : 'Continuamos aquí, sin repetir la presentación.');
        verifyLink.hidden = true; linkBusy = false; await syncEntry(current); return;
      }
      if (!verifyLink.hidden && pollCount++ < 18) linkTimer = setTimeout(checkIdentity, 30000);
      else if (pollCount >= 18) identityStatus.textContent = 'La confirmación tiene un plazo limitado. Si ya venció, vuelve a confirmar tu WhatsApp.';
    } catch (error) { if (current === epoch) identityStatus.textContent = 'No pudimos comprobar la confirmación. Puedes cerrar y volver a abrir el chat.'; }
    finally { linkBusy = false; }
  }
  identityForm.addEventListener('submit', async event => {
    event.preventDefault(); if (!ready || busy || linkBusy) return;
    const firstName = nameInput.value.trim(), phone = phoneInput.value.replace(/[ ()-]/g, '').trim();
    if (!firstName || !/^\+?593[2-79]\d{8}$/.test(phone)) { identityStatus.textContent = 'Escribe tu primer nombre y un WhatsApp válido de Ecuador con +593.'; return; }
    const current = epoch; linkBusy = true; verify.disabled = true; stopLinkPoll();
    try {
      const data = await (await request({ action: 'link_start', measurementRef: window.TexUltraMeasurementV243?.reference?.() || '', requestId: crypto.randomUUID().replace(/-/g, ''), firstName, phone })).json();
      if (current !== epoch || card.hidden) return;
      if (data.verified === true) { linkBusy = false; await checkIdentity(); return; }
      const url = new URL(data.verificationUrl);
      if (!data.ok || url.origin !== 'https://wa.me' || url.pathname !== '/553171862958' || !/^Hola, quiero el tratamiento Tex Ultra\.\nConfirmar chat: TX242-[a-f0-9]{64}$/.test(url.searchParams.get('text') || '')) throw Error('La confirmación no está disponible.');
      verifyLink.href = url.href; verifyLink.hidden = false; pollCount = 0;
      identityStatus.textContent = 'Abre WhatsApp, envía el mensaje de confirmación desde ese número y vuelve aquí. No es un pedido.';
    } catch (error) { if (current === epoch) identityStatus.textContent = 'No pudimos iniciar la confirmación. Revisa tu nombre y WhatsApp; no se enviará nada automáticamente.'; }
    finally { linkBusy = false; verify.disabled = false; }
  });
  verifyLink.addEventListener('click', () => { pollCount = 0; stopLinkPoll(); linkTimer = setTimeout(checkIdentity, 30000); });
  skipIdentity.addEventListener('click', () => { identityForm.hidden = true; input.focus(); });
  linkAgain.addEventListener('click', () => { identityForm.hidden = false; nameInput.focus(); checkIdentity(); });
  window.addEventListener('focus', () => { if (!card.hidden && linkedVersion) checkIdentity(); });
  launcher.addEventListener('click', () => { if (!chatReleasedV244 || !card.hidden) return; card.hidden = false; launcher.setAttribute('aria-expanded', 'true'); card.scrollIntoView({ behavior: 'smooth', block: 'start' }); start(); });
  close.addEventListener('click', () => { card.hidden = true; stopLinkPoll(); linkBusy = false; launcher.setAttribute('aria-expanded', 'false'); epoch++; controller?.abort(); busy = false; pauseVoice(); voiceEnabled = false; voice.textContent = 'Activar voz'; voice.setAttribute('aria-pressed', 'false'); updateContinuation(); launcher.focus(); });
  listen.addEventListener('click', speak);
  voice.addEventListener('click', () => { voiceEnabled = !voiceEnabled; voice.setAttribute('aria-pressed', String(voiceEnabled)); voice.textContent = voiceEnabled ? 'Desactivar voz' : 'Activar voz'; if (voiceEnabled) speak(); else pauseVoice(); });
  continueButton.addEventListener('click', () => { const target = nativeButton(); if (!visible(target)) { updateContinuation(); return; } target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.focus?.({ preventScroll: true }); });
  form.addEventListener('submit', async event => {
    event.preventDefault(); const text = input.value.trim(); if (!ready || busy || !text || text.length > 700) return;
    pauseVoice(); const current = ++epoch, requestId = crypto.randomUUID().replace(/-/g, ''); controller = new AbortController(); busy = true; send.disabled = true; input.value = ''; bubble('user', text); status.textContent = 'Ana está respondiendo…';
    try {
      const response = await request({ action: 'message', requestId, message: text }, controller.signal), data = await response.json();
      if (current !== epoch || card.hidden) return;
      if (!data.ok || typeof data.reply !== 'string') throw Error('No se pudo confirmar la respuesta. No se reenviará automáticamente.');
      bubble('assistant', data.reply, data.entryBlock); voiceReplyId = requestId; handoff = data.handoff === true; status.textContent = ''; updateContinuation(); if (voiceEnabled) speak();
    } catch (error) { if (current === epoch && error.name !== 'AbortError') { ready = false; status.textContent = error.message + ' Cierra y vuelve a abrir el chat para consultar el historial antes de enviar otra vez.'; } }
    finally { if (current === epoch) { busy = false; send.disabled = !ready; } }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pauseVoice(); stopLinkPoll(); } else if (!card.hidden && linkedVersion) checkIdentity(); });
  window.addEventListener('pagehide', () => { stopLinkPoll(); linkBusy = false; epoch++; controller?.abort(); busy = false; ready = false; send.disabled = listen.disabled = voice.disabled = true; pauseVoice(); observer.disconnect(); });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'hidden', 'class'] });
    if (!card.hidden) start();
  });
})();

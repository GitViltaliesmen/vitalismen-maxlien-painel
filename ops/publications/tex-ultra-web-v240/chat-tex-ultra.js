(function () {
  'use strict';
  if (window.__texUltraChatV240 || !/^(www\.)?plusmen\.shop$/.test(location.hostname) || !/^\/tex\/?$/.test(location.pathname)) return;
  const player = document.querySelector('vturb-smartplayer#vid-6aafe87d665f0c5b457748ad');
  if (!player) return;
  window.__texUltraChatV240 = true;
  const ENDPOINT = '/api/public/tex-ultra-chat';
  const element = (tag, text, className) => { const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node; };
  const launcher = element('button', 'Habla con Ana · Tex Ultra', 'tx240-launcher');
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
  const notice = element('p', 'Respuestas con IA. No compartas datos médicos, de pago ni documentos. Al elegir voz, el texto de la respuesta se envía a ElevenLabs. Este chat no confirma pedidos ni envía mensajes por WhatsApp.', 'tx240-notice');
  card.append(header, messages, status, form, voiceControls, continueButton, notice);
  const videoBlock = player.closest('.uihiui') || player.parentElement; videoBlock.after(launcher); launcher.after(card);
  let ready = false, busy = false, epoch = 0, controller, audio, audioUrl, voiceController, voiceEnabled = false, handoff = false, voiceReplyId = 'welcome_ana_lopez_v231';
  function pauseVoice() { voiceController?.abort(); voiceController = null; if (audio) { audio.pause(); audio.src = ''; audio = null; } if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = null; }
  function bubble(role, content) { const row = element('div', '', 'tx240-message'); row.dataset.role = role; row.append(element('small', role === 'assistant' ? 'Ana Lopez' : 'Tú'), element('p', content)); messages.append(row); messages.scrollTop = messages.scrollHeight; }
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
      for (const row of data.history) if (['user', 'assistant'].includes(row.role) && typeof row.content === 'string') bubble(row.role, row.content);
      voiceReplyId = data.voiceReplyId || 'welcome_ana_lopez_v231'; ready = true; status.textContent = 'Conversación de Tex Ultra. Puedes escribir o elegir escuchar a Ana.';
    } catch (error) { if (current === epoch && error.name !== 'AbortError') { ready = false; status.textContent = error.message; } }
    finally { if (current === epoch) { busy = false; send.disabled = !ready; listen.disabled = voice.disabled = !ready; } }
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
  launcher.addEventListener('click', () => { if (!card.hidden) return; card.hidden = false; launcher.setAttribute('aria-expanded', 'true'); card.scrollIntoView({ behavior: 'smooth', block: 'start' }); start(); });
  close.addEventListener('click', () => { card.hidden = true; launcher.setAttribute('aria-expanded', 'false'); epoch++; controller?.abort(); busy = false; pauseVoice(); voiceEnabled = false; voice.textContent = 'Activar voz'; voice.setAttribute('aria-pressed', 'false'); updateContinuation(); launcher.focus(); });
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
      bubble('assistant', data.reply); voiceReplyId = requestId; handoff = data.handoff === true; status.textContent = ''; updateContinuation(); if (voiceEnabled) speak();
    } catch (error) { if (current === epoch && error.name !== 'AbortError') { ready = false; status.textContent = error.message + ' Cierra y vuelve a abrir el chat para consultar el historial antes de enviar otra vez.'; } }
    finally { if (current === epoch) { busy = false; send.disabled = !ready; } }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseVoice(); });
  window.addEventListener('pagehide', () => { epoch++; controller?.abort(); pauseVoice(); observer.disconnect(); });
})();

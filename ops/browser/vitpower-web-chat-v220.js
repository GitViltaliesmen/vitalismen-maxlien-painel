/* PROJECT=VITALISMEN_EC. Additive text chat; original VSL/CTA/measurement remain the authority. */
(function (w, d) {
  'use strict';
  if (w.location.hostname !== 'taviazen.shop' || w.location.pathname !== '/vitpower_2026g' || w.__vpChatV220) return;
  w.__vpChatV220 = true;
  var endpoint = '/api/vitpower-chat', source = 'https://taviazen.shop/vitpower_2026g', phone = '553171862958';
  var host, root, dialog, launcher, log, input, send, status, handoff, pending = false, started = false, history = [];
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
    log.replaceChildren(); bubble('assistant', '¡Hola! Soy Ana Lopez, asistente virtual de Vitalismen Ecuador. Puedo ayudarte con la información oficial de Vit Power y responder tus dudas. ¿Qué deseas saber?');
    history.slice(-40).forEach(function (m) { bubble(m.role, m.content, m.at); });
  }
  function request(body) {
    var controller = new AbortController(), timer = w.setTimeout(function () { controller.abort(); }, 35000);
    return w.fetch(endpoint, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal })
      .then(function (r) { return r.json().then(function (v) { if (!r.ok || !v.ok) throw Error(v.error || 'unavailable'); return v; }); }).finally(function () { w.clearTimeout(timer); });
  }
  function close() { if (dialog.open && typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); launcher.focus(); }
  function open() {
    if (!visible(cta())) return;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    input.focus();
    if (started || pending) return;
    pending = true; send.disabled = true; status.textContent = 'Conectando…';
    request({ action: 'start' }).then(function (v) { started = true; history = v.history || []; render(); status.textContent = ''; })
      .catch(function () { status.textContent = 'El chat no está disponible ahora. Puedes continuar por el WhatsApp oficial.'; })
      .finally(function () { pending = false; send.disabled = !started || !input.value.trim(); });
  }
  function build() {
    host = element('div'); host.id = 'vp-web-chat-v220'; root = host.attachShadow({ mode: 'open' });
    var css = element('link'); css.rel = 'stylesheet'; css.href = '/vitpower_2026g/assets/chat-v220.css'; root.appendChild(css);
    launcher = element('button', 'vp-chat-launcher', '💬 ¿Tienes preguntas?'); launcher.type = 'button'; launcher.setAttribute('aria-haspopup', 'dialog'); launcher.setAttribute('aria-controls', 'vp-chat-dialog'); launcher.addEventListener('click', open);
    dialog = element('dialog', 'vp-chat-panel'); dialog.id = 'vp-chat-dialog'; dialog.setAttribute('aria-labelledby', 'vp-chat-title');
    var layout = element('div', 'vp-chat-layout'), header = element('header', 'vp-chat-header'), heading = element('div');
    var title = element('h2', '', 'Ana Lopez'); title.id = 'vp-chat-title'; heading.appendChild(title); heading.appendChild(element('p', '', 'Asistente virtual Vitalismen · Ecuador'));
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
      pending = true; send.disabled = true; input.value = ''; status.textContent = 'Ana está respondiendo…';
      var at = new Date().toISOString(), row = bubble('user', text, at), id = w.crypto.randomUUID().replace(/-/g, '_');
      request({ action: 'message', requestId: id, message: text }).then(function (v) {
        var savedText = v.redactedInput ? 'Consulta privada: contenido no almacenado.' : text;
        if (v.redactedInput) row.querySelector('p').textContent = savedText;
        history.push({ role: 'user', content: savedText, at: at }, { role: 'assistant', content: v.reply, at: v.at }); history = history.slice(-40);
        bubble('assistant', v.reply, v.at); status.textContent = v.handoff ? 'Para atención humana, continúa por WhatsApp.' : '';
      }).catch(function () { status.textContent = 'No se pudo confirmar la respuesta. No repetimos el envío automáticamente. Puedes continuar por WhatsApp.'; })
        .finally(function () { pending = false; send.disabled = !started || !input.value.trim(); input.focus(); });
    });
    form.append(label, input, send); status = element('p', 'vp-chat-meta'); status.setAttribute('role', 'status');
    handoff = element('a', 'vp-chat-whatsapp', 'Continuar por WhatsApp'); handoff.href = 'https://wa.me/' + phone;
    handoff.setAttribute('data-product', 'vit_power_ec'); handoff.setAttribute('data-vsl-source', source); handoff.setAttribute('data-whatsapp-phone', phone);
    // The inherited document capture handler opens the approved name form and records the human click once.
    var privacy = element('p', 'vp-chat-meta', 'Respuestas con IA a partir de información oficial. No compartas datos de pago, contraseñas, códigos ni información de salud. Este chat no consulta pedidos privados.'); privacy.id = 'vp-chat-privacy';
    var hint = element('p', 'vp-chat-meta', 'Historial de este navegador: hasta 7 días y 40 mensajes. No se sincroniza automáticamente con WhatsApp ni entre dispositivos.');
    var clear = element('button', 'vp-chat-clear', 'Borrar historial'); clear.type = 'button';
    clear.addEventListener('click', function () {
      if (pending || !started) return;
      pending = true; clear.disabled = true; send.disabled = true; status.textContent = 'Borrando historial…';
      request({ action: 'clear' }).then(function () { history = []; started = false; render(); status.textContent = 'Historial borrado. Cierra y abre el chat para iniciar otra conversación.'; })
        .catch(function () { status.textContent = 'No se pudo confirmar el borrado. Inténtalo más tarde.'; }).finally(function () { pending = false; clear.disabled = false; });
    });
    footer.append(form, status, handoff, privacy, hint, clear); layout.append(header, log, footer); dialog.appendChild(layout); root.append(launcher, dialog); d.body.appendChild(host); render();
  }
  var scheduled = false;
  function synchronize() {
    scheduled = false;
    var show = visible(cta());
    if (show && !host) build();
    if (host) { host.hidden = !show; if (!show && dialog.open) close(); }
  }
  function schedule() { if (!scheduled) { scheduled = true; w.requestAnimationFrame(synchronize); } }
  new MutationObserver(schedule).observe(d.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
  w.addEventListener('resize', schedule); schedule();
})(window, document);

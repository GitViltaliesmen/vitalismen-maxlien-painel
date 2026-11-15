/* PROJECT=VITALISMEN_EC. Candidate V213; not installed by creating this file. */
(function (w, d) {
  'use strict';
  if (w.location.hostname !== 'taviazen.shop' || w.location.pathname !== '/vitpower_2026g' || w.__vitalismenV213) return;
  var PIXEL = '28298613626504767', SOURCE = 'https://taviazen.shop/vitpower_2026g';
  var PHONE = '553171862958';
  var MESSAGE = 'Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.\n¡Me interesa aprovechar la mejor promoción y hacer mi pedido! ¿Me ayudan?';
  var state = w.__vitalismenV213 = { version: 213, initialized: false, events: {}, reference: '' };
  var variant = d.querySelector('vturb-smartplayer') ? 'mobile_vsl' : 'desktop';
  var params = new URLSearchParams(w.location.search), qa = params.get('vp_qa') === '1';
  var visitId = '', visitorId = '', busy = false;
  var attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'campaign_id', 'adset_id', 'ad_id', 'placement'];
  function attribution() {
    if (state.attribution) return state.attribution;
    var stored = {}, fresh = {}, hasFresh = false;
    try { stored = JSON.parse(w.localStorage.getItem('_vp_attribution_v213') || '{}'); } catch (e) {}
    if (!stored || typeof stored !== 'object' || !Number.isFinite(stored.capturedAt) || Date.now() - stored.capturedAt > 2592000000 || stored.capturedAt > Date.now()) stored = {};
    ['fbclid'].concat(attributionKeys).forEach(function (key) {
      if (params.get(key)) { fresh[key] = params.get(key).slice(0, key === 'fbclid' ? 512 : 200); hasFresh = true; }
    });
    var next = hasFresh ? Object.assign({}, fresh, { capturedAt: Date.now() }) : stored;
    // Persist only marketing attribution, never names, phones or conversations.
    try { if (hasFresh) w.localStorage.setItem('_vp_attribution_v213', JSON.stringify(next)); } catch (e) {}
    state.attribution = next; return next;
  }
  function permitted() {
    var n = w.navigator || {};
    return !qa && n.globalPrivacyControl !== true && n.doNotTrack !== '1' && n.doNotTrack !== 'yes' &&
      w.doNotTrack !== '1' && w.vitalismenMarketingConsent !== false;
  }
  function readCookie(name) {
    var pair = d.cookie.split(';').map(function (s) { return s.trim(); }).find(function (s) { return s.indexOf(name + '=') === 0; });
    return pair ? decodeURIComponent(pair.slice(name.length + 1)) : '';
  }
  function setCookie(name, value) {
    d.cookie = name + '=' + encodeURIComponent(value) + '; Max-Age=7776000; Path=/; SameSite=Lax; Secure';
  }
  function uuid() { return w.crypto.randomUUID(); }
  function identity() {
    if (!permitted() || !w.crypto || !w.crypto.randomUUID) return false;
    if (!visitId) visitId = uuid();
    if (!visitorId) {
      visitorId = readCookie('_vp_visitor');
      if (!/^[a-f0-9-]{36}$/i.test(visitorId)) { visitorId = uuid(); setCookie('_vp_visitor', visitorId); }
    }
    if (!/^fb\.\d\.\d{13}\.[A-Za-z0-9_.-]+$/.test(readCookie('_fbp')))
      setCookie('_fbp', 'fb.1.' + Date.now() + '.' + new DataView(w.crypto.getRandomValues(new Uint8Array(4)).buffer).getUint32(0));
    var clickId = attribution().fbclid || '';
    if (/^[A-Za-z0-9_.-]{1,512}$/.test(clickId)) {
      var existing = readCookie('_fbc');
      if (!existing.endsWith('.' + clickId)) setCookie('_fbc', 'fb.1.' + Date.now() + '.' + clickId);
    }
    return true;
  }
  function payload(events) {
    var out = { visitId: visitId, visitorId: visitorId, consent: true, qa: false,
      variant: variant, events: events, entryMessage: MESSAGE,
      fbp: readCookie('_fbp'), fbc: readCookie('_fbc'), fbclid: attribution().fbclid || '' };
    attributionKeys.forEach(function (key) { if (attribution()[key]) out[key] = attribution()[key]; });
    return out;
  }
  function capture(events) {
    if (!identity()) return Promise.resolve(null);
    // Same-origin protected proxy must preserve the verified visitor IP/UA.
    return w.fetch('/api/vitpower-measurement', { method: 'POST', credentials: 'same-origin', keepalive: true,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(events)) })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (r) {
        if (permitted() && r && r.ok && /^VP-[A-F0-9]{36}$/.test(r.reference)) state.reference = r.reference;
        return r;
      }).catch(function () { return null; });
  }
  function ready() {
    if (!permitted() || d.visibilityState !== 'visible' || d.prerendering || !identity()) return false;
    if (state.initialized) return true;
    if (typeof w.fbq !== 'function') {
      var q = function () { if (q.callMethod) q.callMethod.apply(q, arguments); else q.queue.push(arguments); };
      q.push = q; q.loaded = true; q.version = '2.0'; q.queue = []; w.fbq = q; if (!w._fbq) w._fbq = q;
    }
    w.fbq('set', 'autoConfig', false, PIXEL); w.fbq('init', PIXEL);
    if (!Array.from(d.scripts).some(function (s) { return /connect\.facebook\.net\/.*\/fbevents\.js/.test(s.src); })) {
      var sdk = d.createElement('script'); sdk.async = true; sdk.src = 'https://connect.facebook.net/en_US/fbevents.js';
      d.head.appendChild(sdk);
    }
    state.initialized = true;
    // Persist and obtain the opaque visit reference without waiting for Meta.
    capture([]);
    return true;
  }
  function event(name) {
    if (!ready() || state.events[name]) return null;
    var prefix = { PageView: 'page', ViewContent: 'content', CtaClick: 'cta', Contact: 'contact' }[name];
    var row = { name: name, id: 'vp213-' + prefix + '-' + visitId };
    state.events[name] = row;
    w.fbq(name === 'CtaClick' ? 'trackSingleCustom' : 'trackSingle', PIXEL, name,
      { content_ids: ['vit_power_ec'], content_type: 'product', flow_id: 'vitpower_2026g', page_variant: variant },
      { eventID: row.id });
    return row;
  }
  function track(name) { var row = event(name); if (row) capture([row]); }
  function destination() { return 'https://wa.me/' + PHONE + '?text=' + encodeURIComponent(MESSAGE); }
  function isCta(node) {
    return !!node && (node.id === 'preco_89' || (node.tagName === 'A' && typeof node.getAttribute === 'function' &&
      node.getAttribute('data-product') === 'vit_power_ec' && node.getAttribute('data-vsl-source') === SOURCE &&
      node.getAttribute('data-whatsapp-phone') === PHONE));
  }
  function annotate() {
    var button = d.getElementById('preco_89') || d.querySelector('a[data-product="vit_power_ec"][data-vsl-source="https://taviazen.shop/vitpower_2026g"][data-whatsapp-phone="553171862958"]'); if (!button) return;
    button.removeAttribute('onclick'); button.setAttribute('data-product', 'vit_power_ec');
    button.setAttribute('data-vsl-source', SOURCE); button.setAttribute('data-whatsapp-phone', PHONE);
    button.setAttribute('data-whatsapp-message', MESSAGE);
    if (button.tagName === 'A') { button.href = destination(); button.removeAttribute('target'); }
  }
  function collectName() {
    return new Promise(function (resolve) {
      var previous = d.activeElement;
      var dialog = d.createElement('dialog');
      dialog.setAttribute('aria-label', 'Habla con Ana sobre Vit Power');
      dialog.style.cssText = 'border:0;border-radius:18px;padding:24px;max-width:360px;width:calc(100% - 48px);box-sizing:border-box;font:16px/1.5 system-ui;color:#12382d;background:#fff;box-shadow:0 16px 70px #0005';
      var form = d.createElement('form'); form.method = 'dialog';
      var title = d.createElement('h2'); title.textContent = '¡Hola! ¿Cómo te llamas?'; title.style.cssText = 'font-size:22px;margin:0 0 8px';
      var intro = d.createElement('p'); intro.textContent = 'Ana te ayudará con tus dudas sobre Vit Power.';
      var label = d.createElement('label'); label.textContent = 'Tu primer nombre (opcional)'; label.htmlFor = 'vp-first-name';
      var input = d.createElement('input'); input.id = 'vp-first-name'; input.name = 'given-name'; input.autocomplete = 'given-name'; input.maxLength = 40;
      input.style.cssText = 'display:block;box-sizing:border-box;width:100%;padding:12px;border:1px solid #b4d9cb;border-radius:8px;font:inherit;margin:8px 0 16px';
      var submit = d.createElement('button'); submit.type = 'submit'; submit.textContent = 'Continuar por WhatsApp';
      submit.style.cssText = 'width:100%;padding:14px;background:#078450;color:white;border:0;border-radius:9px;font:600 16px system-ui;cursor:pointer';
      var cancel = d.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Volver al video'; cancel.style.cssText = 'display:block;margin:12px auto 0;background:none;border:0;font:inherit;color:#466';
      var settled = false;
      function done(value) { if (settled) return; settled = true; dialog.close(); dialog.remove(); if (previous && previous.focus) previous.focus(); resolve(value); }
      cancel.addEventListener('click', function () { done(null); });
      dialog.addEventListener('cancel', function (event) { event.preventDefault(); done(null); });
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var name = String(input.value || '').trim().split(/\s+/)[0] || '';
        if (name && !/^[\p{L}][\p{L}'’-]{0,39}$/u.test(name)) { input.setCustomValidity('Escribe solamente tu primer nombre.'); input.reportValidity(); return; }
        input.setCustomValidity(''); done(name);
      });
      input.addEventListener('input', function () { input.setCustomValidity(''); });
      [title, intro, label, input, submit, cancel].forEach(function (node) { form.appendChild(node); });
      dialog.appendChild(form); d.body.appendChild(dialog); dialog.showModal(); input.focus();
    });
  }
  d.addEventListener('click', function (e) {
    var chain = e.composedPath ? e.composedPath() : [e.target];
    var button = chain.find(isCta);
    if (!button && e.target && e.target.closest) {
      var candidate = e.target.closest('#preco_89, a[data-product="vit_power_ec"]');
      if (isCta(candidate)) button = candidate;
    }
    if (!button) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (busy) return; busy = true;
    var trusted = e.isTrusted === true && e.button === 0;
    if (trusted) track('CtaClick');
    collectName().then(function (name) {
      if (name === null) return;
      var rows = [], row = trusted ? event('Contact') : null; if (row) rows.push(row);
      var sent = rows.length ? capture(rows) : Promise.resolve(null);
      return Promise.race([sent, new Promise(function (resolve) { w.setTimeout(resolve, 900); })]).then(function () {
        var message = MESSAGE + (name ? '\nNombre: ' + name : '');
        // Name goes only in the customer-reviewed WhatsApp message, never in Meta parameters.
        w.location.assign('https://wa.me/' + PHONE + '?text=' + encodeURIComponent(message));
      });
    }).catch(function () {
      // Unsupported forms retain access to the official WhatsApp without a name.
      w.location.assign(destination());
    }).finally(function () { w.setTimeout(function () { busy = false; }, 1200); });
  }, true);
  function visible() {
    if (!ready()) return;
    track('PageView');
    var hero = d.querySelector('.vp-hero, .exutra-page-header');
    if (hero && w.IntersectionObserver && !state.observer) {
      state.observer = new w.IntersectionObserver(function (entries) {
        if (entries.some(function (x) { return x.isIntersecting; })) { track('ViewContent'); state.observer.disconnect(); }
      }); state.observer.observe(hero);
    }
  }
  annotate(); new MutationObserver(annotate).observe(d.documentElement, { childList: true, subtree: true });
  d.addEventListener('visibilitychange', visible);
  w.addEventListener('vitalismen:marketing-consent', visible);
  visible();
})(window, document);

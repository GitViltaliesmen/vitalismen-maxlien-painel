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
  function annotate() {
    var button = d.getElementById('preco_89'); if (!button) return;
    button.removeAttribute('onclick'); button.setAttribute('data-product', 'vit_power_ec');
    button.setAttribute('data-vsl-source', SOURCE); button.setAttribute('data-whatsapp-phone', PHONE);
    button.setAttribute('data-whatsapp-message', MESSAGE);
    if (button.tagName === 'A') { button.href = destination(); button.removeAttribute('target'); }
  }
  d.addEventListener('click', function (e) {
    var chain = e.composedPath ? e.composedPath() : [e.target];
    var button = chain.find(function (n) { return n && n.id === 'preco_89'; });
    if (!button && e.target && e.target.closest) button = e.target.closest('#preco_89');
    if (!button) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (busy) return; busy = true;
    var rows = [];
    if (e.isTrusted === true && e.button === 0) ['CtaClick', 'Contact'].forEach(function (name) { var row = event(name); if (row) rows.push(row); });
    var sent = rows.length ? capture(rows) : Promise.resolve(null);
    // Do not block a commercial click when measurement or the network fails.
    Promise.race([sent, new Promise(function (resolve) { w.setTimeout(resolve, 900); })]).then(function () {
      var message = MESSAGE + (permitted() && state.reference ? '\nVisita: ' + state.reference : '');
      w.location.assign('https://wa.me/' + PHONE + '?text=' + encodeURIComponent(message));
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

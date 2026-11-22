(function () {
  'use strict';

  if (!/^\/(tex|bienestar|vitpower|vitpoers)\/?$/.test(window.location.pathname) || window.VitpowerMeta) return;
  var pixel = '1100892582698669';
  var endpoint = '/api/public/vitpower-meta';
  var key = 'vitpower_meta_pending_v2:' + pixel + ':';
  var attribution = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_content',
    'utm_term', 'fbclid', 'campaign_id', 'adset_id', 'ad_id', 'placement'];
  var denied = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' ||
    window.metaTrackingConsent === false;
  try { denied = denied || localStorage.getItem('meta_tracking_consent') === 'denied'; } catch (_) {}
  if (denied) {
    try {
      Object.keys(localStorage).filter(function (name) { return name.startsWith(key); })
        .forEach(function (name) { localStorage.removeItem(name); });
    } catch (_) {}
    window.VitpowerMeta = { initiateCheckout: function () {} };
    return;
  }

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
  }
  function cookie(name) {
    var item = document.cookie.split('; ').find(function (value) { return value.startsWith(name + '='); });
    if (!item) return '';
    try { return decodeURIComponent(item.slice(name.length + 1)); } catch (_) { return ''; }
  }
  function setCookie(name, value) {
    document.cookie = name + '=' + encodeURIComponent(value) + '; Path=/; Max-Age=7776000; SameSite=Lax; Secure';
    return value;
  }
  var external = cookie('ext_id');
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(external)) external = setCookie('ext_id', uuid());
  var fbp = cookie('_fbp');
  if (!/^fb\.\d{1,2}\.\d{10,16}\.[A-Za-z0-9_.-]+$/.test(fbp)) {
    var random = new Uint32Array(1);
    window.crypto.getRandomValues(random);
    fbp = setCookie('_fbp', 'fb.1.' + Date.now() + '.' + random[0]);
  }
  var original = new URL(window.location.href);
  var source = new URL(original.origin + original.pathname);
  attribution.forEach(function (name) {
    var value = original.searchParams.get(name);
    if (value) source.searchParams.set(name, value.slice(0, 256));
  });
  var fbclid = original.searchParams.get('fbclid');
  var fbc = cookie('_fbc');
  if (fbclid && /^[A-Za-z0-9_.-]{1,400}$/.test(fbclid) && (!fbc || fbc.split('.').slice(3).join('.') !== fbclid)) {
    fbc = setCookie('_fbc', 'fb.1.' + Date.now() + '.' + fbclid);
  }
  var matchingConsent = window.vitpowerMetaMatchingConsent === true;
  var provided = window.vitpowerMetaUserData || {};
  var advanced = { external_id: external };
  var fields = { email: 'em', phone: 'ph', first_name: 'fn', last_name: 'ln',
    city: 'ct', state: 'st', postal_code: 'zp', country: 'country' };
  if (matchingConsent) Object.keys(fields).forEach(function (name) {
    if (typeof provided[name] !== 'string') return;
    var value = provided[name].trim().slice(0, 256).toLowerCase();
    if (name === 'phone') {
      if (!/^\+\d[\d\s().-]{6,24}$/.test(value)) return;
      value = value.replace(/\D/g, '');
      if (!/^\d{7,15}$/.test(value)) return;
    } else if (name === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return;
    } else {
      value = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      if (name === 'country' && !/^[a-z]{2}$/.test(value)) return;
    }
    if (value) advanced[fields[name]] = value;
  });
  var matchingHashes = {};
  var matchingReady = Promise.resolve();
  if (matchingConsent && window.crypto.subtle) matchingReady = Promise.all(Object.keys(fields).map(function (name) {
    var field = fields[name];
    if (!advanced[field]) return Promise.resolve();
    return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(advanced[field])).then(function (buffer) {
      matchingHashes[field] = Array.from(new Uint8Array(buffer), function (byte) {
        return byte.toString(16).padStart(2, '0');
      }).join('');
    });
  })).catch(function () {});

  if (!window.fbq) {
    var fbq = window.fbq = function () {
      if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
      else fbq.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }
  window.fbq('set', 'autoConfig', false, pixel);
  window.fbq('init', pixel, advanced);

  var pending = [];
  var inFlight = new Set();
  // V256: accept only a proven Tex CTA click; discard queued legacy Tex checkout.
  function isTexCheckout(item) {
    if (!item || item.event_name !== 'InitiateCheckout' || item.cta_rule === 'tex_cta_click_v256') return false;
    try {
      var url = new URL(item.event_source_url);
      return /^(www\.)?plusmen\.shop$/.test(url.hostname) && /^\/tex\/?$/.test(url.pathname);
    } catch (_) { return false; }
  }
  function restore() {
    try {
      Object.keys(localStorage).filter(function (name) { return name.startsWith(key); }).forEach(function (name) {
        var item;
        try { item = JSON.parse(localStorage.getItem(name)); } catch (_) {}
        if (isTexCheckout(item)) { localStorage.removeItem(name); return; }
        if (!item || !/^vp_[a-zA-Z0-9_-]{20,100}$/.test(item.event_id || '') ||
            item.event_time <= Date.now() / 1000 - 604800 ||
            !['PageView', 'ViewContent', 'InitiateCheckout'].includes(item.event_name)) {
          localStorage.removeItem(name);
        } else if (!pending.some(function (current) { return current.event_id === item.event_id; })) pending.push(item);
      });
    } catch (_) {}
  }
  function persist(item) {
    try { localStorage.setItem(key + item.event_id, JSON.stringify(item)); } catch (_) {}
  }
  function acknowledge(id) {
    pending = pending.filter(function (item) { return item.event_id !== id; });
    try { localStorage.removeItem(key + id); } catch (_) {}
  }
  function deliver(item, urgent) {
    var body = JSON.stringify(item);
    if (urgent && navigator.sendBeacon) {
      try { navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' })); } catch (_) {}
    }
    if (inFlight.has(item.event_id)) return;
    inFlight.add(item.event_id);
    window.fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin', body: body, keepalive: true }).then(function (response) {
      return response.json();
    }).then(function (result) {
      if (result.ok && result.queued && result.event_id === item.event_id) acknowledge(item.event_id);
    }).catch(function () {}).finally(function () { inFlight.delete(item.event_id); });
  }
  function flush(urgent) {
    restore();
    pending.slice(0, 30).forEach(function (item) { deliver(item, urgent); });
  }
  function emit(name, urgent, ctaRule) {
    if (isTexCheckout({ event_name: name, event_source_url: source.href, cta_rule: ctaRule })) return;
    var custom = {};
    attribution.forEach(function (field) {
      if (field !== 'fbclid' && source.searchParams.has(field)) custom[field] = source.searchParams.get(field);
    });
    var plusmenTex = /^(www\.)?plusmen\.shop$/.test(source.hostname) && /^\/tex\/?$/.test(source.pathname);
    if (name !== 'PageView') Object.assign(custom, { content_ids: [plusmenTex ? 'tex_ultra_ec' : 'vitpower'], content_type: 'product',
      content_name: plusmenTex ? 'Tex Ultra Ecuador' : 'VitPower', num_items: 1 });
    var item = { pixel_id: pixel, event_name: name, event_id: 'vp_' + uuid(), event_time: Math.floor(Date.now() / 1000),
      event_source_url: source.href, fbp: fbp, fbc: fbc, external_id: external };
    if (ctaRule === 'tex_cta_click_v256') item.cta_rule = ctaRule;
    if (matchingConsent && Object.keys(matchingHashes).length) {
      item.matching_consent = true;
      item.matching_hashes = Object.assign({}, matchingHashes);
    }
    pending.push(item);
    persist(item);
    try { window.fbq('trackSingle', pixel, name, custom, { eventID: item.event_id }); } catch (_) {}
    deliver(item, urgent);
    return item.event_id;
  }

  // V243: anonymous first touch; verified contacts only. Never reads form name/phone.
  var measurementKey = 'tex_measurement_v243', measurementRef = '', measurementBusy = false;
  try { var savedMeasurement = JSON.parse(localStorage.getItem(measurementKey) || 'null');
    if (savedMeasurement && savedMeasurement.expiresAt > Date.now() && /^TX243-[a-f0-9]{64}$/.test(savedMeasurement.reference || '')) measurementRef = savedMeasurement.reference;
  } catch (_) {}
  function measurementAllowed() {
    if (navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.metaTrackingConsent === false) return false;
    try { return localStorage.getItem('meta_tracking_consent') !== 'denied'; } catch (_) { return false; }
  }
  window.TexUltraMeasurementV243 = { reference: function () { return measurementAllowed() ? measurementRef : ''; } };
  function measurementRequest(body) {
    return window.fetch('/api/public/tex-measurement', { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).then(function (r) { return r.json(); });
  }
  function measurementStatus() {
    if (!measurementRef || measurementBusy || !measurementAllowed()) return;
    measurementBusy = true;
    measurementRequest({ action: 'status', reference: measurementRef }).then(function (r) {
      if (!r.ok || r.confirmed !== true || !/^tex243_lead_[a-f0-9]{64}$/.test(r.eventId || '') || !Number.isInteger(r.eventTime)) return;
      if (Date.now() / 1000 - r.eventTime > 1800 || r.eventTime > Date.now() / 1000 + 60) return;
      var sentKey = 'tex_measurement_lead_v243:' + r.eventId;
      try { if (localStorage.getItem(sentKey)) return; localStorage.setItem(sentKey, 'attempted'); }
      catch (_) { return; } // Storage failure cannot cause repeated Lead attempts.
      try { window.fbq('trackSingle', pixel, 'Lead', r.customData || {}, { eventID: r.eventId }); } catch (_) {}
    }).catch(function () {}).finally(function () { measurementBusy = false; });
  }
  measurementRequest({ action: 'issue', reference: measurementRef, event_source_url: source.href,
    fbp: fbp, fbc: fbc, external_id: external }).then(function (r) {
    if (!r.ok || !/^TX243-[a-f0-9]{64}$/.test(r.reference || '') || !Number.isFinite(r.expiresAt)) return;
    measurementRef = r.reference;
    try { localStorage.setItem(measurementKey, JSON.stringify({ reference: measurementRef, expiresAt: r.expiresAt })); } catch (_) {}
    measurementStatus();
  }).catch(function () {});
  window.addEventListener('pageshow', measurementStatus);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') measurementStatus(); });
  // Read-only receipt checks; no events are invented by this timer.
  window.setInterval(function () { if (document.visibilityState === 'visible') measurementStatus(); }, 15000);

  var lastCheckout = 0, texCtaEventId = '';
  var texCtaKey = 'tex_cta_checkout_v256:' + pixel;
  try { texCtaEventId = sessionStorage.getItem(texCtaKey) || ''; } catch (_) {}
  window.VitpowerMeta = {
    initiateCheckout: function (sourceAction) {
      var tex = /^(www\.)?plusmen\.shop$/.test(source.hostname) && /^\/tex\/?$/.test(source.pathname);
      if (tex) {
        if (sourceAction !== 'tex_cta_click_v256' || texCtaEventId) return texCtaEventId || undefined;
        texCtaEventId = emit('InitiateCheckout', true, sourceAction) || '';
        if (texCtaEventId) try { sessionStorage.setItem(texCtaKey, texCtaEventId); } catch (_) {}
        return texCtaEventId;
      }
      if (Date.now() - lastCheckout < 1500) return;
      lastCheckout = Date.now();
      return emit('InitiateCheckout', true);
    }
  };
  flush(false);
  matchingReady.then(function () { emit('PageView', false); });
  function viewContent() {
    matchingReady.then(function () {
      if (document.querySelector('vturb-smartplayer')) emit('ViewContent', false);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', viewContent, { once: true });
  else viewContent();
  window.addEventListener('online', function () { flush(false); });
  window.addEventListener('pagehide', function () { flush(true); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush(true);
  });
  window.setInterval(function () { flush(false); }, 15000);
})();

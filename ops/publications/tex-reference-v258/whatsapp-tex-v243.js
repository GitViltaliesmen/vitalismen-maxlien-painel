(function () {
  'use strict';

  if (!/^(www\.)?plusmen\.shop$/.test(window.location.hostname) || !/^\/tex\/?$/.test(window.location.pathname)) return;

  var phone = '553171862958';
  var baseMessage = 'Hola, quiero el tratamiento Tex Ultra.';
  var opening = false;

  window.addEventListener('click', function (event) {
    // composedPath also finds buttons rendered inside the video's shadow DOM.
    var nodes = typeof event.composedPath === 'function' ? event.composedPath() : [];
    var button = nodes.find(function (node) {
      return node && node.nodeType === 1 && node.id === 'preco_89';
    });
    if (!button && event.target && event.target.closest) {
      button = event.target.closest('#preco_89');
    }
    if (!button || button.disabled) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (opening) return;
    opening = true;

    // Operator-defined Tex commercial checkout begins at this proven order CTA click.
    try { window.VitpowerMeta?.initiateCheckout('tex_cta_click_v256'); } catch (_) {}

    var code = '';
    try { code = window.TexUltraMeasurementV243?.displayCode() || ''; } catch (_) {}
    var message = baseMessage + (/^VID-[0-9A-HJKMNPQRSTVWXYZ]{8}$/.test(code)
      ? '\nVi Tex Ultra en el video y deseo el tratamiento.\nRef: ' + code : '');
    var text = encodeURIComponent(message);
    var appUrl = 'whatsapp://send?phone=' + phone + '&text=' + text;
    var fallbackUrl = 'https://wa.me/' + phone + '?text=' + text;

    button.setAttribute('data-whatsapp-phone', phone);
    button.setAttribute('data-whatsapp-message', message);

    var timer;
    function finish() {
      window.clearTimeout(timer);
      window.removeEventListener('pagehide', finish);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      opening = false;
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') finish();
    }

    window.addEventListener('pagehide', finish);
    document.addEventListener('visibilitychange', onVisibilityChange);
    timer = window.setTimeout(function () {
      finish();
      if (document.visibilityState !== 'hidden') window.location.assign(fallbackUrl);
    }, 1500);

    try {
      window.location.assign(appUrl);
    } catch (_) {
      finish();
      window.location.assign(fallbackUrl);
    }
  }, true);
})();

/* BEGIN TEX_CTA_CLEAR_V248 */
(function () {
  'use strict';
  if (!/^(www\.)?plusmen\.shop$/.test(location.hostname) || !/^\/tex\/?$/.test(location.pathname)) return;
  var label = 'PEDIR TEX ULTRA POR WHATSAPP';
  var css = '#preco_89{background:#128c4b!important;color:#fff!important;border:0!important;border-radius:12px!important;min-height:60px!important;padding:16px 20px!important;font-family:Arial,sans-serif!important;font-size:clamp(16px,4.5vw,21px)!important;font-weight:700!important;line-height:1.25!important;letter-spacing:0!important;text-align:center!important;box-sizing:border-box!important;max-width:100%!important;white-space:normal!important}#preco_89:focus-visible{outline:3px solid #153f28!important;outline-offset:4px!important}';
  var roots = new Set(), scheduled = false;
  function scan(root) {
    if (!root || roots.size >= 32 && !roots.has(root)) return;
    if (!roots.has(root)) {
      roots.add(root);
      new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
    }
    root.querySelectorAll('#preco_89').forEach(function (button) {
      if (button.tagName !== 'BUTTON') return;
      if (button.textContent !== label) button.textContent = label;
      if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      if (!root.querySelector('#tex-cta-style-v248')) {
        var style = document.createElement('style'); style.id = 'tex-cta-style-v248'; style.textContent = css;
        (root.head || root).appendChild(style);
      }
    });
    root.querySelectorAll('*').forEach(function (node) { if (node.shadowRoot) scan(node.shadowRoot); });
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () { scheduled = false; scan(document); });
  }
  function start() { scan(document); window.setInterval(schedule, 2000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
/* END TEX_CTA_CLEAR_V248 */

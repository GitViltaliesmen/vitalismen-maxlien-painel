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

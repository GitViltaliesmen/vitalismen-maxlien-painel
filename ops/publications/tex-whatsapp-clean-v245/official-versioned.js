(function () {
  'use strict';

  if (!/^(www\.)?plusmen\.shop$/.test(window.location.hostname) || !/^\/tex\/?$/.test(window.location.pathname)) return;

  var phone = '553171862958';
  var message = 'Hola, quiero el tratamiento Tex Ultra.';
  var text = encodeURIComponent(message);
  var appUrl = 'whatsapp://send?phone=' + phone + '&text=' + text;
  var fallbackUrl = 'https://wa.me/' + phone + '?text=' + text;
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

    // Queue both channels before handing control to the WhatsApp app.
    try {
      if (window.VitpowerMeta) window.VitpowerMeta.initiateCheckout();
    } catch (_) {}

    // An opaque visit reference links the customer's own inbound; the destination is unchanged.
    var selectedMessage = message;
    try { var reference = window.TexUltraMeasurementV243 && window.TexUltraMeasurementV243.reference();
      if (/^TX243-[a-f0-9]{64}$/.test(reference || '')) selectedMessage += '\nReferencia: ' + reference;
    } catch (_) {}
    var selectedText = encodeURIComponent(selectedMessage);
    var selectedAppUrl = 'whatsapp://send?phone=' + phone + '&text=' + selectedText;
    var selectedFallbackUrl = 'https://wa.me/' + phone + '?text=' + selectedText;
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
      if (document.visibilityState !== 'hidden') window.location.assign(selectedFallbackUrl);
    }, 1500);

    try {
      window.location.assign(selectedAppUrl);
    } catch (_) {
      finish();
      window.location.assign(selectedFallbackUrl);
    }
  }, true);
})();

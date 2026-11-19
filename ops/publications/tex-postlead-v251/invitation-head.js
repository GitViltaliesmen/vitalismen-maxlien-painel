(function () {
  'use strict';
  var match = /^#chat=([a-f0-9]{64})$/.exec(window.location.hash || '');
  if (!match) return;
  window.__texChatInvitationPageV251 = true;
  document.documentElement.setAttribute('data-tex-invitation-v251', '');
  var style = document.createElement('style');
  style.textContent = 'html[data-tex-invitation-v251] .uihiui{display:none!important}';
  document.head.appendChild(style);
  Object.defineProperty(window, '__texInviteTokenV251', { value: match[1], configurable: true });
  // Remove the private fragment before Meta, video or analytics scripts execute.
  try { window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search); }
  catch (_) { window.metaTrackingConsent = false; }
})();

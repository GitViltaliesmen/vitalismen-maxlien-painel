// EC transport selection is explicit during a provider cutover. An invalid
// value must never silently restore the previous outbound provider.
export const ecTransportMode = (env = process.env) => {
    const mode = String(env.EC_WHATSAPP_TRANSPORT || 'zapi').trim().toLowerCase();
    if (mode !== 'zapi' && mode !== 'baileys_text') {
        throw new Error('ec_whatsapp_transport_invalid');
    }
    return mode;
};

export const ecBaileysTextMode = (env = process.env) => ecTransportMode(env) === 'baileys_text';

// Linked-device media is limited to an authenticated EC manual-panel request.
// Automatic funnels remain text only until their assets are separately approved.
export const ecMediaAllowedForTransport = (env = process.env, options = {}) => (
    !ecBaileysTextMode(env)
    || (options.sendMode === 'manual_panel'
        && options.manualPanelMediaAuthorized === true
        && options.country === 'EC'
        && globalThis.__VITALISMEN_EC_BAILEYS_INGRESS_V265?.isCurrent?.() === true)
);

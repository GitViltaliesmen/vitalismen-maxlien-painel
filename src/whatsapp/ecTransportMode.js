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

// The first linked-device release is text only. Refuse media at the sender
// boundary so no funnel can silently send an unreviewed asset via Baileys.
export const ecMediaAllowedForTransport = (env = process.env) => !ecBaileysTextMode(env);

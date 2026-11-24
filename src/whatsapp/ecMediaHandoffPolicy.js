export const applyEcMediaHandoff = (state, kind = 'media') => {
    if (!state) throw new Error('ec_media_handoff_contact_missing');
    if (state.human?.lastManualBy === 'ec_baileys_media_handoff'
        && state.metadata?.operatorNoAutoResend === true) return { recorded: true, duplicate: true };
    state.human = {
        ...(state.human || {}), mode: 'manual', pausedUntil: null,
        lastManualAt: new Date(), lastManualBy: 'ec_baileys_media_handoff',
        note: `Etapa de ${kind} requer midia; atendimento humano necessario.`
    };
    state.tags = [...new Set([...(state.tags || []), 'manual:no_auto_resend'])];
    state.metadata = { ...(state.metadata || {}), operatorNoAutoResend: true,
        lastHumanHoldReason: 'ec_baileys_media_handoff' };
    return { recorded: true };
};

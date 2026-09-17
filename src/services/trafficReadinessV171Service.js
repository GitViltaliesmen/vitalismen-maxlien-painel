export const evaluateTrafficReadinessV171 = ({
    health = {},
    vslEntry = {},
    panelPass = false,
    authPass = false
} = {}) => {
    const safety = health.automationSafety || {};
    const reasons = [];
    if (health.status !== 'online') reasons.push('health_not_online');
    if (safety.mode !== 'EC_BOT_CORE_OPERATIONAL' || safety.policy !== 'EC_BOT_CORE_OPERATIONAL') reasons.push('main_runtime_not_operational');
    if (safety.strictReadOnly !== false || safety.operationalMutationsEnabled !== true) reasons.push('strict_read_only_or_mutations_disabled');
    if (safety.mutatingSchedulers !== 0) reasons.push('mutating_scheduler_enabled');
    if (safety.dropiApplyAllowed !== false || String(safety.dropiSyncMode || '') !== 'REPORT_ONLY') reasons.push('dropi_apply_not_blocked');
    if (vslEntry.accepted !== true || vslEntry.ignored === true || vslEntry.reason === 'strict_read_only') reasons.push('vsl_entry_not_persisted');
    if (panelPass !== true) reasons.push('panel_failed');
    if (authPass !== true) reasons.push('auth_failed');
    return Object.freeze({
        ready: reasons.length === 0,
        status: reasons.length === 0 ? 'YES' : 'NO',
        reasons: Object.freeze(reasons)
    });
};

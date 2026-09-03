import crypto from 'node:crypto';

export const POST_SALE_RUNTIME_VERSION = 66;
export const POST_SALE_DATA_COMPATIBILITY_VERSION = 66;
export const POST_SALE_SAFETY_STATE_ID = 'post-sale-safety-v66';

export const POST_SALE_STAGES = Object.freeze({
    GUIDE: 'GUIDE',
    IN_TRANSIT: 'IN_TRANSIT',
    READY_FOR_PICKUP: 'READY_FOR_PICKUP',
    RETURNED: 'RETURNED',
    PICKUP_REMINDER_DAY1: 'PICKUP_REMINDER_DAY1',
    PICKUP_REMINDER_SOFT_DAY2: 'PICKUP_REMINDER_SOFT_DAY2',
    PICKUP_REMINDER_DAY3: 'PICKUP_REMINDER_DAY3',
    PICKUP_REMINDER_SOFT_DAY4: 'PICKUP_REMINDER_SOFT_DAY4',
    PICKUP_REMINDER_DAY5: 'PICKUP_REMINDER_DAY5',
    PICKUP_REMINDER_SOFT_DAY6: 'PICKUP_REMINDER_SOFT_DAY6',
    PICKUP_PROOF_REQUEST: 'PICKUP_PROOF_REQUEST',
    PICKUP_BONUS: 'PICKUP_BONUS',
    TREATMENT_REFILL_REMINDER: 'TREATMENT_REFILL_REMINDER'
});

export const POST_SALE_VARIANTS = Object.freeze({
    GUIDE_TEXT: 'guide_text',
    GUIDE_PDF: 'guide_pdf',
    GUIDE_PRINT_IMAGE: 'guide_print_image',
    IN_TRANSIT_TEXT: 'in_transit_text',
    READY_FOR_PICKUP_TEXT: 'ready_for_pickup_text',
    READY_FOR_PICKUP_PDF: 'ready_for_pickup_pdf',
    READY_FOR_PICKUP_AUDIO: 'ready_for_pickup_audio',
    RETURNED_TEXT: 'returned_text',
    PICKUP_REMINDER_DAY1: 'pickup_reminder_day1',
    PICKUP_REMINDER_SOFT_DAY2: 'pickup_reminder_soft_day2',
    PICKUP_REMINDER_DAY3: 'pickup_reminder_day3',
    PICKUP_REMINDER_SOFT_DAY4: 'pickup_reminder_soft_day4',
    PICKUP_REMINDER_DAY5: 'pickup_reminder_day5',
    PICKUP_REMINDER_SOFT_DAY6: 'pickup_reminder_soft_day6',
    PICKUP_PROOF_REQUEST: 'pickup_proof_request',
    PICKUP_BONUS: 'pickup_bonus',
    TREATMENT_REFILL_REMINDER: 'treatment_refill_reminder'
});

const STAGE_BY_KIND_OR_VARIANT = Object.freeze({
    guide: POST_SALE_STAGES.GUIDE,
    GUIDE: POST_SALE_STAGES.GUIDE,
    guide_text: POST_SALE_STAGES.GUIDE,
    guide_pdf: POST_SALE_STAGES.GUIDE,
    guide_print_image: POST_SALE_STAGES.GUIDE,
    shipment_guide_text: POST_SALE_STAGES.GUIDE,
    shipment_invoice_pdf: POST_SALE_STAGES.GUIDE,
    shipment_guide_print: POST_SALE_STAGES.GUIDE,
    in_transit: POST_SALE_STAGES.IN_TRANSIT,
    IN_TRANSIT: POST_SALE_STAGES.IN_TRANSIT,
    in_transit_text: POST_SALE_STAGES.IN_TRANSIT,
    shipment_in_transit_text: POST_SALE_STAGES.IN_TRANSIT,
    ready_for_pickup: POST_SALE_STAGES.READY_FOR_PICKUP,
    READY_FOR_PICKUP: POST_SALE_STAGES.READY_FOR_PICKUP,
    ready_for_pickup_text: POST_SALE_STAGES.READY_FOR_PICKUP,
    ready_for_pickup_pdf: POST_SALE_STAGES.READY_FOR_PICKUP,
    ready_for_pickup_audio: POST_SALE_STAGES.READY_FOR_PICKUP,
    shipment_ready_for_pickup_text: POST_SALE_STAGES.READY_FOR_PICKUP,
    returned: POST_SALE_STAGES.RETURNED,
    RETURNED: POST_SALE_STAGES.RETURNED,
    returned_text: POST_SALE_STAGES.RETURNED,
    shipment_returned_text: POST_SALE_STAGES.RETURNED,
    pickup_reminder_day1: POST_SALE_STAGES.PICKUP_REMINDER_DAY1,
    PICKUP_REMINDER_DAY1: POST_SALE_STAGES.PICKUP_REMINDER_DAY1,
    pickup_reminder_soft_day2: POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY2,
    PICKUP_REMINDER_SOFT_DAY2: POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY2,
    pickup_reminder_day3: POST_SALE_STAGES.PICKUP_REMINDER_DAY3,
    PICKUP_REMINDER_DAY3: POST_SALE_STAGES.PICKUP_REMINDER_DAY3,
    pickup_reminder_soft_day4: POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY4,
    PICKUP_REMINDER_SOFT_DAY4: POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY4,
    pickup_reminder_day5: POST_SALE_STAGES.PICKUP_REMINDER_DAY5,
    PICKUP_REMINDER_DAY5: POST_SALE_STAGES.PICKUP_REMINDER_DAY5,
    pickup_reminder_soft_day6: POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY6,
    PICKUP_REMINDER_SOFT_DAY6: POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY6,
    pickup_proof_request: POST_SALE_STAGES.PICKUP_PROOF_REQUEST,
    PICKUP_PROOF_REQUEST: POST_SALE_STAGES.PICKUP_PROOF_REQUEST,
    shipment_pickup_proof_request_text: POST_SALE_STAGES.PICKUP_PROOF_REQUEST,
    pickup_bonus: POST_SALE_STAGES.PICKUP_BONUS,
    PICKUP_BONUS: POST_SALE_STAGES.PICKUP_BONUS,
    shipment_pickup_bonus_text: POST_SALE_STAGES.PICKUP_BONUS,
    treatment_refill_reminder: POST_SALE_STAGES.TREATMENT_REFILL_REMINDER,
    TREATMENT_REFILL_REMINDER: POST_SALE_STAGES.TREATMENT_REFILL_REMINDER,
    shipment_refill_reminder_text: POST_SALE_STAGES.TREATMENT_REFILL_REMINDER
});

export const LEGACY_MARKERS_BY_STAGE = Object.freeze({
    [POST_SALE_STAGES.GUIDE]: Object.freeze(['guiaNotifiedAt', 'guidePrintNotifiedAt']),
    [POST_SALE_STAGES.IN_TRANSIT]: Object.freeze(['inTransitNotifiedAt']),
    [POST_SALE_STAGES.READY_FOR_PICKUP]: Object.freeze(['readyForPickupNotifiedAt']),
    [POST_SALE_STAGES.RETURNED]: Object.freeze(['returnedNotifiedAt']),
    [POST_SALE_STAGES.PICKUP_REMINDER_DAY1]: Object.freeze(['reminderDay1At']),
    [POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY2]: Object.freeze(['reminderSoftDay2At']),
    [POST_SALE_STAGES.PICKUP_REMINDER_DAY3]: Object.freeze(['reminderDay3At']),
    [POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY4]: Object.freeze(['reminderSoftDay4At']),
    [POST_SALE_STAGES.PICKUP_REMINDER_DAY5]: Object.freeze(['reminderDay5At']),
    [POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY6]: Object.freeze(['reminderSoftDay6At']),
    [POST_SALE_STAGES.PICKUP_PROOF_REQUEST]: Object.freeze(['pickupProofRequestedAt']),
    [POST_SALE_STAGES.PICKUP_BONUS]: Object.freeze(['bonusNotifiedAt']),
    [POST_SALE_STAGES.TREATMENT_REFILL_REMINDER]: Object.freeze(['refillReminderAt'])
});

export const POST_SALE_TERMINAL_LEDGER_STATES = Object.freeze([
    'SENT',
    'AMBIGUOUS',
    'FAILED_FINAL',
    'RECOVERED_STRUCTURED',
    'RECOVERED_MANUAL',
    'SUPPRESSED_HISTORICAL'
]);

export const DROPI_SYNC_MODES = Object.freeze({
    REPORT_ONLY: 'REPORT_ONLY',
    DRY_RUN: 'DRY_RUN',
    APPLY: 'APPLY'
});

export const V66_MUTATION_AUTHORIZATION = 'I_UNDERSTAND_V66_OPERATIONAL_MUTATIONS';

const clean = (value = '') => String(value ?? '').trim();

export const canonicalPostSaleStage = (kindOrVariant = '') => (
    STAGE_BY_KIND_OR_VARIANT[clean(kindOrVariant)] || ''
);

export const legacyKindForPostSaleStage = (stage = '') => ({
    [POST_SALE_STAGES.GUIDE]: 'guide',
    [POST_SALE_STAGES.IN_TRANSIT]: 'in_transit',
    [POST_SALE_STAGES.READY_FOR_PICKUP]: 'ready_for_pickup',
    [POST_SALE_STAGES.RETURNED]: 'returned',
    [POST_SALE_STAGES.PICKUP_REMINDER_DAY1]: 'pickup_reminder_day1',
    [POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY2]: 'pickup_reminder_soft_day2',
    [POST_SALE_STAGES.PICKUP_REMINDER_DAY3]: 'pickup_reminder_day3',
    [POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY4]: 'pickup_reminder_soft_day4',
    [POST_SALE_STAGES.PICKUP_REMINDER_DAY5]: 'pickup_reminder_day5',
    [POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY6]: 'pickup_reminder_soft_day6',
    [POST_SALE_STAGES.PICKUP_PROOF_REQUEST]: 'pickup_proof_request',
    [POST_SALE_STAGES.PICKUP_BONUS]: 'pickup_bonus',
    [POST_SALE_STAGES.TREATMENT_REFILL_REMINDER]: 'treatment_refill_reminder'
}[canonicalPostSaleStage(stage)] || '');

export const buildPostSaleIdempotencyKey = ({ shipment = {}, stage = '', variant = '' } = {}) => {
    const canonicalStage = canonicalPostSaleStage(stage || variant);
    if (!canonicalStage) return '';
    const identity = [
        'post-sale-v66',
        clean(shipment?.country || 'EC').toUpperCase(),
        clean(shipment?.orderId),
        clean(shipment?.logistics?.trackingNumber),
        canonicalStage
    ].join('|');
    return `ps66:${crypto.createHash('sha256').update(identity).digest('hex')}`;
};

export const postSaleLedgerPath = (stage = '') => {
    const canonicalStage = canonicalPostSaleStage(stage);
    return canonicalStage ? `automation.postSaleSafetyLedger.${canonicalStage}` : '';
};

export const legacyMarkerSetForStage = (stage = '', at = new Date()) => {
    const canonicalStage = canonicalPostSaleStage(stage);
    return Object.fromEntries((LEGACY_MARKERS_BY_STAGE[canonicalStage] || []).map((marker) => [
        `automation.${marker}`,
        at
    ]));
};

export const terminalPostSaleSafetyEntry = (shipment = {}, stage = '') => {
    const canonicalStage = canonicalPostSaleStage(stage);
    const entry = shipment?.automation?.postSaleSafetyLedger?.[canonicalStage];
    return entry && POST_SALE_TERMINAL_LEDGER_STATES.includes(clean(entry.state).toUpperCase())
        ? entry
        : null;
};

export const resolvePostSaleOperationalMutationGate = (env = process.env, {
    compatibilityState = null
} = {}) => {
    const enabledRaw = clean(env.POST_SALE_V66_MUTATIONS_ENABLED);
    const authorizationRaw = clean(env.POST_SALE_V66_MUTATIONS_AUTHORIZATION);
    const bridgeRaw = clean(env.POST_SALE_V66_COMPATIBILITY_BRIDGE_READY);
    const requested = enabledRaw !== '';
    const enabledValid = enabledRaw === 'true';
    const authorizationValid = authorizationRaw === V66_MUTATION_AUTHORIZATION;
    const bridgeFlagValid = bridgeRaw === 'true';
    const persistentCompatibilityValid = Boolean(
        compatibilityState
        && compatibilityState.bridgeComplete === true
        && Number(compatibilityState.dataCompatibilityVersion) === POST_SALE_DATA_COMPATIBILITY_VERSION
        && Number(compatibilityState.minRuntimeVersion) <= POST_SALE_RUNTIME_VERSION
    );
    const allowed = enabledValid
        && authorizationValid
        && bridgeFlagValid
        && persistentCompatibilityValid;

    let reason = 'operational_mutations_authorized';
    if (!requested) reason = 'mutation_flag_absent_safe_default';
    else if (!enabledValid) reason = 'mutation_flag_invalid_or_false';
    else if (!authorizationValid) reason = 'mutation_authorization_missing_or_invalid';
    else if (!bridgeFlagValid) reason = 'compatibility_bridge_flag_missing_or_invalid';
    else if (!persistentCompatibilityValid) reason = 'persistent_data_compatibility_not_ready';

    return {
        allowed,
        requested,
        reason,
        mode: allowed ? 'OPERATIONAL_MUTATIONS_ENABLED' : 'SAFE_OBSERVATION_ONLY',
        runtimeVersion: POST_SALE_RUNTIME_VERSION,
        dataCompatibilityVersion: POST_SALE_DATA_COMPATIBILITY_VERSION,
        enabledValid,
        authorizationValid,
        bridgeFlagValid,
        persistentCompatibilityValid
    };
};

export const resolveDropiSyncMode = (env = process.env, {
    compatibilityState = null
} = {}) => {
    const requestedRaw = clean(env.DROPPI_EC_ACTIVE_SYNC_MODE).toUpperCase();
    const validRequestedMode = Object.values(DROPI_SYNC_MODES).includes(requestedRaw);
    const requestedMode = validRequestedMode ? requestedRaw : DROPI_SYNC_MODES.REPORT_ONLY;
    const mutationGate = resolvePostSaleOperationalMutationGate(env, { compatibilityState });
    const applyAllowed = requestedMode === DROPI_SYNC_MODES.APPLY && mutationGate.allowed;
    const effectiveMode = applyAllowed ? DROPI_SYNC_MODES.APPLY : requestedMode === DROPI_SYNC_MODES.DRY_RUN
        ? DROPI_SYNC_MODES.DRY_RUN
        : DROPI_SYNC_MODES.REPORT_ONLY;
    return {
        requestedMode: requestedRaw || DROPI_SYNC_MODES.REPORT_ONLY,
        effectiveMode,
        validRequestedMode: requestedRaw === '' || validRequestedMode,
        applyAllowed,
        readOnly: effectiveMode !== DROPI_SYNC_MODES.APPLY,
        reason: requestedMode === DROPI_SYNC_MODES.APPLY && !applyAllowed
            ? `apply_blocked:${mutationGate.reason}`
            : requestedRaw && !validRequestedMode
                ? 'invalid_mode_fail_closed_to_report_only'
                : `mode_${effectiveMode.toLowerCase()}`,
        mutationGate
    };
};

export const assertRuntimeSupportsPostSaleData = ({
    runtimeVersion = POST_SALE_RUNTIME_VERSION,
    compatibilityState = null
} = {}) => {
    if (!compatibilityState) {
        return { ok: true, reason: 'no_persistent_compatibility_state', runtimeVersion };
    }
    const minimum = Number(compatibilityState.minRuntimeVersion || 0);
    if (!Number.isFinite(minimum) || Number(runtimeVersion) < minimum) {
        return {
            ok: false,
            reason: 'runtime_older_than_persistent_data_contract',
            runtimeVersion: Number(runtimeVersion),
            minRuntimeVersion: minimum
        };
    }
    return {
        ok: true,
        reason: 'runtime_compatible_with_persistent_data',
        runtimeVersion: Number(runtimeVersion),
        minRuntimeVersion: minimum
    };
};

const enabled = (env, key) => String(env?.[key] || '').trim().toLowerCase() === 'true';

export const postSaleRuntimeDiagnosisV146 = (env = process.env) => {
    const schedulerDisabled = String(env.DISABLE_SCHEDULER || '').trim() === '1';
    const required = {
        shipmentCarrierPolling: enabled(env, 'SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED'),
        shipmentDispatch: enabled(env, 'SHIPMENT_STATUS_DISPATCH_ENABLED'),
        pickupReminders: enabled(env, 'SHIPMENT_PICKUP_REMINDERS_ENABLED'),
        pickupProofSweep: enabled(env, 'PICKUP_PROOF_SWEEP_ENABLED')
    };
    const missing = Object.entries(required).filter(([, value]) => !value).map(([key]) => key);
    return Object.freeze({
        version: 146,
        operationalApproved: enabled(env, 'VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED'),
        schedulerDisabled,
        required,
        missing,
        running: !schedulerDisabled && missing.length === 0,
        rootCause: schedulerDisabled
            ? 'scheduler_registration_disabled'
            : (missing.length ? 'post_sale_flags_disabled' : 'none')
    });
};

export default postSaleRuntimeDiagnosisV146;

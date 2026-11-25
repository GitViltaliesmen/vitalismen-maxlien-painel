// Pure cycle policy. The runtime adapter supplies only the approved, already
// guarded post-sale stages; this module cannot access a provider or database.
let cycleRunning = false;

export const executePostSaleLinkedV270Cycle = async ({
    dryRun,
    now,
    forwardOnlySince,
    transportReady,
    windowOpen,
    reconcile,
    stages
}) => {
    if (cycleRunning) throw new Error('v270_cycle_already_running');
    if (typeof dryRun !== 'boolean' || !Array.isArray(stages) || stages.length === 0) {
        throw new Error('v270_cycle_contract_invalid');
    }
    const cutoff = new Date(forwardOnlySince);
    if (!Number.isFinite(cutoff.getTime()) || cutoff.getTime() > now.getTime()) {
        throw new Error('v270_cutoff_invalid');
    }
    if (!transportReady()) throw new Error('v270_linked_device_not_ready');
    cycleRunning = true;
    try {
        const open = Boolean(windowOpen(now));
        const report = { mode: dryRun ? 'dry-run' : 'run', windowOpen: open,
            physicalOutboundCount: 0, provider: '', providerMessageId: '', selected: '', stages: [], reconciliation: null };
        if (!dryRun && !open) return report;
        report.reconciliation = await reconcile({ now, forwardOnlySince: cutoff, dryRun });
        for (const { name, run } of stages) {
            if (!name || typeof run !== 'function') throw new Error('v270_stage_contract_invalid');
            const result = await run({ now, forwardOnlySince: cutoff, dryRun });
            const sent = Number(result?.sent ?? result?.bonusSent ?? 0);
            if (!Number.isSafeInteger(sent) || sent < 0 || sent > 1) {
                throw new Error('v270_outbound_limit_exceeded');
            }
            report.stages.push({ name, candidates: Number(result?.candidates ?? 0),
                ready: Number(result?.ready ?? result?.selected ?? 0), sent });
            // A selected notification may have reached the provider even if its
            // local ledger write failed. Never try a second stage in that cycle.
            if (sent || (!dryRun && Number(result?.ready ?? result?.selected ?? 0) > 0)) {
                report.selected = name;
                report.physicalOutboundCount = sent;
                report.provider = String(result?.provider || '');
                report.providerMessageId = String(result?.providerMessageId || '');
                break;
            }
        }
        if (dryRun && report.physicalOutboundCount !== 0) throw new Error('v270_dry_run_sent');
        return report;
    } finally {
        cycleRunning = false;
    }
};

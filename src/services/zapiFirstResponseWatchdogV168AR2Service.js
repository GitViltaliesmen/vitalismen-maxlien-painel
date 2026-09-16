export const ZAPI_FIRST_RESPONSE_WATCHDOG_VERSION_V168A_R2 = 'V168A_R2';

const clean = (value = '') => String(value ?? '').trim();
const flagIsFalse = (value) => clean(value).toLowerCase() === 'false';

export const zapiFirstResponseWatchdogEnabledV168AR2 = (env = process.env) => (
    !flagIsFalse(env.ZAPI_CHAT_WATCHDOG_ENABLED)
    && !flagIsFalse(env.VSL_FIRST_RESPONSE_WATCHDOG_ENABLED)
);

export const canonicalWatchdogProviderMessageIdV168AR2 = (value = '') => {
    const id = clean(value);
    if (!id || /_watchdog_/i.test(id)) return '';
    return id;
};

export const watchdogProviderMessageAlreadyProcessedV168AR2 = async ({
    providerMessageId,
    model
} = {}) => {
    const canonicalId = canonicalWatchdogProviderMessageIdV168AR2(providerMessageId);
    if (!canonicalId || !model?.exists) return true;
    const found = await model.exists({
        $or: [
            { _id: canonicalId },
            { providerMessageId: canonicalId },
            { providerZaapId: canonicalId },
            { externalId: canonicalId }
        ]
    }).catch(() => true);
    return Boolean(found);
};

export const scheduleZapiFirstResponseWatchdogV168AR2 = ({
    result = {},
    env = process.env,
    delayMs = 75000,
    setTimer = setTimeout,
    now = () => new Date(),
    hasRecentOutbound,
    providerAlreadyProcessed,
    routeInbound,
    markStatus,
    onWarning = () => {},
    onError = () => {}
} = {}) => {
    if (!zapiFirstResponseWatchdogEnabledV168AR2(env)) {
        return Object.freeze({ scheduled: false, reason: 'watchdog_disabled_at_schedule' });
    }
    if (!result.publicVslLeadEntry || !result.routeToBot) {
        return Object.freeze({ scheduled: false, reason: 'watchdog_not_applicable' });
    }
    const providerMessageId = canonicalWatchdogProviderMessageIdV168AR2(result.providerMessageId);
    if (!providerMessageId) {
        return Object.freeze({ scheduled: false, reason: 'canonical_provider_message_id_required' });
    }

    const startedAt = now();
    const execute = async () => {
        if (!zapiFirstResponseWatchdogEnabledV168AR2(env)) {
            return Object.freeze({ executed: false, reason: 'watchdog_disabled_at_execution' });
        }
        try {
            if (await providerAlreadyProcessed(providerMessageId)) {
                await markStatus({
                    chatId: result.chatId,
                    phone: result.phone,
                    status: 'skipped',
                    reason: 'provider_message_already_processed'
                });
                return Object.freeze({ executed: false, reason: 'provider_message_already_processed' });
            }
            if (await hasRecentOutbound({ chatId: result.chatId, phone: result.phone, since: startedAt })) {
                await markStatus({
                    chatId: result.chatId,
                    phone: result.phone,
                    status: 'answered',
                    reason: 'outbound_found'
                });
                return Object.freeze({ executed: true, routed: false, reason: 'outbound_found' });
            }

            onWarning(`[ZAPI-WATCHDOG] lead VSL sem resposta; reprocessamento canônico -> ${result.chatId} | delayMs=${delayMs}`);
            await markStatus({
                chatId: result.chatId,
                phone: result.phone,
                status: 'reprocessing',
                reason: 'no_outbound_after_delay'
            });
            await routeInbound({
                id: providerMessageId,
                from: result.chatId,
                body: result.body,
                sessionId: 'zapi',
                senderPn: result.phone,
                recovered: true,
                fullMessage: { key: { senderPn: result.phone } }
            });
            const answered = await hasRecentOutbound({
                chatId: result.chatId,
                phone: result.phone,
                since: startedAt
            });
            await markStatus({
                chatId: result.chatId,
                phone: result.phone,
                status: answered ? 'reprocessed' : 'failed',
                reason: answered ? 'outbound_after_reprocess' : 'no_outbound_after_reprocess'
            });
            return Object.freeze({ executed: true, routed: true, reason: answered ? 'reprocessed' : 'no_outbound_after_reprocess' });
        } catch (error) {
            onError(error);
            await markStatus({
                chatId: result.chatId,
                phone: result.phone,
                status: 'failed',
                reason: error?.message || 'watchdog_error'
            });
            return Object.freeze({ executed: false, reason: 'watchdog_error' });
        }
    };
    const timer = setTimer(execute, delayMs);
    timer?.unref?.();
    return Object.freeze({ scheduled: true, reason: 'watchdog_scheduled', providerMessageId, execute });
};

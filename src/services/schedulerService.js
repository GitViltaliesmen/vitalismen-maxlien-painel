import { onWhatsAppReady, getStatus, getAllStatuses, startConfiguredWhatsAppSessions } from '../whatsapp/connection.js';
import {
    processInitialProductFollowups,
    processPendingCheckoutInfoFollowups,
    processPostSaleRepurchase30dFollowups
} from './reengagementService.js';
import { getPendingShipmentReminders, processShipmentPickupReminders } from './shipmentMessageService.js';
import {
    countShipmentDispatchCandidates,
    processCarrierStatusSweep,
    processShipmentStatusDispatch
} from './shipmentStatusDispatcherService.js';
import { processGuidePrintDispatch } from './guidePrintDispatcherService.js';
import { importConfirmedAdminPanelOrders } from './adminPanelImportService.js';
import { syncActiveDroppiEcuadorOrdersFromPanel } from './droppiEcuadorBrowserService.js';
import { processBacklogRecovery } from './backlogRecoveryService.js';
import {
    reconcileAdminPanelAtendimento,
    reconcileAdminLeadsToWhatsappPanel,
    reconcileRecentWhatsappContactsToAdminPanel
} from './adminPanelLeadReconciliationService.js';
import { processAdminBuyLaterFollowups } from './adminBuyLaterFollowupService.js';
import { processZapiChatWatchdog } from './zapiChatWatchdogService.js';
import { processPassiveFunnelObserver } from './passiveFunnelObserverService.js';
import { processNitrixFastStateJobs } from './nitrixFastStateService.js';
import { sendText } from '../whatsapp/sendText.js';

let isRunningProductFollowups = false;
let isRunningPendingCheckoutFollowups = false;
let isRunningPostSaleRepurchaseFollowups = false;
let isRunningPickupReminders = false;
let isRunningShipmentStatusDispatch = false;
let isRunningCarrierStatusSweep = false;
let isRunningGuidePrintDispatch = false;
let isRunningDropiActiveSync = false;
let isRunningAdminPanelImport = false;
let isRunningBacklogRecovery = false;
let isRunningAdminPanelAtendimentoReconcile = false;
let isRunningAdminBuyLaterFollowups = false;
let isRunningZapiChatWatchdog = false;
let isRunningPassiveFunnelObserver = false;
let isRunningNitrixFastState = false;
let lastHealthAlertAt = 0;
let lastHealthAlertKey = '';

const flagEnabled = (name, fallback = false) => {
    const raw = process.env[name];
    if (raw === undefined) return fallback;
    return String(raw).toLowerCase() === 'true' || raw === '1';
};

const parseNumber = (name, fallback) => {
    const parsed = Number.parseInt(String(process.env[name] || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseActions = (value) => String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const parseList = (value = '') => String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const healthAlertRecipients = () => [
    process.env.WHATSAPP_HEALTH_ALERT_RECIPIENTS,
    process.env.WHATSAPP_PRIORITY_TEST_PHONES,
    '5515998038637'
].flatMap(parseList)
    .map(digitsOnly)
    .filter(Boolean);

const adaptiveLimit = ({
    backlog = 0,
    enabledName,
    baseName,
    low = 3,
    medium = 5,
    high = 8,
    max = 8,
    mediumAt = 25,
    highAt = 60
}) => {
    const base = parseNumber(baseName, low);
    if (!flagEnabled(enabledName, true)) return base;
    const selected = backlog >= highAt ? high : (backlog >= mediumAt ? medium : base);
    return Math.max(1, Math.min(selected, max));
};

export const startScheduler = () => {
    console.log('Starting WhatsApp Recovery Scheduler...');

    console.log('[SCHEDULER] Legacy draft recovery removed from scheduler.');
    console.log('[SCHEDULER] Legacy pending-order funnel removed from scheduler.');
    console.log('[SCHEDULER] Legacy automatic shipment notifications removed from scheduler.');

    if (flagEnabled('WHATSAPP_PRODUCT_FOLLOWUP_ENABLED', true)) {
        setInterval(checkInitialProductFollowups, 60 * 1000);
    } else {
        console.log('[SCHEDULER] Product followups disabled. Set WHATSAPP_PRODUCT_FOLLOWUP_ENABLED=true to enable.');
    }
    if (flagEnabled('PENDING_CHECKOUT_FOLLOWUP_ENABLED', true)) {
        setInterval(checkPendingCheckoutFollowups, 60 * 1000);
    } else {
        console.log('[SCHEDULER] Pending checkout followups disabled. Set PENDING_CHECKOUT_FOLLOWUP_ENABLED=true to enable.');
    }
    if (flagEnabled('POST_SALE_REPURCHASE_30D_ENABLED', true)) {
        const intervalMinutes = parseNumber('POST_SALE_REPURCHASE_INTERVAL_MINUTES', 60);
        const intervalMs = Math.max(30, intervalMinutes) * 60 * 1000;
        setInterval(checkPostSaleRepurchaseFollowups, intervalMs);
        console.log(`[SCHEDULER] Post-sale repurchase 30d enabled every ${Math.round(intervalMs / 60000)} minutes.`);
    } else {
        console.log('[SCHEDULER] Post-sale repurchase 30d disabled. Set POST_SALE_REPURCHASE_30D_ENABLED=true to enable.');
    }
    if (flagEnabled('SHIPMENT_PICKUP_REMINDERS_ENABLED', false)) {
        const intervalMinutes = parseNumber('SHIPMENT_PICKUP_REMINDER_INTERVAL_MINUTES', 60);
        const intervalMs = Math.max(15, intervalMinutes) * 60 * 1000;
        setInterval(checkPickupReminders, intervalMs);
        console.log(`[SCHEDULER] Pickup reminders enabled every ${Math.round(intervalMs / 60000)} minutes.`);
    } else {
        console.log('[SCHEDULER] Pickup reminders disabled. Set SHIPMENT_PICKUP_REMINDERS_ENABLED=true to enable.');
    }
    if (flagEnabled('SHIPMENT_STATUS_DISPATCH_ENABLED', false)) {
        const intervalMinutes = parseNumber('SHIPMENT_STATUS_DISPATCH_INTERVAL_MINUTES', 60);
        const intervalMs = Math.max(10, intervalMinutes) * 60 * 1000;
        setInterval(checkShipmentStatusDispatch, intervalMs);
        console.log(`[SCHEDULER] Shipment status dispatch enabled every ${Math.round(intervalMs / 60000)} minutes.`);
    } else {
        console.log('[SCHEDULER] Shipment status dispatch disabled. Set SHIPMENT_STATUS_DISPATCH_ENABLED=true to enable.');
    }
    if (flagEnabled('SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED', true)) {
        const intervalMinutes = parseNumber('SHIPMENT_CARRIER_STATUS_SWEEP_INTERVAL_MINUTES', 60);
        const intervalMs = Math.max(20, intervalMinutes) * 60 * 1000;
        setInterval(checkCarrierStatusSweep, intervalMs);
        setTimeout(() => checkCarrierStatusSweep(), 20000);
        console.log(`[SCHEDULER] Carrier status sweep enabled every ${Math.round(intervalMs / 60000)} minutes.`);
    } else {
        console.log('[SCHEDULER] Carrier status sweep disabled. Set SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED=true to enable.');
    }
    if (flagEnabled('SHIPMENT_GUIDE_PRINT_DISPATCH_ENABLED', false)) {
        const intervalSeconds = parseNumber('SHIPMENT_GUIDE_PRINT_DISPATCH_INTERVAL_SECONDS', 120);
        const intervalMs = Math.max(120, intervalSeconds) * 1000;
        setInterval(checkGuidePrintDispatch, intervalMs);
        console.log(`[SCHEDULER] Guide print dispatch enabled every ${Math.round(intervalMs / 1000)} seconds; limit=1.`);
    } else {
        console.log('[SCHEDULER] Guide print dispatch disabled. Set SHIPMENT_GUIDE_PRINT_DISPATCH_ENABLED=true to enable.');
    }
    if (flagEnabled('DROPPI_EC_ACTIVE_SYNC_ENABLED', false)) {
        const intervalMinutes = parseNumber('DROPPI_EC_ACTIVE_SYNC_INTERVAL_MINUTES', 30);
        const intervalMs = Math.max(10, intervalMinutes) * 60 * 1000;
        setInterval(checkDropiActiveSync, intervalMs);
        console.log(`[SCHEDULER] Dropi active orders sync enabled every ${Math.round(intervalMs / 60000)} minutes.`);
    } else {
        console.log('[SCHEDULER] Dropi active orders sync disabled. Set DROPPI_EC_ACTIVE_SYNC_ENABLED=true to enable.');
    }
    if (flagEnabled('ADMIN_PANEL_IMPORT_ENABLED', false)) {
        const intervalMinutes = parseNumber('ADMIN_PANEL_IMPORT_INTERVAL_MINUTES', 5);
        const intervalMs = Math.max(2, intervalMinutes) * 60 * 1000;
        setInterval(checkAdminPanelImport, intervalMs);
        console.log(`[SCHEDULER] Admin panel import enabled every ${Math.round(intervalMs / 60000)} minutes.`);
    } else {
        console.log('[SCHEDULER] Admin panel import disabled. Set ADMIN_PANEL_IMPORT_ENABLED=true to enable.');
    }
    if (flagEnabled('WHATSAPP_BACKLOG_RECOVERY_ENABLED', true)) {
        const intervalMinutes = parseNumber('WHATSAPP_BACKLOG_RECOVERY_INTERVAL_MINUTES', 5);
        const intervalMs = Math.max(2, intervalMinutes) * 60 * 1000;
        setInterval(checkBacklogRecovery, intervalMs);
        console.log(`[SCHEDULER] Backlog recovery enabled every ${Math.round(intervalMs / 60000)} minutes.`);
    } else {
        console.log('[SCHEDULER] Backlog recovery disabled. Set WHATSAPP_BACKLOG_RECOVERY_ENABLED=true to enable.');
    }
    if (flagEnabled('ADMIN_PANEL_ATENDIMENTO_RECONCILE_ENABLED', true)) {
        const intervalMinutes = parseNumber('ADMIN_PANEL_ATENDIMENTO_RECONCILE_INTERVAL_MINUTES', 5);
        const intervalMs = Math.max(2, intervalMinutes) * 60 * 1000;
        setInterval(checkAdminPanelAtendimentoReconcile, intervalMs);
        console.log(`[SCHEDULER] Atendimento/admin reconciliation enabled every ${Math.round(intervalMs / 60000)} minutes.`);
    } else {
        console.log('[SCHEDULER] Atendimento/admin reconciliation disabled. Set ADMIN_PANEL_ATENDIMENTO_RECONCILE_ENABLED=true to enable.');
    }
    if (flagEnabled('ADMIN_BUY_LATER_FOLLOWUP_ENABLED', true)) {
        const intervalMinutes = parseNumber('ADMIN_BUY_LATER_FOLLOWUP_INTERVAL_MINUTES', 15);
        const intervalMs = Math.max(5, intervalMinutes) * 60 * 1000;
        setInterval(checkAdminBuyLaterFollowups, intervalMs);
        console.log(`[SCHEDULER] Comprar depois followup enabled every ${Math.round(intervalMs / 60000)} minutes.`);
    } else {
        console.log('[SCHEDULER] Comprar depois followup disabled. Set ADMIN_BUY_LATER_FOLLOWUP_ENABLED=true to enable.');
    }
    if (flagEnabled('ZAPI_CHAT_WATCHDOG_ENABLED', true)) {
        const intervalSeconds = parseNumber('ZAPI_CHAT_WATCHDOG_INTERVAL_SECONDS', 30);
        const intervalMs = Math.max(15, intervalSeconds) * 1000;
        setInterval(checkZapiChatWatchdog, intervalMs);
        setTimeout(() => checkZapiChatWatchdog(), 5000);
        console.log(`[SCHEDULER] Z-API chat watchdog enabled every ${Math.round(intervalMs / 1000)} seconds.`);
    } else {
        console.log('[SCHEDULER] Z-API chat watchdog disabled. Set ZAPI_CHAT_WATCHDOG_ENABLED=true to enable.');
    }
    if (flagEnabled('PASSIVE_FUNNEL_OBSERVER_ENABLED', false)) {
        const intervalSeconds = parseNumber('PASSIVE_FUNNEL_OBSERVER_INTERVAL_SECONDS', 60);
        const intervalMs = Math.max(30, intervalSeconds) * 1000;
        setInterval(checkPassiveFunnelObserver, intervalMs);
        setTimeout(() => checkPassiveFunnelObserver(), 10000);
        console.log(`[SCHEDULER] Passive funnel observer enabled every ${Math.round(intervalMs / 1000)} seconds.`);
    } else {
        console.log('[SCHEDULER] Passive funnel observer disabled. Set PASSIVE_FUNNEL_OBSERVER_ENABLED=true to enable.');
    }
    if (flagEnabled('NITRIX_FAST_STATE_ENABLED', false)) {
        const intervalMs = Math.max(1000, parseNumber('NITRIX_FAST_STATE_SCHEDULER_INTERVAL_MS', 1000));
        setInterval(checkNitrixFastState, intervalMs);
        setTimeout(() => checkNitrixFastState(), 250);
        console.log(`[SCHEDULER] Nitrix Fast State enabled every ${intervalMs}ms.`);
    } else {
        console.log('[SCHEDULER] Nitrix Fast State disabled. Set NITRIX_FAST_STATE_ENABLED=true to enable.');
    }
    // Watchdog: restart Baileys only when Baileys is the active engine.
    if (flagEnabled('WHATSAPP_CONNECT_ENABLED', true)) {
        setInterval(() => {
            const { isReady, status } = getStatus();
            // Only restart if confirmed disconnected. If scanning (QR), do nothing. If connected but not ready, wait.
            if (!isReady && status === 'disconnected') {
                console.log('[Scheduler] WhatsApp Disconnected -> Triggering Init...');
                startConfiguredWhatsAppSessions();
            }
        }, 60000);
    } else {
        console.log('[SCHEDULER] Baileys restart watchdog disabled because WHATSAPP_CONNECT_ENABLED=false.');
    }

    if (flagEnabled('WHATSAPP_HEALTH_ALERT_ENABLED', true)) {
        setInterval(checkHealthAlert, 60 * 1000);
        setTimeout(() => checkHealthAlert(), 20000);
        console.log('[SCHEDULER] Health alert enabled for WhatsApp/session failures.');
    } else {
        console.log('[SCHEDULER] Health alert disabled. Set WHATSAPP_HEALTH_ALERT_ENABLED=true to enable.');
    }

    // Run immediately on start
    if (flagEnabled('WHATSAPP_PRODUCT_FOLLOWUP_ENABLED', true)) {
        checkInitialProductFollowups();
    }
    if (flagEnabled('PENDING_CHECKOUT_FOLLOWUP_ENABLED', true)) {
        checkPendingCheckoutFollowups();
    }
    if (flagEnabled('POST_SALE_REPURCHASE_30D_ENABLED', true)) {
        setTimeout(() => checkPostSaleRepurchaseFollowups(), 90000);
    }
    if (flagEnabled('SHIPMENT_PICKUP_REMINDERS_ENABLED', false)) {
        setTimeout(() => checkPickupReminders(), 30000);
    }
    if (flagEnabled('SHIPMENT_STATUS_DISPATCH_ENABLED', false)) {
        setTimeout(() => checkShipmentStatusDispatch(), 45000);
    }
    if (flagEnabled('SHIPMENT_GUIDE_PRINT_DISPATCH_ENABLED', false)) {
        setTimeout(() => checkGuidePrintDispatch(), 120000);
    }
    if (flagEnabled('DROPPI_EC_ACTIVE_SYNC_ENABLED', false)) {
        setTimeout(() => checkDropiActiveSync(), 30000);
    }
    if (flagEnabled('ADMIN_PANEL_IMPORT_ENABLED', false)) {
        setTimeout(() => checkAdminPanelImport(), 15000);
    }
    if (flagEnabled('WHATSAPP_BACKLOG_RECOVERY_ENABLED', true)) {
        setTimeout(() => checkBacklogRecovery(), 60000);
    }
    if (flagEnabled('ADMIN_PANEL_ATENDIMENTO_RECONCILE_ENABLED', true)) {
        setTimeout(() => checkAdminPanelAtendimentoReconcile(), 75000);
    }
    if (flagEnabled('NITRIX_FAST_STATE_ENABLED', false)) {
        setTimeout(() => checkNitrixFastState(), 500);
    }

    // Also run immediately once WhatsApp becomes ready
    onWhatsAppReady(() => {
        if (flagEnabled('WHATSAPP_PRODUCT_FOLLOWUP_ENABLED', true)) {
            setTimeout(() => checkInitialProductFollowups(), 2000);
        }
        if (flagEnabled('PENDING_CHECKOUT_FOLLOWUP_ENABLED', true)) {
            setTimeout(() => checkPendingCheckoutFollowups(), 1000);
        }
        if (flagEnabled('POST_SALE_REPURCHASE_30D_ENABLED', true)) {
            setTimeout(() => checkPostSaleRepurchaseFollowups(), 65000);
        }
        if (flagEnabled('SHIPMENT_PICKUP_REMINDERS_ENABLED', false)) {
            setTimeout(() => checkPickupReminders(), 10000);
        }
        if (flagEnabled('SHIPMENT_STATUS_DISPATCH_ENABLED', false)) {
            setTimeout(() => checkShipmentStatusDispatch(), 20000);
        }
        if (flagEnabled('SHIPMENT_GUIDE_PRINT_DISPATCH_ENABLED', false)) {
            setTimeout(() => checkGuidePrintDispatch(), 120000);
        }
        if (flagEnabled('DROPPI_EC_ACTIVE_SYNC_ENABLED', false)) {
            setTimeout(() => checkDropiActiveSync(), 15000);
        }
        if (flagEnabled('ADMIN_PANEL_IMPORT_ENABLED', false)) {
            setTimeout(() => checkAdminPanelImport(), 25000);
        }
        if (flagEnabled('WHATSAPP_BACKLOG_RECOVERY_ENABLED', true)) {
            setTimeout(() => checkBacklogRecovery(), 45000);
        }
        if (flagEnabled('ADMIN_PANEL_ATENDIMENTO_RECONCILE_ENABLED', true)) {
            setTimeout(() => checkAdminPanelAtendimentoReconcile(), 55000);
        }
    });
};

const checkNitrixFastState = async () => {
    if (isRunningNitrixFastState) return;
    isRunningNitrixFastState = true;
    try {
        await processNitrixFastStateJobs({ limit: 50 });
    } catch (error) {
        console.error('[NITRIX-FAST-STATE] scheduler failure:', error?.message || error);
    } finally {
        isRunningNitrixFastState = false;
    }
};

const checkHealthAlert = async () => {
    try {
        const statuses = getAllStatuses();
        const connected = statuses.filter((status) => status?.isReady && status?.status === 'connected');
        const bad = statuses.filter((status) => !status?.isReady || status?.status !== 'connected');
        const key = bad.length
            ? `bad:${bad.map((status) => `${status.sessionId}:${status.status}:${status.lastDisconnectReason || ''}`).join('|')}`
            : 'ok';
        const cooldownMs = parseNumber('WHATSAPP_HEALTH_ALERT_COOLDOWN_MINUTES', 15) * 60 * 1000;
        if (key === lastHealthAlertKey && Date.now() - lastHealthAlertAt < cooldownMs) return;

        if (!bad.length && lastHealthAlertKey && lastHealthAlertKey !== 'ok') {
            await sendHealthAlert(`OK: Bot WhatsApp recuperado. Sessões conectadas: ${connected.map((item) => item.sessionId).join(', ') || 'nenhuma'}.`);
            lastHealthAlertAt = Date.now();
            lastHealthAlertKey = key;
            return;
        }

        if (bad.length) {
            const detail = bad.map((status) => `${status.sessionId}: ${status.status || 'sem_status'}${status.lastDisconnectReason ? ` (${status.lastDisconnectReason})` : ''}`).join(' | ');
            console.warn(`[HEALTH_ALERT] sessao WhatsApp com problema -> ${detail}`);
            if (connected.length) {
                await sendHealthAlert(`ATENCAO: bot WhatsApp com sessão em problema. ${detail}. PM2 segue online e o sistema tentará reconectar.`);
            }
            lastHealthAlertAt = Date.now();
            lastHealthAlertKey = key;
        }
    } catch (error) {
        console.error('[HEALTH_ALERT] falha ao verificar/enviar alerta:', error);
    }
};

const sendHealthAlert = async (text) => {
    const recipients = [...new Set(healthAlertRecipients())];
    if (!recipients.length) return;
    for (const phone of recipients) {
        await sendText(`${phone}@s.whatsapp.net`, text, null, {
            outboundContext: 'health_alert',
            bypassDedupe: true,
            allowTextDedupeBypass: true,
            allowHistoryDedupeBypass: true,
            allowExistingDropiOrder: true,
            recipientDigits: phone
        }).catch((error) => {
            console.warn(`[HEALTH_ALERT] falha ao enviar alerta para ${phone}: ${error.message}`);
        });
    }
};

const checkDropiActiveSync = async () => {
    if (isRunningDropiActiveSync) return;
    isRunningDropiActiveSync = true;
    try {
        const maxRows = parseNumber('DROPPI_EC_ACTIVE_SYNC_MAX_ROWS', 1000);
        const result = await syncActiveDroppiEcuadorOrdersFromPanel({ maxRows });
        if (result.synced?.length || result.skipped?.length) {
            console.log(`[DROPPI_ACTIVE_SYNC] linhas=${result.rowCount || 0}; unicos=${result.unique || 0}; atualizados=${result.synced?.length || 0}; ignorados=${result.skipped?.length || 0}.`);
        }
        if (flagEnabled('SHIPMENT_STATUS_DISPATCH_ENABLED', false)) {
            setTimeout(() => checkShipmentStatusDispatch(), 5000);
        }
    } catch (error) {
        console.error('Dropi Active Sync Scheduler Error:', error);
    } finally {
        isRunningDropiActiveSync = false;
    }
};

const checkAdminPanelAtendimentoReconcile = async () => {
    if (isRunningAdminPanelAtendimentoReconcile) return;
    isRunningAdminPanelAtendimentoReconcile = true;
    try {
        const fromId = parseNumber('ADMIN_PANEL_ATENDIMENTO_FROM_ID', 1725);
        const result = await reconcileAdminPanelAtendimento({ fromId, createMissing: true });
        if (!result.ok) {
            console.warn('[ADMIN_ATENDIMENTO] reconciliacao falhou:', result.reason || result.error || result);
            return;
        }
        if (result.requestedUpdates || result.tagged || result.createdMissing) {
            console.log(`[ADMIN_ATENDIMENTO] fromId=${fromId}; marcados=${result.updatedIds?.length || 0}; tags=${result.tagged || 0}; criados=${result.createdMissing || 0}; protegidos=${result.protectedSkipped?.length || 0}.`);
        }
        const sweep = await reconcileRecentWhatsappContactsToAdminPanel();
        if (!sweep.ok) {
            console.warn('[ADMIN_CONTACT_SWEEP] varredura falhou:', sweep.reason || sweep.error || sweep);
        } else if (sweep.created || sweep.missing) {
            console.log(`[ADMIN_CONTACT_SWEEP] contatos=${sweep.scannedContacts || 0}; faltantes=${sweep.missing || 0}; criados=${sweep.created || 0}${sweep.limited ? '; limitado=true' : ''}.`);
        }
        const adminToWhatsapp = await reconcileAdminLeadsToWhatsappPanel({ fromId });
        if (!adminToWhatsapp.ok) {
            console.warn('[ADMIN_TO_WHATSAPP] reconciliacao falhou:', adminToWhatsapp.reason || adminToWhatsapp.error || adminToWhatsapp);
        } else if (adminToWhatsapp.created || adminToWhatsapp.missing) {
            console.log(`[ADMIN_TO_WHATSAPP] fromId=${fromId}; criados=${adminToWhatsapp.created || 0}; atualizados=${adminToWhatsapp.updated || 0}; faltantes=${adminToWhatsapp.missing || 0}.`);
        }
    } catch (error) {
        console.error('Admin Atendimento Reconciliation Scheduler Error:', error);
    } finally {
        isRunningAdminPanelAtendimentoReconcile = false;
    }
};

const checkBacklogRecovery = async () => {
    if (isRunningBacklogRecovery) return;
    isRunningBacklogRecovery = true;
    try {
        const result = await processBacklogRecovery();
        if (result.processed || result.candidates || result.skipped) {
            console.log(`[BACKLOG_RECOVERY] processados ${result.processed || 0}/${result.candidates || 0}${result.skipped ? `; skipped=${result.skipped}` : ''}.`);
        }
    } catch (error) {
        console.error('Backlog Recovery Scheduler Error:', error);
    } finally {
        isRunningBacklogRecovery = false;
    }
};

const checkPendingCheckoutFollowups = async () => {
    if (isRunningPendingCheckoutFollowups) return;
    isRunningPendingCheckoutFollowups = true;
    try {
        const result = await processPendingCheckoutInfoFollowups();
        if (result.sent) {
            console.log(`[PENDING_CHECKOUT] Follow-up de informacao enviado: ${result.sent}/${result.processed}`);
        }
    } catch (error) {
        console.error('Pending Checkout Followup Scheduler Error:', error);
    } finally {
        isRunningPendingCheckoutFollowups = false;
    }
};

const checkInitialProductFollowups = async () => {
    if (isRunningProductFollowups) return;
    isRunningProductFollowups = true;
    try {
        const result = await processInitialProductFollowups();
        if (result.sent) {
            console.log(`[FOLLOWUP] Produto pos-apresentacao enviado: ${result.sent}/${result.processed}`);
        }
    } catch (error) {
        console.error('Product Followup Scheduler Error:', error);
    } finally {
        isRunningProductFollowups = false;
    }
};

const checkPostSaleRepurchaseFollowups = async () => {
    if (isRunningPostSaleRepurchaseFollowups) return;
    isRunningPostSaleRepurchaseFollowups = true;
    try {
        const limit = parseNumber('POST_SALE_REPURCHASE_BATCH_LIMIT', 3);
        const result = await processPostSaleRepurchase30dFollowups({ limit });
        if (result.sent || result.candidates) {
            console.log(`[RECOMPRA_30D] Enviados ${result.sent}/${result.processed}; candidatos ${result.candidates || 0}; limite ${limit}.`);
        }
    } catch (error) {
        console.error('Post-sale Repurchase 30d Scheduler Error:', error);
    } finally {
        isRunningPostSaleRepurchaseFollowups = false;
    }
};

const checkAdminBuyLaterFollowups = async () => {
    if (isRunningAdminBuyLaterFollowups) return;
    isRunningAdminBuyLaterFollowups = true;
    try {
        const limit = parseNumber('ADMIN_BUY_LATER_FOLLOWUP_BATCH_LIMIT', 3);
        const result = await processAdminBuyLaterFollowups({ limit });
        if (result.sent || result.candidates) {
            console.log(`[COMPRAR_DEPOIS] Enviados ${result.sent}/${result.processed}; candidatos ${result.candidates || 0}; limite ${limit}.`);
        }
    } catch (error) {
        console.error('Admin Buy Later Followup Scheduler Error:', error);
    } finally {
        isRunningAdminBuyLaterFollowups = false;
    }
};

const checkZapiChatWatchdog = async () => {
    if (isRunningZapiChatWatchdog) return;
    isRunningZapiChatWatchdog = true;
    try {
        const result = await processZapiChatWatchdog();
        if (result.created) {
            console.warn(`[ZAPI_CHAT_WATCHDOG] Alertas criados ${result.created}/${result.scanned}.`);
        }
    } catch (error) {
        const detail = error?.response?.data || error.message || error;
        console.error('[ZAPI_CHAT_WATCHDOG] Scheduler Error:', detail);
    } finally {
        isRunningZapiChatWatchdog = false;
    }
};

const checkPassiveFunnelObserver = async () => {
    if (isRunningPassiveFunnelObserver) return;
    isRunningPassiveFunnelObserver = true;
    try {
        await processPassiveFunnelObserver();
    } catch (error) {
        console.error('[PASSIVE_FUNNEL_OBSERVER] Scheduler Error:', error?.message || error);
    } finally {
        isRunningPassiveFunnelObserver = false;
    }
};

const checkPickupReminders = async () => {
    if (isRunningPickupReminders) return;
    isRunningPickupReminders = true;
    try {
        const pending = await getPendingShipmentReminders();
        const limit = adaptiveLimit({
            backlog: pending.length,
            enabledName: 'SHIPMENT_PICKUP_REMINDER_ADAPTIVE_ENABLED',
            baseName: 'SHIPMENT_PICKUP_REMINDER_BATCH_LIMIT',
            low: 3,
            medium: 4,
            high: 5,
            max: 5,
            mediumAt: 25,
            highAt: 60
        });
        const result = await processShipmentPickupReminders({ limit });
        if (result.sent || result.candidates) {
            console.log(`[PICKUP_REMINDER] Enviados ${result.sent}/${result.processed}; candidatos ${result.candidates}; limite ${limit}.`);
        }
    } catch (error) {
        console.error('Pickup Reminder Scheduler Error:', error);
    } finally {
        isRunningPickupReminders = false;
    }
};

const checkShipmentStatusDispatch = async () => {
    if (isRunningShipmentStatusDispatch) return;
    isRunningShipmentStatusDispatch = true;
    try {
        const actions = parseActions(process.env.SHIPMENT_STATUS_DISPATCH_ACTIONS || 'guide,in_transit,ready_for_pickup,returned,delivered_bonus');
        const backlog = await countShipmentDispatchCandidates({ actions });
        const limit = adaptiveLimit({
            backlog,
            enabledName: 'SHIPMENT_STATUS_DISPATCH_ADAPTIVE_ENABLED',
            baseName: 'SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT',
            low: 3,
            medium: 5,
            high: 8,
            max: 8,
            mediumAt: 25,
            highAt: 60
        });
        const result = await processShipmentStatusDispatch({ limit, actions });
        if (result.sent || backlog) {
            const quotaInfo = result.quota?.reason
                ? `; quota=${result.quota.reason}; hoje=${result.quota.sentToday ?? 0}/${result.quota.dailyLimit || 'sem_limite'}; liberado=${result.quota.allowedByNow ?? 'n/a'}`
                : '';
            console.log(`[SHIPMENT_DISPATCH] Enviados ${result.sent}/${result.processed}; pendentes ${backlog}; limite ${limit}; actions=${actions.join(',') || 'default'}${quotaInfo}.`);
        }
    } catch (error) {
        console.error('Shipment Status Dispatch Scheduler Error:', error);
    } finally {
        isRunningShipmentStatusDispatch = false;
    }
};

const checkCarrierStatusSweep = async () => {
    if (isRunningCarrierStatusSweep) return;
    isRunningCarrierStatusSweep = true;
    try {
        const limit = parseNumber('SHIPMENT_CARRIER_STATUS_SWEEP_BATCH_LIMIT', 6);
        const result = await processCarrierStatusSweep({ limit });
        if (result.refreshed || result.statusChanged || result.failed) {
            console.log(`[CARRIER_SWEEP] Guias ${result.refreshed}/${result.processed}; alteradas ${result.statusChanged}; falhas ${result.failed}; limite ${limit}.`);
        }
    } catch (error) {
        console.error('Carrier Status Sweep Scheduler Error:', error);
    } finally {
        isRunningCarrierStatusSweep = false;
    }
};

const checkGuidePrintDispatch = async () => {
    if (isRunningGuidePrintDispatch) return;
    isRunningGuidePrintDispatch = true;
    try {
        const result = await processGuidePrintDispatch({ dryRun: false, limit: 1 });
        if (result.sent || result.failed || result.processed) {
            console.log(`[GUIDE_PRINT_DISPATCH] Enviados ${result.sent}/${result.processed}; falhas=${result.failed || 0}; skipped=${result.skipped || 0}; limite=1.`);
        }
    } catch (error) {
        console.error('Guide Print Dispatch Scheduler Error:', error);
    } finally {
        isRunningGuidePrintDispatch = false;
    }
};

const checkAdminPanelImport = async () => {
    if (isRunningAdminPanelImport) return;
    isRunningAdminPanelImport = true;
    try {
        const result = await importConfirmedAdminPanelOrders({ country: 'EC' });
        if (result.imported || result.created) {
            console.log(`[ADMIN_IMPORT] Importados ${result.imported}; criados ${result.created}; atualizados ${result.updated}. Dropi segue exigindo autorizacao manual.`);
        }
    } catch (error) {
        console.error('Admin Panel Import Scheduler Error:', error);
    } finally {
        isRunningAdminPanelImport = false;
    }
};

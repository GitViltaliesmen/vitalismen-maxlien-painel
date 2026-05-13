import { onWhatsAppReady, getStatus, startConfiguredWhatsAppSessions } from '../whatsapp/connection.js';
import { processInitialProductFollowups, processPendingCheckoutInfoFollowups } from './reengagementService.js';
import { getPendingShipmentReminders, processShipmentPickupReminders } from './shipmentMessageService.js';
import {
    countShipmentDispatchCandidates,
    processShipmentStatusDispatch
} from './shipmentStatusDispatcherService.js';
import { importConfirmedAdminPanelOrders } from './adminPanelImportService.js';

let isRunningProductFollowups = false;
let isRunningPendingCheckoutFollowups = false;
let isRunningPickupReminders = false;
let isRunningShipmentStatusDispatch = false;
let isRunningAdminPanelImport = false;

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
        const intervalMs = Math.max(15, intervalMinutes) * 60 * 1000;
        setInterval(checkShipmentStatusDispatch, intervalMs);
        console.log(`[SCHEDULER] Shipment status dispatch enabled every ${Math.round(intervalMs / 60000)} minutes.`);
    } else {
        console.log('[SCHEDULER] Shipment status dispatch disabled. Set SHIPMENT_STATUS_DISPATCH_ENABLED=true to enable.');
    }
    if (flagEnabled('ADMIN_PANEL_IMPORT_ENABLED', false)) {
        const intervalMinutes = parseNumber('ADMIN_PANEL_IMPORT_INTERVAL_MINUTES', 5);
        const intervalMs = Math.max(2, intervalMinutes) * 60 * 1000;
        setInterval(checkAdminPanelImport, intervalMs);
        console.log(`[SCHEDULER] Admin panel import enabled every ${Math.round(intervalMs / 60000)} minutes.`);
    } else {
        console.log('[SCHEDULER] Admin panel import disabled. Set ADMIN_PANEL_IMPORT_ENABLED=true to enable.');
    }
    // Watchdog: Restart WhatsApp ONLY if not ready and not scanning
    setInterval(() => {
        const { isReady, status } = getStatus();
        // Only restart if confirmed disconnected. If scanning (QR), do nothing. If connected but not ready, wait.
        if (!isReady && status === 'disconnected') {
            console.log('[Scheduler] WhatsApp Disconnected -> Triggering Init...');
            startConfiguredWhatsAppSessions();
        }
    }, 60000);

    // Run immediately on start
    if (flagEnabled('WHATSAPP_PRODUCT_FOLLOWUP_ENABLED', true)) {
        checkInitialProductFollowups();
    }
    if (flagEnabled('PENDING_CHECKOUT_FOLLOWUP_ENABLED', true)) {
        checkPendingCheckoutFollowups();
    }
    if (flagEnabled('SHIPMENT_PICKUP_REMINDERS_ENABLED', false)) {
        setTimeout(() => checkPickupReminders(), 30000);
    }
    if (flagEnabled('SHIPMENT_STATUS_DISPATCH_ENABLED', false)) {
        setTimeout(() => checkShipmentStatusDispatch(), 45000);
    }
    if (flagEnabled('ADMIN_PANEL_IMPORT_ENABLED', false)) {
        setTimeout(() => checkAdminPanelImport(), 15000);
    }

    // Also run immediately once WhatsApp becomes ready
    onWhatsAppReady(() => {
        if (flagEnabled('WHATSAPP_PRODUCT_FOLLOWUP_ENABLED', true)) {
            setTimeout(() => checkInitialProductFollowups(), 2000);
        }
        if (flagEnabled('PENDING_CHECKOUT_FOLLOWUP_ENABLED', true)) {
            setTimeout(() => checkPendingCheckoutFollowups(), 1000);
        }
        if (flagEnabled('SHIPMENT_PICKUP_REMINDERS_ENABLED', false)) {
            setTimeout(() => checkPickupReminders(), 10000);
        }
        if (flagEnabled('SHIPMENT_STATUS_DISPATCH_ENABLED', false)) {
            setTimeout(() => checkShipmentStatusDispatch(), 20000);
        }
        if (flagEnabled('ADMIN_PANEL_IMPORT_ENABLED', false)) {
            setTimeout(() => checkAdminPanelImport(), 25000);
        }
    });
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
        const actions = parseActions(process.env.SHIPMENT_STATUS_DISPATCH_ACTIONS || 'ready_for_pickup');
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
            console.log(`[SHIPMENT_DISPATCH] Enviados ${result.sent}/${result.processed}; pendentes ${backlog}; limite ${limit}; actions=${actions.join(',') || 'default'}.`);
        }
    } catch (error) {
        console.error('Shipment Status Dispatch Scheduler Error:', error);
    } finally {
        isRunningShipmentStatusDispatch = false;
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

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

export const BUY_LATER_V162_BATCH_LIMIT = 1;
export const BUY_LATER_V162_INTERVAL_MINUTES = 15;
export const BUY_LATER_V162_ENV_ALLOWLIST = Object.freeze([
    'MONGODB_URI',
    'MONGO_URI',
    'MONGODB_URL',
    'ZAPI_INSTANCE_ID',
    'ZAPI_INSTANCE_TOKEN',
    'ZAPI_TOKEN',
    'ZAPI_CLIENT_TOKEN',
    'ZAPI_ACCOUNT_SECURITY_TOKEN',
    'ZAPI_BASE_URL',
    'ZAPI_TIMEOUT_MS',
    'ZAPI_SEND_TIMEOUT_MS',
    'WHATSAPP_SEND_TEXT_TIMEOUT_MS',
    'WHATSAPP_HISTORY_DEDUPE_WINDOW_MINUTES',
    'WHATSAPP_DEDUPE_WINDOW_MINUTES',
    'WHATSAPP_OUTBOUND_STALE_RESERVED_RETRY_MS',
    'WHATSAPP_SEMANTIC_DEDUPE_WINDOW_MINUTES',
    'WHATSAPP_PRIORITY_TEST_PHONES',
    'WHATSAPP_BLOCKED_RECIPIENTS'
]);

const SYSTEM_ENV_KEYS = new Set([
    'PATH', 'HOME', 'LANG', 'LC_ALL', 'TZ', 'TMPDIR', 'TMP', 'TEMP',
    'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT',
    'BUY_LATER_V162_OPERATIONAL_ENABLED'
]);

const clean = (value = '') => String(value ?? '').trim();
const isTrue = (value = '') => clean(value).toLowerCase() === 'true';
const SILENCED_CONSOLE_METHODS = Object.freeze(['log', 'info', 'debug', 'warn', 'error']);

export const runWithReservedBuyLaterV162Stdout = async (work) => {
    if (typeof work !== 'function') throw new TypeError('buy_later_v162_work_required');
    const originalStdoutWrite = process.stdout.write;
    const originalConsole = Object.fromEntries(
        SILENCED_CONSOLE_METHODS.map((method) => [method, console[method]])
    );
    process.stdout.write = () => true;
    for (const method of SILENCED_CONSOLE_METHODS) console[method] = () => {};
    try {
        return await work();
    } finally {
        process.stdout.write = originalStdoutWrite;
        for (const method of SILENCED_CONSOLE_METHODS) console[method] = originalConsole[method];
    }
};

export const loadBuyLaterV162IsolatedEnvironment = ({ action, root = process.cwd() } = {}) => {
    const envFile = path.join(root, '.env');
    if (!fs.existsSync(envFile)) throw new Error('buy_later_v162_env_missing');
    const source = dotenv.parse(fs.readFileSync(envFile));
    const inherited = { ...process.env };
    for (const key of Object.keys(process.env)) {
        if (!SYSTEM_ENV_KEYS.has(key)) delete process.env[key];
    }
    for (const key of SYSTEM_ENV_KEYS) {
        if (Object.hasOwn(inherited, key)) process.env[key] = inherited[key];
    }
    for (const key of BUY_LATER_V162_ENV_ALLOWLIST) {
        if (clean(source[key])) process.env[key] = source[key];
    }

    Object.assign(process.env, {
        NODE_ENV: 'production',
        DISABLE_SCHEDULER: '1',
        ADMIN_BUY_LATER_FOLLOWUP_ENABLED: 'false',
        VITALISMEN_EC_BOT_CORE_OPERATIONAL: 'false',
        VITALISMEN_CANARY_V75_ENABLED: 'false',
        WHATSAPP_AUTOMATION_PILOT_ONLY: 'false',
        WHATSAPP_EC_ONLY_OUTBOUND: 'true',
        WHATSAPP_STRICT_OUTBOUND_DEDUPE_ENABLED: 'true',
        OUTBOUND_ZAPI_FAILOVER_ENABLED: 'false',
        DROPPI_OUTBOUND_ORDER_GUARD_ENABLED: 'true',
        DROPPI_EC_ACTIVE_SYNC_MODE: 'REPORT_ONLY',
        DROPPI_EC_ACTIVE_SYNC_ENABLED: 'false',
        POST_SALE_V66_MUTATIONS_ENABLED: 'false',
        POST_SALE_REPURCHASE_30D_ENABLED: 'false',
        SHIPMENT_PICKUP_REMINDERS_ENABLED: 'false',
        WHATSAPP_BACKLOG_RECOVERY_ENABLED: 'false',
        NITRIX_FAST_STATE_ENABLED: 'false',
        META_RETRO_SEND: 'false',
        WHATSAPP_CONNECT_ENABLED: 'false',
        VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: action === 'run' ? 'true' : 'false',
        VITALISMEN_STRICT_READ_ONLY: action === 'observe' ? 'true' : 'false'
    });
    delete process.env.NODE_OPTIONS;
    delete process.env.SAFE_OBSERVATION_POLICY;

    const mongoUri = clean(process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL);
    if (!mongoUri) throw new Error('buy_later_v162_mongo_uri_missing');
    if (action === 'run') {
        if (!isTrue(process.env.BUY_LATER_V162_OPERATIONAL_ENABLED)) {
            throw new Error('buy_later_v162_operational_gate_missing');
        }
        if (!clean(process.env.ZAPI_INSTANCE_ID)
            || !clean(process.env.ZAPI_INSTANCE_TOKEN || process.env.ZAPI_TOKEN)
            || !clean(process.env.ZAPI_CLIENT_TOKEN || process.env.ZAPI_ACCOUNT_SECURITY_TOKEN)) {
            throw new Error('buy_later_v162_zapi_config_incomplete');
        }
    }
    return { mongoUri };
};

export const runBuyLaterV162Cli = async ({ action = process.argv[2], root = process.cwd() } = {}) => {
    if (!['observe', 'run'].includes(action)) throw new Error('usage: run-buy-later-followup-v162.mjs observe|run');
    const realRoot = fs.realpathSync(root);
    if (process.platform !== 'win32' && !realRoot.startsWith('/opt/vitalismen-automacao/releases/')) {
        throw new Error('buy_later_v162_official_release_required');
    }
    const { mongoUri } = loadBuyLaterV162IsolatedEnvironment({ action, root });
    return runWithReservedBuyLaterV162Stdout(async () => {
        const strict = await import('../src/services/strictReadOnlyObservationService.js');
        if (action === 'observe') strict.installStrictReadOnlyMongooseGuard(mongoose);
        await mongoose.connect(mongoUri, {
            autoIndex: false,
            serverSelectionTimeoutMS: 10000
        });
        try {
            const service = await import('../src/services/adminBuyLaterFollowupService.js');
            if (action === 'observe') {
                const result = await service.observeAdminBuyLaterFollowups({ now: new Date() });
                return {
                    status: 'PASS_OBSERVE',
                    version: 162,
                    readOnly: true,
                    batchLimit: BUY_LATER_V162_BATCH_LIMIT,
                    intervalMinutes: BUY_LATER_V162_INTERVAL_MINUTES,
                    ...result
                };
            }
            const result = await service.processAdminBuyLaterFollowups({
                limit: BUY_LATER_V162_BATCH_LIMIT,
                now: new Date()
            });
            return {
                status: 'PASS_RUN',
                version: 162,
                readOnly: false,
                batchLimit: BUY_LATER_V162_BATCH_LIMIT,
                intervalMinutes: BUY_LATER_V162_INTERVAL_MINUTES,
                ...result
            };
        } finally {
            await mongoose.disconnect();
        }
    });
};

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url));
if (isMain) {
    try {
        const report = await runBuyLaterV162Cli();
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } catch (error) {
        process.stderr.write(`${JSON.stringify({ status: 'BLOCKED', version: 162, error: error.message })}\n`);
        process.exitCode = 1;
        await mongoose.disconnect().catch(() => null);
    }
}

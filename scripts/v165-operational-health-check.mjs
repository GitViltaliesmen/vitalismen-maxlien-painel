#!/usr/bin/env node
let input = '';
for await (const chunk of process.stdin) input += chunk;
const health = JSON.parse(input);
if (health.status !== 'online'
    || !Array.isArray(health.degradedReasons)
    || health.degradedReasons.length !== 0
    || health.automationSafety?.botCoreOperational !== true
    || health.zapi?.connected !== true
    || health.zapi?.outboundBlocked === true
    || health.transports?.official !== 'zapi'
    || health.bot_inbound_queue?.pendingTasks !== 0) {
    throw new Error('v165_production_health_not_ready');
}
process.stdout.write([
    'HEALTH_STATUS=online',
    'DEGRADED_REASONS=0',
    'BOT_CORE_OPERATIONAL=YES',
    'BOT_QUEUE_PENDING=0',
    'ZAPI_CONNECTED=YES',
    'ZAPI_OUTBOUND_BLOCKED=NO',
    'ZAPI_PRODUCTION_PROVIDER=YES'
].join('\n') + '\n');

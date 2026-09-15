const path = require('node:path');

const releaseRoot = path.resolve(__dirname, '..');

module.exports = {
    apps: [{
        name: 'vitalismen-whatsapp-web-shadow-v164',
        cwd: releaseRoot,
        script: path.join(releaseRoot, 'scripts', 'v167b-authorized-web-worker.mjs'),
        interpreter: process.execPath,
        exec_mode: 'fork',
        instances: 1,
        autorestart: true,
        restart_delay: 5000,
        max_restarts: 10,
        min_uptime: '10s',
        kill_timeout: 15000,
        wait_ready: false,
        merge_logs: true,
        env: {
            V152_E_R4_PERSISTENT_SHADOW_APPROVED: 'true',
            V152_E_CHANNEL_ID: 'V152_TEST_WEB_01',
            V152_E_SESSION_NAMESPACE: 'V152_TEST_WEB_01',
            V152_E_TEST_CHANNEL_PHONE: '5531983002800',
            WHATSAPP_SESSION_STORAGE_ROOT: '/var/lib/vitalismen-whatsapp-web-sessions',
            V152_E_R4_STATE_ROOT: '/var/lib/vitalismen-whatsapp-web-shadow-state',
            V167B_AUTHORIZED_WEB_CANARY_ENABLED: 'true',
            V167B_AUTHORIZED_PHONE: '5515998038637',
            V167B_SOCKET_PATH: '/run/vitalismen-whatsapp-web-v167b.sock'
        }
    }]
};

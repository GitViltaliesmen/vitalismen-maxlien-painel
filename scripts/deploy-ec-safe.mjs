import { execFileSync } from 'child_process';

const confirm = process.env.EC_SAFE_DEPLOY_CONFIRM === 'YES';
const activate = process.env.EC_SAFE_DEPLOY_ACTIVATE === 'YES';

if (activate) {
    console.error('[DEPLOY-INTEGRATION-V29.1] ativação direta bloqueada; use o helper root transacional com permit de uso único.');
    process.exit(78);
}

const run = (cmd, args, options = {}) => {
    console.log(`$ ${cmd} ${args.join(' ')}`);
    execFileSync(cmd, args, {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: options.env || process.env,
        timeout: options.timeout || 300000
    });
};

run(process.execPath, ['scripts/guard-freeze-lock-ec.mjs'], { timeout: 60000 });
run(process.execPath, ['scripts/guard-status-panels-freeze.mjs'], { timeout: 60000 });
run(process.execPath, ['scripts/audit-customer-draft-zero-quantity.mjs'], { timeout: 60000 });
run(process.execPath, ['scripts/audit-pickup-notification-guard.mjs'], { timeout: 60000 });
run(process.execPath, ['scripts/audit-whatsapp-status-google-contacts.mjs'], { timeout: 60000 });
run(process.execPath, ['--test', 'tests/operational-chat-status.test.mjs', 'tests/google-contacts-security.test.mjs'], { timeout: 60000 });
run(process.execPath, ['--test', 'tests/shipment-pickup-notification.test.mjs'], { timeout: 60000 });

if (!confirm) {
    console.error([
        '[DEPLOY-EC-SAFE] Validacao OK, mas deploy bloqueado por seguranca.',
        '',
        'Para publicar depois da aprovacao escrita:',
        'EC_SAFE_DEPLOY_CONFIRM=YES npm run deploy:ec-safe',
        '',
        'Ativação não é aceita por este comando; use o helper root transacional após staging e permit de uso único.'
    ].join('\n'));
    process.exit(1);
}

run(process.execPath, ['scripts/deploy-vps-ready.mjs'], {
    timeout: 600000,
    env: {
        ...process.env,
        VITALISMEN_DEPLOY_CONFIRM: 'YES',
        VITALISMEN_DEPLOY_ACTIVATE: ''
    }
});

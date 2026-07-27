import { execFileSync } from 'child_process';

const confirm = process.env.EC_SAFE_DEPLOY_CONFIRM === 'YES';
const activate = process.env.EC_SAFE_DEPLOY_ACTIVATE === 'YES';

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
run(process.execPath, ['--test', 'tests/shipment-pickup-notification.test.mjs'], { timeout: 60000 });

if (!confirm) {
    console.error([
        '[DEPLOY-EC-SAFE] Validacao OK, mas deploy bloqueado por seguranca.',
        '',
        'Para publicar depois da aprovacao escrita:',
        'EC_SAFE_DEPLOY_CONFIRM=YES npm run deploy:ec-safe',
        '',
        'Para publicar e tambem ativar o release em /opt/vitalismen-automacao/current:',
        'EC_SAFE_DEPLOY_CONFIRM=YES EC_SAFE_DEPLOY_ACTIVATE=YES npm run deploy:ec-safe',
        '',
        'Observacao: ativar/reiniciar producao continua sendo uma decisao explicita.'
    ].join('\n'));
    process.exit(1);
}

run(process.execPath, ['scripts/deploy-vps-ready.mjs'], {
    timeout: 600000,
    env: {
        ...process.env,
        VITALISMEN_DEPLOY_CONFIRM: 'YES',
        VITALISMEN_DEPLOY_ACTIVATE: activate ? 'YES' : (process.env.VITALISMEN_DEPLOY_ACTIVATE || '')
    }
});

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const lockPath = path.join(root, 'FREEZE_LOCK_EC.json');
const approvedDir = path.join(root, 'approved_freezes');

const description = process.argv.slice(2).join(' ').trim();

const usage = [
    'Uso:',
    '  npm run freeze:ec -- "Aprovado: nome curto da camada"',
    '',
    'Exemplo:',
    '  npm run freeze:ec -- "Aprovado: ficha salva sem 429 e popup inline desligado"'
].join('\n');

if (!description) {
    console.error(usage);
    process.exit(1);
}

if (!fs.existsSync(lockPath)) {
    console.error('FREEZE_LOCK_EC.json nao encontrado.');
    process.exit(1);
}

const readLock = () => JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const writeLock = (lock) => fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

const lock = readLock();
const guards = Array.isArray(lock.freezeGuards) ? lock.freezeGuards : [
    ['node', 'scripts/guard-freeze-lock-ec.mjs']
];

const run = (cmd, args) => {
    console.log(`$ ${cmd} ${args.join(' ')}`);
    execFileSync(cmd, args, {
        cwd: root,
        stdio: 'inherit',
        env: process.env,
        timeout: 180000
    });
};

for (const guard of guards) {
    if (!Array.isArray(guard) || !guard.length) continue;
    const [cmd, ...args] = guard;
    run(cmd, args);
}

const now = new Date();
const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
const fileName = `APPROVED_FREEZE_EC_${stamp}.md`;
const approvalPath = path.join(approvedDir, fileName);
fs.mkdirSync(approvedDir, { recursive: true });

const activeRules = (lock.rules || []).filter((rule) => rule.status !== 'inactive');
const body = [
    `# Freeze EC aprovado - ${stamp}`,
    '',
    `Data UTC: ${now.toISOString()}`,
    `Aprovacao: ${description}`,
    '',
    '## Regras travadas neste momento',
    '',
    ...activeRules.map((rule) => `- ${rule.id}: ${rule.description || ''}`),
    '',
    '## Comandos executados',
    '',
    ...guards.map((guard) => `- \`${guard.join(' ')}\``),
    '',
    '## Regra operacional',
    '',
    'Qualquer mudanca que quebre uma regra ativa em `FREEZE_LOCK_EC.json` exige autorizacao escrita antes do deploy.',
    ''
].join('\n');

fs.writeFileSync(approvalPath, body);

const approval = {
    at: now.toISOString(),
    description,
    file: path.relative(root, approvalPath),
    activeRuleIds: activeRules.map((rule) => rule.id)
};

lock.updatedAt = now.toISOString();
lock.lastApproval = approval;
lock.approvals = [...(Array.isArray(lock.approvals) ? lock.approvals : []), approval].slice(-100);
writeLock(lock);

console.log(`[FREEZE-EC] OK: camada congelada em ${path.relative(root, approvalPath)}`);
console.log('[FREEZE-EC] Proximos deploys devem passar por npm run guard:freeze-lock antes de publicar.');

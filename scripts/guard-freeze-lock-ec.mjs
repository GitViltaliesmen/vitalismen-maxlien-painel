import fs from 'fs';
import path from 'path';

const root = process.cwd();
const lockPath = path.join(root, 'FREEZE_LOCK_EC.json');
const failures = [];
const warnings = [];

const readJson = (file) => {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        failures.push(`Nao consegui ler ${path.relative(root, file)}: ${error.message}`);
        return null;
    }
};

const readFile = (relativeFile, optional = false) => {
    const file = path.isAbsolute(relativeFile) ? relativeFile : path.join(root, relativeFile);
    if (!fs.existsSync(file)) {
        const message = `${relativeFile} nao encontrado`;
        if (optional) warnings.push(message);
        else failures.push(message);
        return '';
    }
    return fs.readFileSync(file, 'utf8');
};

const normalize = (value) => String(value ?? '').replace(/\r\n/g, '\n');

const assertCheck = ({ rule, check, body }) => {
    const type = String(check.type || '').trim();
    const value = normalize(check.value || '');
    const label = `${rule.id} :: ${check.file}`;
    if (!type) {
        failures.push(`${label}: check sem tipo`);
        return;
    }
    if (!value && !['exists'].includes(type)) {
        failures.push(`${label}: check sem valor`);
        return;
    }
    if (type === 'exists') return;
    if (type === 'includes' && !body.includes(value)) {
        failures.push(`${label}: trecho obrigatorio ausente: ${value.slice(0, 180)}`);
        return;
    }
    if (type === 'excludes' && body.includes(value)) {
        failures.push(`${label}: trecho proibido voltou: ${value.slice(0, 180)}`);
        return;
    }
    if (type === 'regexIncludes') {
        const regex = new RegExp(value, check.flags || '');
        if (!regex.test(body)) failures.push(`${label}: regex obrigatoria nao encontrada: ${value}`);
        return;
    }
    if (type === 'regexExcludes') {
        const regex = new RegExp(value, check.flags || '');
        if (regex.test(body)) failures.push(`${label}: regex proibida voltou: ${value}`);
        return;
    }
    if (!['includes', 'excludes', 'regexIncludes', 'regexExcludes'].includes(type)) {
        failures.push(`${label}: tipo de check desconhecido: ${type}`);
    }
};

const lock = readJson(lockPath);
if (!lock) process.exit(1);

const rules = Array.isArray(lock.rules) ? lock.rules : [];
if (!rules.length) failures.push('FREEZE_LOCK_EC.json nao possui regras ativas.');

for (const rule of rules) {
    if (rule.status === 'inactive') continue;
    const checks = Array.isArray(rule.checks) ? rule.checks : [];
    if (!rule.id) failures.push('Regra sem id no FREEZE_LOCK_EC.json');
    if (!checks.length) failures.push(`${rule.id}: regra sem checks`);
    for (const check of checks) {
        const body = readFile(check.file, Boolean(check.optional));
        if (!body && check.optional) continue;
        assertCheck({ rule, check, body: normalize(body) });
    }
}

if (warnings.length) {
    console.warn('[FREEZE-LOCK-EC] Avisos:');
    for (const warning of warnings) console.warn(`- ${warning}`);
}

if (failures.length) {
    console.error('\n[FREEZE-LOCK-EC] BLOQUEADO. Alguma camada congelada voltou ou foi removida:\n');
    for (const failure of failures) console.error(`- ${failure}`);
    console.error('\nPara alterar uma regra congelada, peça autorizacao escrita antes e atualize FREEZE_LOCK_EC.json com a decisao.');
    process.exit(1);
}

console.log(`[FREEZE-LOCK-EC] OK: ${rules.filter((rule) => rule.status !== 'inactive').length} regra(s) congelada(s) preservada(s).`);

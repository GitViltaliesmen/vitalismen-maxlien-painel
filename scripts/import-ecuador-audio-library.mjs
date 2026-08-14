import fs from 'fs/promises';
import path from 'path';
import { ensureOggFromMp3 } from '../src/services/audioTemplateService.js';

const sourceRoot = process.argv[2] || '/private/tmp/vitalismen_audio_zip_import';
const targetDir = path.resolve('public/media/templates/EC');
const audioExtensions = new Set(['.mp3', '.ogg', '.mpeg', '.m4a', '.wav']);
const externalCountryToken = ['colo', 'mbia'].join('');

const explicitAliases = new Map([
    ['AGRADECIMENTO_AGENCIA_DE_ENTREGA', 'Agradecimento_Agencia_01'],
    ['CLIENTES_QUE_LIGAM', 'CLIENTES_QUE_LIGAM'],
    ['COMO_SE_TOMA_VIT_POWER', 'COMO_SE_TOMA_VIT_POWER'],
    ['ENDERECO_CIDADE_PROVINCIA_AGENCIA', 'ENDERECO_CIDADE_PROVINCIA_AGENCIA'],
    ['ENTREGAS_A_SERVIENTREGAS_MELHOR_OPCAO', 'ENTREGAS_A_SERVIENTREGAS_MELHOR_OPCAO'],
    ['ENVIO_AGENCIA_100_SEGURO', 'ENVIO_AGENCIA_100_SEGURO'],
    ['FUNCIONA_VIT_POWER', 'FUNCIONA_VIT_POWER'],
    ['INFORMACOES_PESSOAS_NAIS', 'INFORMACOES_PESSOAIS_NAIS'],
    ['PRODUDO_LIQUIDO_X_CAPSULA_MELHOR', 'PRODUDO_LIQUIDO_X_CAPSULA_MELHOR'],
    ['PROSTADA_FUNCIONA_E_QUANDO_CHEGA', 'PROSTADA_FUNCIONA_E_QUANDO_CHEGA'],
    ['QUANDO_CLIENTE_INSISTE_EM_LIGAR', 'QUANDO_CLIENTE_INSISTE_EM_LIGAR'],
    ['QUANDO_CLIENTE_LIGA_01', 'QUANDO_CLIENTE_LIGA_01'],
    ['QUANDO_DIZER_NAO_PODE_RETIRAR_PRODUTO', 'QUANDO_DIZER_NAO_PODE_RETIRAR_PRODUTO'],
    ['TEMPO_DEMORA_PRODUTO_CHEGAR', 'TEMPO_DEMORA_PRODUTO_CHEGAR'],
    ['TEMPO_RESULTADO_VIT_POWER', 'TEMPO_RESULTADO_VIT_POWER'],
    ['TRATAMENTO_Y_PRECIOS_PROMOCAO_1_3_6', 'TRATAMENTO_Y_PRECIOS_PROMOCAO_1_3_6']
]);

const normalizeBaseName = (fileName) => {
    const ext = path.extname(fileName);
    return path.basename(fileName, ext)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/%/g, '')
        .replace(/&/g, ' E ')
        .replace(/\(1\)$/i, '')
        .replace(/copia$/i, 'COPIA')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_')
        .toUpperCase();
};

const exists = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};

const walk = async (dir) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await walk(fullPath));
        } else {
            files.push(fullPath);
        }
    }
    return files;
};

const copyIfMissing = async ({ source, baseName, extension }) => {
    const destination = path.join(targetDir, `${baseName}${extension}`);
    if (await exists(destination)) {
        return { destination, action: 'kept' };
    }
    await fs.copyFile(source, destination);
    return { destination, action: 'copied' };
};

const ensureOggIfPossible = async ({ source, baseName, extension }) => {
    const oggPath = path.join(targetDir, `${baseName}.ogg`);
    if (extension === '.ogg' || await exists(oggPath)) {
        return 'kept';
    }
    await ensureOggFromMp3({ mp3Path: source, oggPath });
    return 'converted';
};

const files = await walk(sourceRoot);
const imported = [];
const skipped = [];

await fs.mkdir(targetDir, { recursive: true });

for (const source of files) {
    const extension = path.extname(source).toLowerCase();
    const fileName = path.basename(source);
    if (!audioExtensions.has(extension)) {
        skipped.push({ fileName, reason: 'not-audio' });
        continue;
    }
    if (fileName.toLowerCase().includes(externalCountryToken)) {
        skipped.push({ fileName, reason: 'country-context-skip' });
        continue;
    }

    const normalized = normalizeBaseName(fileName);
    const baseNames = new Set([normalized]);
    const alias = explicitAliases.get(normalized);
    if (alias) {
        baseNames.add(alias);
    }

    for (const baseName of baseNames) {
        const copy = await copyIfMissing({ source, baseName, extension });
        let ogg = 'not-needed';
        if (extension !== '.ogg') {
            const conversionSource = copy.action === 'copied'
                ? copy.destination
                : path.join(targetDir, `${baseName}${extension}`);
            ogg = await ensureOggIfPossible({ source: conversionSource, baseName, extension });
        }
        imported.push({ fileName, baseName, extension, copy: copy.action, ogg });
    }
}

console.log(JSON.stringify({
    sourceRoot,
    targetDir,
    imported,
    skipped
}, null, 2));

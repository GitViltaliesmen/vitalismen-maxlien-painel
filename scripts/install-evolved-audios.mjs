import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { ensureOggFromMp3 } from '../src/services/audioTemplateService.js';

const repoRoot = process.cwd();
const defaultZipPath = '/Users/greson/Downloads/AUDIOS EQUADOR PARA AUTOMAÇÃO.zip';
const zipPath = process.env.VIT_POWER_AUDIO_ZIP || defaultZipPath;
const targetDir = path.join(repoRoot, 'public', 'media', 'templates', 'EC');

const audioMappings = [
    {
        canonical: 'CLIENTES_QUE_LIGAM',
        tokens: ['CLIENTES QUE LIGAM.mp3'],
        pattern: '*CLIENTES QUE LIGAM.mp3'
    },
    {
        canonical: 'NOME_CIUDAD_PROVICINCIA',
        tokens: ['NOME_CIUDAD_PROVICINCIA.mp3'],
        pattern: '*NOME_CIUDAD_PROVICINCIA.mp3'
    },
    {
        canonical: 'TRATAMENTO_Y_PRECIOS_PROMOCAO_1_3_6',
        tokens: ['TRATAMENTO', 'PRECIOS', '1 - 3 - 6.mp3'],
        prefer: (entry) => !entry.includes('(1)'),
        pattern: '*TRATAMENTO*PRECIOS*1 - 3 - 6.mp3'
    },
    {
        canonical: 'PRODUDO_LIQUIDO_X_CAPSULA_MELHOR',
        tokens: ['PRODUDO LIQUIDO X CAPSULA MELHOR.mp3'],
        pattern: '*PRODUDO LIQUIDO X CAPSULA MELHOR.mp3'
    },
    {
        canonical: 'OBRIGADO_PAGOU',
        tokens: ['OBRIGADO_PAGOU.mp3'],
        pattern: '*OBRIGADO_PAGOU.mp3'
    },
    {
        canonical: 'Informativo_Ana_Lopes_pedido_Em_fase_entrega',
        tokens: ['Informativo Ana Lopes pedido Em fase entrega.mp3'],
        pattern: '*Informativo Ana Lopes pedido Em fase entrega.mp3'
    },
    {
        canonical: 'COMO_SE_TOMA_VIT_POWER',
        tokens: ['COMO SE TOMA VIT POWER.mp3'],
        pattern: '*COMO SE TOMA VIT POWER.mp3'
    },
    {
        canonical: 'PROSTADA_FUNCIONA_E_QUANDO_CHEGA',
        tokens: ['FUNCIONA E QUANDO CHEGA.mp3'],
        pattern: '*FUNCIONA E QUANDO CHEGA.mp3'
    },
    {
        canonical: 'TEMPO_DEMORA_PRODUTO_CHEGAR',
        tokens: ['TEMPO DEMORA PRODUTO CHEGAR.mp3'],
        pattern: '*TEMPO DEMORA PRODUTO CHEGAR.mp3'
    },
    {
        canonical: 'TEMPO_RESULTADO_VIT_POWER',
        tokens: ['TEMPO_RESULTADO VIT POWER.mp3'],
        pattern: '*TEMPO_RESULTADO VIT POWER.mp3'
    },
    {
        canonical: 'ENVIO_AGENCIA_100_SEGURO',
        tokens: ['ENVIO_AGENCIA_100% SEGURO.mp3'],
        pattern: '*ENVIO_AGENCIA_100% SEGURO.mp3'
    },
    {
        canonical: 'QUANDO_DIZER_NAO_PODE_RETIRAR_PRODUTO',
        tokens: ['QUANDO DIZER', 'PODE RETIRAR PRODUTO.mp3'],
        pattern: '*QUANDO DIZER*PODE RETIRAR PRODUTO.mp3'
    },
    {
        canonical: 'ENTREGAS_A_SERVIENTREGAS_MELHOR_OPCAO',
        tokens: ['ENTREGAS A SERVIENTREGAS', 'MELHOR'],
        pattern: '*ENTREGAS A SERVIENTREGAS*MELHOR*.mp3'
    },
    {
        canonical: 'Ajuda_Prostata',
        tokens: ['Ajuda_Prostata.mp3'],
        pattern: '*Ajuda_Prostata.mp3'
    }
];

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const listZipEntries = () => {
    if (!fs.existsSync(zipPath)) {
        throw new Error(`Zip nao encontrado: ${zipPath}`);
    }
    return execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
        .split(/\r?\n/)
        .filter(Boolean);
};

const findEntry = (entries, mapping) => {
    const matches = entries.filter((entry) => mapping.tokens.every((token) => entry.includes(token)));
    if (matches.length === 0) return null;
    const preferred = mapping.prefer ? matches.find(mapping.prefer) : null;
    return preferred || matches[0];
};

const extractEntry = (mapping, dest) => {
    const data = execFileSync('unzip', ['-p', zipPath, mapping.pattern], { encoding: 'buffer', maxBuffer: 80 * 1024 * 1024 });
    ensureDir(path.dirname(dest));
    fs.writeFileSync(dest, data);
};

const main = async () => {
    ensureDir(targetDir);
    const entries = listZipEntries();
    const installed = [];
    const missing = [];

    for (const mapping of audioMappings) {
        const entry = findEntry(entries, mapping);
        if (!entry) {
            missing.push(mapping.canonical);
            continue;
        }

        const mp3Path = path.join(targetDir, `${mapping.canonical}.mp3`);
        const oggPath = path.join(targetDir, `${mapping.canonical}.ogg`);
        extractEntry(mapping, mp3Path);
        await ensureOggFromMp3({ mp3Path, oggPath });
        installed.push({ canonical: mapping.canonical, source: entry });
    }

    console.log(`[AUDIO-INSTALL] Zip: ${zipPath}`);
    console.log(`[AUDIO-INSTALL] Instalados: ${installed.length}`);
    for (const item of installed) {
        console.log(`  - ${item.canonical} <= ${item.source}`);
    }

    if (missing.length > 0) {
        console.log(`[AUDIO-INSTALL] Faltando no zip: ${missing.join(', ')}`);
        process.exitCode = 1;
    }
};

main().catch((error) => {
    console.error('[AUDIO-INSTALL] Falhou:', error);
    process.exit(1);
});

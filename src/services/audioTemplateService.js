import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegStatic);

const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const isNewer = (a, b) => {
    try {
        return fs.statSync(a).mtimeMs >= fs.statSync(b).mtimeMs;
    } catch {
        return false;
    }
};

const copyIfMissingOrOlder = (src, dest) => {
    try {
        if (!fs.existsSync(src)) return false;
        if (fs.existsSync(dest) && isNewer(dest, src)) return true;
        ensureDir(path.dirname(dest));
        fs.copyFileSync(src, dest);
        return true;
    } catch {
        return false;
    }
};

export const ensureOggFromMp3 = async ({ mp3Path, oggPath }) => {
    if (!mp3Path || !oggPath) return null;
    if (!fs.existsSync(mp3Path)) return null;

    if (fs.existsSync(oggPath) && isNewer(oggPath, mp3Path)) return oggPath;

    ensureDir(path.dirname(oggPath));

    await new Promise((resolve, reject) => {
        ffmpeg(mp3Path)
            .toFormat('ogg')
            .audioCodec('libopus')
            .on('end', resolve)
            .on('error', reject)
            .save(oggPath);
    });

    return oggPath;
};

const serverRoot = () => process.cwd(); // when started via `cd server && ...`
const repoRoot = () => path.resolve(process.cwd(), '..');
const templatesDir = () => path.join(serverRoot(), 'public', 'media', 'templates');

const OFFICIAL_EC_AUDIO_BASE_NAMES = new Set([
    '01_A_buenas_noches',
    '01_B_Buenos_dias',
    '01_C_Buenos_tardes',
    'NITRIX_INICIO_01_VALERIA_ZAMBRANO',
    'NITRIX_INICIO_01_VALERIA_ZAMBRANO_OFICIAL',
    'NOME_CIUDAD_PROVICINCIA',
    'PERGUNTA_AGENCIA_DOMICILIO',
    'ENDERECO_CIDADE_PROVINCIA_AGENCIA',
    'ENDERECO_ORIENTACAO',
    'ENDERECO_ERRADO',
    'PRODUDO_LIQUIDO_X_CAPSULA_MELHOR',
    'CONHECER_NECESSIDADES_CLIENTES',
    'DUVIDAS',
    'TRATAMENTO_Y_PRECIOS_PROMOCAO',
    '1_BOTELLA_POR_39',
    '3_BOTELLAS_POR_95_E_99',
    '6_BOTELLAS_POR_167_E_99',
    'QUANTOS_FRASCOS_E_DIA_QUERES',
    'Agradecimento_Agencia_01',
    'AGRADECIMENTO_AGENCIA_DE_ENTREGA',
    'BONUS_RETIRADA',
    'FUNCIONA_VIT_POWER',
    'FUNCIONA_TRATAMENTO_COMPLETO_100_NATURAL',
    '100_NATURAL_SEM_CONTRA_INDICACAO',
    'DEPOIMENTO_AUDIO_PRODUTO',
    'INFORMACOES_PESSOAIS_NAIS',
    'INFORMACOES_PESSOAS_NAIS',
    'CLIENTES_QUE_LIGAM',
    'QUANDO_CLIENTE_INSISTE_EM_LIGAR',
    'QUANDO_CLIENTE_LIGA_01',
    'QUANDO_CLIENTE_PEDIR_A_DOMICILIO_REFERENCIA_COMPLETA',
    'QUANDO_DIZER_NAO_PODE_RETIRAR_PRODUTO',
    'ENVIO_AGENCIA_100_SEGURO',
    'ENTREGA_SEGURA_RETIRE_NA_AGENCIA',
    'ENTREGAS_A_SERVIENTREGAS_MELHOR_OPCAO',
    'DOMICILIO_A_AGENCIA_DE_SERVIENTREGA',
    'SUGESTAO_ENTREGA_EM_SERVITREGA_01_QUANDO_CLIENTE_NAO_COLOCA_ENDERECO',
    'Ajuda_Prostata',
    'PROSTADA_FUNCIONA_E_QUANDO_CHEGA',
    'TEMPO_DEMORA_PRODUTO_CHEGAR',
    'TEMPO_RESULTADO_VIT_POWER',
    'COMO_SE_TOMA_VIT_POWER',
    'COMO_TOMAR_VIT_POWER_SEM_REFERENCIA_QUANTIDADE_LITRO',
    'TRATAMENTO_CONTINUA_NAO_EFEITO_IMEDIATO',
    'CONFIRMACION_Y_REGALITO_ESPECIAL',
    'Informativo_Ana_Lopes_pedido_Em_fase_entrega',
    'OBRIGADO_PAGOU',
    'GUIA',
    'Chegou_01',
    'Chegou_02',
    'Chegou_03'
]);

export const isApprovedCountryAudio = ({ country, baseName }) => {
    if (country !== 'EC') return false;
    return OFFICIAL_EC_AUDIO_BASE_NAMES.has(String(baseName || '').trim());
};

export const syncTemplatesForCountry = async (country) => {
    const targetDir = path.join(templatesDir(), country);
    ensureDir(targetDir);

    const sources = [];
    if (country === 'EC') {
        const srcDir = path.join(repoRoot(), 'ec');
        if (fs.existsSync(srcDir)) {
            for (const file of fs.readdirSync(srcDir)) {
                if (file.startsWith('._')) continue;
                const base = path.basename(file, path.extname(file));
                if (file.toLowerCase().endsWith('.mp3') && isApprovedCountryAudio({ country, baseName: base })) {
                    sources.push(path.join(srcDir, file));
                } else if (file.toLowerCase().endsWith('.mp3')) {
                    console.warn(`[TEMPLATES] Audio fora da lista oficial ignorado: ${country}/${base}`);
                }
            }
        }
    }

    const converted = [];
    for (const mp3Path of sources) {
        const base = path.basename(mp3Path, path.extname(mp3Path));
        // Copy MP3 to public templates for in-dashboard preview (Safari doesn't play OGG)
        const mp3CopyPath = path.join(targetDir, `${base}.mp3`);
        copyIfMissingOrOlder(mp3Path, mp3CopyPath);

        const oggPath = path.join(targetDir, `${base}.ogg`);
        try {
            const out = await ensureOggFromMp3({ mp3Path, oggPath });
            if (out) converted.push(out);
        } catch (e) {
            console.error(`[TEMPLATES] Failed converting ${mp3Path}:`, e);
        }
    }

    return converted;
};

export const listAudioTemplates = async (country) => {
    if (country !== 'EC') return [];

    await syncTemplatesForCountry(country);

    const dir = path.join(templatesDir(), country);
    if (!fs.existsSync(dir)) return [];

    const items = fs.readdirSync(dir)
        .filter((f) => f.toLowerCase().endsWith('.ogg'))
        .filter((f) => isApprovedCountryAudio({ country, baseName: f.replace(/\.ogg$/i, '') }))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
        .map((filename) => {
            const base = filename.replace(/\.ogg$/i, '');
            const mp3Filename = `${base}.mp3`;
            const mp3Exists = fs.existsSync(path.join(dir, mp3Filename));
            return {
                id: `${country}:${filename}`,
                label: base.replace(/_/g, ' ').toUpperCase(),
                country,
                mediaUrl: `/media/templates/${country}/${filename}`,
                previewUrl: mp3Exists ? `/media/templates/${country}/${mp3Filename}` : null
            };
        });

    return items;
};

export const resolveCountryAudio = async ({ country, baseName }) => {
    if (!country || !baseName) return null;
    if (!isApprovedCountryAudio({ country, baseName })) {
        console.warn(`[AUDIO-GUARD] Audio bloqueado fora do funil oficial: ${country}/${baseName}`);
        return null;
    }
    const dir = path.join(templatesDir(), country);
    const oggPath = path.join(dir, `${baseName}.ogg`);
    if (fs.existsSync(oggPath)) return oggPath;

    // Try to create it from the matching MP3 sources in repo root folders
    const mp3FromEc = path.join(repoRoot(), 'ec', `${baseName}.mp3`);
    const mp3Path = mp3FromEc;

    const out = await ensureOggFromMp3({ mp3Path, oggPath });
    return out;
};

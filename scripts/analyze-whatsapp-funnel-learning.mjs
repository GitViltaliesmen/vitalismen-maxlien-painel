import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const DEFAULT_DIR = '/Users/greson/GERSON CODEX';
const DEFAULT_ZIPS = [
    'CONVERSA 2800 1.zip',
    'Conversa do WhatsSAPP 2.zip',
    'Conversa do WhatsApp 3.zip',
    'Conversa do WhatsApp 4.zip',
    'CONVERSA 5.zip'
].map((name) => path.join(DEFAULT_DIR, name));

const repoRoot = process.cwd();
const docsDir = path.join(repoRoot, 'docs');
const today = new Date().toISOString().slice(0, 10);
const outMarkdown = path.join(docsDir, `RELATORIO_MELHORIA_FUNIL_AUTO_${today}.md`);
const outJson = path.join(docsDir, `RELATORIO_MELHORIA_FUNIL_AUTO_${today}.json`);

const normalize = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const shellUnzipList = (zipPath) => execFileSync('unzip', ['-Z', '-1', zipPath], { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const shellUnzipText = (zipPath, fileName) => execFileSync('unzip', ['-p', zipPath, fileName], { encoding: 'utf8' });

const parseWhatsAppExport = ({ zipPath, fileName, text }) => {
    const messages = [];
    const lines = String(text || '').split(/\r?\n/);
    const lineRegex = /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})\s+-\s+([^:]+):\s?(.*)$/;
    for (const line of lines) {
        const match = line.match(lineRegex);
        if (match) {
            const [, date, time, author, body] = match;
            messages.push({
                zipPath,
                fileName,
                date,
                time,
                author: author.trim(),
                body: String(body || '').trim()
            });
            continue;
        }
        if (messages.length && line.trim()) {
            messages[messages.length - 1].body = `${messages[messages.length - 1].body}\n${line.trim()}`.trim();
        }
    }
    return messages;
};

const roleFor = (author = '') => (/^\+/.test(String(author || '').trim()) ? 'cliente' : 'humano');

const PATTERNS = [
    { key: 'garantia_60_dias', label: 'Pergunta de garantia', regex: /\bgarant/i, rule: 'Responder curto: producto garantizado con 60 dias de garantia.' },
    { key: 'origem_produto', label: 'Origem/de onde vem', regex: /\b(origen|donde viene|de donde|laboratorio|fabrica)\b/i, rule: 'Usar DUVIDAS e voltar ao pedido.' },
    { key: 'doutora', label: 'Quem e a doutora', regex: /\b(doctora|doutora|maria fernandes|dra)\b/i, rule: 'Responder doctora Maria Fernandes, sem inventar biografia.' },
    { key: 'como_tomar', label: 'Como tomar/dose', regex: /\b(dosis|como se toma|como setoma|setoma|modo de uso)\b/i, rule: 'Usar COMO_SE_TOMA_VIT_POWER e seguir.' },
    { key: 'prazo_guia', label: 'Prazo/guia/ligacao transportadora', regex: /\b(cuando|cuando yega|yegan|llega|guia|me yaman|me llaman|me avisa)\b/i, rule: 'Responder prazo/guia curto, sem reiniciar venda.' },
    { key: 'recompra', label: 'Cliente antigo/recompra', regex: /\b(soy cliente|como siempre|ya compre|otra vez|mandeme de nuevo|m[aá]ndeme de nuevo)\b/i, rule: 'Usar recompra_confirmacao_rapida.' },
    { key: 'servientrega_typo', label: 'Erro Servientrega', regex: /\b(serentrega|servi en trega|cervi en trega|servi entrega|cervi entrega)\b/i, rule: 'Normalizar para Servientrega antes da busca.' },
    { key: 'santa_prisca_typo', label: 'Erro Santa Prisca', regex: /\bsanta presca\b/i, rule: 'Normalizar para Santa Prisca.' },
    { key: 'quantidade_erro', label: 'Quantidade com erro humano', regex: /\b(tre botella|tre botellas|tres meses|si dos|necesito \d+ frascos?)\b/i, rule: 'Detectar quantidade sem repetir promocao.' }
];

const classifyMessages = (messages) => {
    const findings = [];
    const longHumanMessages = [];
    const clientWithoutImmediateAnswer = [];
    const repeatedHumanBursts = [];
    const highConversionTurns = [];

    for (let index = 0; index < messages.length; index += 1) {
        const message = messages[index];
        const role = roleFor(message.author);
        const body = message.body || '';
        const clean = normalize(body);
        for (const pattern of PATTERNS) {
            if (pattern.regex.test(clean)) {
                findings.push({ ...pattern, date: message.date, time: message.time, author: message.author, text: body });
            }
        }
        if (role === 'humano' && body.length > 240) {
            longHumanMessages.push({ date: message.date, time: message.time, author: message.author, chars: body.length, text: body });
        }
        if (role === 'cliente') {
            const next = messages[index + 1];
            if (next && roleFor(next.author) === 'cliente') {
                clientWithoutImmediateAnswer.push({ date: message.date, time: message.time, text: body });
            }
        }
        if (role === 'humano') {
            const previous = messages[index - 1];
            const next = messages[index + 1];
            if (previous && next && roleFor(previous.author) === 'humano' && roleFor(next.author) === 'humano') {
                repeatedHumanBursts.push({ date: message.date, time: message.time, text: body });
            }
        }
        if (role === 'cliente' && /\b(precio|promocion|necesito|frascos?|botellas?|servientrega|agencia|nombre|cedula|ciudad|provincia)\b/i.test(clean)) {
            highConversionTurns.push({ date: message.date, time: message.time, text: body });
        }
    }

    return {
        findings,
        longHumanMessages,
        clientWithoutImmediateAnswer,
        repeatedHumanBursts,
        highConversionTurns
    };
};

const countBy = (items, key) => items.reduce((acc, item) => {
    const value = item[key] || '';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
}, {});

const uniqueSample = (items, limit = 8) => {
    const seen = new Set();
    const out = [];
    for (const item of items) {
        const text = String(item.text || '').trim();
        const key = normalize(text);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(item);
        if (out.length >= limit) break;
    }
    return out;
};

const zipPaths = process.argv.slice(2).length
    ? process.argv.slice(2).map((item) => path.resolve(item))
    : DEFAULT_ZIPS;

const existingZips = zipPaths.filter((zipPath) => fs.existsSync(zipPath));
if (!existingZips.length) {
    console.error('[FUNIL-LEARNING] Nenhum ZIP encontrado.');
    process.exit(1);
}

const conversations = [];
for (const zipPath of existingZips) {
    const txtFiles = shellUnzipList(zipPath).filter((file) => file.toLowerCase().endsWith('.txt'));
    for (const fileName of txtFiles) {
        const text = shellUnzipText(zipPath, fileName);
        const messages = parseWhatsAppExport({ zipPath, fileName, text });
        conversations.push({ zipPath, fileName, messages });
    }
}

const allMessages = conversations.flatMap((conversation) => conversation.messages);
const allClient = allMessages.filter((message) => roleFor(message.author) === 'cliente');
const allHuman = allMessages.filter((message) => roleFor(message.author) === 'humano');
const analysis = classifyMessages(allMessages);
const findingsByKey = countBy(analysis.findings, 'key');

const recommendations = [
    'Manter texto curto: uma resposta direta + um proximo passo.',
    'Quando cliente ja escolheu quantidade, nao repetir promocao.',
    'Quando cliente pergunta uma duvida, responder primeiro e voltar ao dado faltante.',
    'Lista de agencia sempre em blocos A/B/C separados por linha em branco.',
    'Depois de guia/retirada, usar avisos programados curtos; nao reiniciar funil comercial.',
    'Depois de repeticao de duvida ja respondida, pausar e deixar para humano ou aguardar nova intencao.'
];

const report = {
    generatedAt: new Date().toISOString(),
    sourceZips: existingZips,
    totals: {
        conversations: conversations.length,
        messages: allMessages.length,
        clientMessages: allClient.length,
        humanMessages: allHuman.length,
        findings: analysis.findings.length,
        longHumanMessages: analysis.longHumanMessages.length,
        clientWithoutImmediateAnswer: analysis.clientWithoutImmediateAnswer.length,
        repeatedHumanBursts: analysis.repeatedHumanBursts.length
    },
    findingsByKey,
    recommendations,
    samples: {
        findings: uniqueSample(analysis.findings, 12),
        highConversionTurns: uniqueSample(analysis.highConversionTurns, 12),
        longHumanMessages: uniqueSample(analysis.longHumanMessages, 6),
        clientWithoutImmediateAnswer: uniqueSample(analysis.clientWithoutImmediateAnswer, 6)
    }
};

const findingLines = Object.entries(findingsByKey)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `- ${key}: ${count}`)
    .join('\n') || '- Nenhum padrao critico encontrado.';

const sampleLines = (items) => uniqueSample(items, 8)
    .map((item) => `- ${item.date} ${item.time}: "${String(item.text || '').replace(/\s+/g, ' ').slice(0, 180)}"`)
    .join('\n') || '- Sem amostras.';

const markdown = [
    `# Relatorio Automatico de Melhoria do Funil - ${today}`,
    '',
    `Gerado em: ${report.generatedAt}`,
    '',
    '## Fontes',
    '',
    ...existingZips.map((zipPath) => `- ${zipPath}`),
    '',
    '## Numeros',
    '',
    `- Conversas: ${report.totals.conversations}`,
    `- Mensagens: ${report.totals.messages}`,
    `- Cliente: ${report.totals.clientMessages}`,
    `- Humano: ${report.totals.humanMessages}`,
    `- Padroes encontrados: ${report.totals.findings}`,
    `- Mensagens humanas longas: ${report.totals.longHumanMessages}`,
    `- Falas de cliente sem resposta humana imediata: ${report.totals.clientWithoutImmediateAnswer}`,
    '',
    '## Padroes Detectados',
    '',
    findingLines,
    '',
    '## Amostras de Alta Conversao',
    '',
    sampleLines(analysis.highConversionTurns),
    '',
    '## Pontos Para Melhorar',
    '',
    ...recommendations.map((item) => `- ${item}`),
    '',
    '## Frases/Erros Para Checklist',
    '',
    sampleLines(analysis.findings),
    '',
    '## Textos Longos A Evitar',
    '',
    sampleLines(analysis.longHumanMessages),
    '',
    '## Clientes Que Falaram Em Sequencia',
    '',
    sampleLines(analysis.clientWithoutImmediateAnswer),
    ''
].join('\n');

fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(outMarkdown, markdown);
fs.writeFileSync(outJson, JSON.stringify(report, null, 2));

console.log(`[FUNIL-LEARNING] OK markdown=${outMarkdown}`);
console.log(`[FUNIL-LEARNING] OK json=${outJson}`);

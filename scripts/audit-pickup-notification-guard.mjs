import fs from 'fs';
import path from 'path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const requireText = (file, text, label) => {
    if (!read(file).includes(text)) failures.push(`${label} (${file})`);
};
const rejectText = (file, text, label) => {
    if (read(file).includes(text)) failures.push(`${label} (${file})`);
};

requireText(
    'src/services/shipmentMessageService.js',
    'PICKUP_NOTICE_MESSAGE_PATTERNS_BY_KIND',
    'Avisos de retirada precisam de padroes exatos por etapa'
);
requireText(
    'src/services/shipmentMessageService.js',
    "'payload.recoveredFromExistingNotice': { $ne: true }",
    'Recuperacao global nao pode propagar evidencia recuperada'
);
rejectText(
    'src/services/shipmentMessageService.js',
    '/(retiro|retirar|recordar|recordarte|agencia|servientrega|comprobante|bonus)/i',
    'Padrao generico antigo de retirada nao pode voltar'
);
rejectText(
    'src/services/shipmentMessageService.js',
    'SHIPMENT_TEX_ULTRA_PICKUP_AUDIO_APPROVED',
    'Audio logistico de retirada nao pode ser bloqueado por produto'
);
requireText(
    'src/services/shipmentMessageService.js',
    'pickupLogisticsAudioForShipment',
    'Audio logistico precisa de regra universal testavel'
);
requireText(
    'src/services/shipmentMessageService.js',
    "if (family === 'nitrix') return 'NITRIX_USO_OXIDE_EC';",
    'Bonus Nitrix precisa usar audio de uso Nitrix'
);
requireText(
    'src/models/Shipment.js',
    'pickupProofDispatchLockedUntil',
    'Schema precisa persistir lock do comprovante'
);
requireText(
    'src/services/schedulerService.js',
    "flagEnabled('PICKUP_PROOF_SWEEP_ENABLED', false)",
    'Scheduler precisa de flag explicita para varredura de comprovantes'
);
requireText(
    'scripts/recover-pickup-arrival-notice.mjs',
    'Informe um unico pedido com --order=ORDER_ID.',
    'Recuperacao deve ser obrigatoriamente individual'
);
requireText(
    'tests/shipment-pickup-notification.test.mjs',
    'mensagem de guia ou transito nao comprova chegada nem lembretes',
    'Regressao de falsa evidencia precisa de teste'
);
requireText(
    'tests/shipment-pickup-notification.test.mjs',
    'audios logisticos de retirada sao universais para os tres produtos',
    'Nitrix, Tex Ultra e Vit Power precisam compartilhar o pos-venda logistico'
);

if (failures.length) {
    console.error('Pickup notification guard: FALHOU');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

console.log('Pickup notification guard: OK');

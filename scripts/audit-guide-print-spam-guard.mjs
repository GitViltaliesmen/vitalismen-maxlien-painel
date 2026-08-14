import fs from 'fs';
import path from 'path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const assertIncludes = (file, needle, message) => {
    if (!read(file).includes(needle)) failures.push(`${message} (${file})`);
};

assertIncludes('src/models/Shipment.js', 'guidePrintNotifiedAt', 'Schema persiste data de print de guia enviado');
assertIncludes('src/models/Shipment.js', 'guidePrintDispatchLockedUntil', 'Schema persiste lock de dispatch do print');
assertIncludes('src/models/Shipment.js', 'guidePrintLastAttemptAt', 'Schema persiste tentativa do print');
assertIncludes('src/models/Shipment.js', 'guidePrintLastError', 'Schema persiste erro do print');
assertIncludes('src/models/Shipment.js', 'guidePrintUrl', 'Schema persiste URL do print de guia');
assertIncludes('src/models/Shipment.js', 'guidePrintPath', 'Schema persiste path do print de guia');
assertIncludes('src/services/shipmentMessageService.js', 'existingGuidePrintMessage', 'Envio de print consulta mensagem ja enviada');
assertIncludes('src/services/shipmentMessageService.js', 'already_notified_existing_message', 'Envio de print bloqueia repeticao por historico');
assertIncludes('src/services/guidePrintDispatcherService.js', "'review.manualOnly': { $ne: true }", 'Dispatcher respeita pausa manual no lock final');

if (failures.length) {
    console.error('Guide print spam guard: FALHOU');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

console.log('Guide print spam guard: OK');

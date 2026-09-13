import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ console });
for (const file of ['customer-data-normalizer.js', 'agency-catalog.js']) {
    const source = fs.readFileSync(path.join(root, 'public', 'panel-intelligence', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
}

const catalog = context.VitalismenAgencyCatalog;
const atacames = {
    name: 'ATACAMES_PRINCIPAL',
    address: 'Calle 22 n Sl15 y Via Secundaria',
    city: 'ATACAMES',
    province: 'ESMERALDAS',
    sector: 'CENTRO'
};

assert.equal(
    catalog.formatAgencyOptionMessage(atacames, 3),
    'Opción 3: Servientrega Atacames Principal - Calle 22 n Sl15 y Via Secundaria - Sector Centro - Atacames, Esmeraldas'
);
assert.equal(
    catalog.formatAgencyOptionMessage({ ...atacames, name: 'Servientrega Atacames Principal' }, 5),
    'Opción 5: Servientrega Atacames Principal - Calle 22 n Sl15 y Via Secundaria - Sector Centro - Atacames, Esmeraldas'
);
assert.equal(
    catalog.formatAgencyOptionMessage({ ...atacames, sector: '' }, 27),
    'Opción 27: Servientrega Atacames Principal - Calle 22 n Sl15 y Via Secundaria - Atacames, Esmeraldas'
);

const panel = fs.readFileSync(path.join(root, 'public', 'qr.html'), 'utf8');
assert.match(panel, /agencyOptionLine\(agency, startNumber \+ index\)/);
assert.match(panel, /startNumber: state\.agencySuggestionOffset \+ index \+ 1/);
assert.match(panel, /startNumber: state\.agencySuggestionOffset \+ 1/);
assert.doesNotMatch(panel, /`Agencia: \$\{name\}`/);
assert.doesNotMatch(panel, /`Direccion \/ Referencia: \$\{address\}`/);
assert.doesNotMatch(panel, /`Ciudad \/ Provincia: \$\{location\}`/);

console.log('EC_PANEL_AGENCY_COMPACT_OPTIONS_V156=PASS');

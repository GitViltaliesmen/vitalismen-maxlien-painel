import assert from 'node:assert/strict';
import { zapiPayloadCountry } from '../src/routes/zapi.js';

const cases = [
    [{ from: '593997680147@c.us', text: { message: 'Hola' } }, 'EC'],
    [{ from: '573001234567@c.us', text: { message: 'Hola' } }, 'CO'],
    [{ fromMe: true, phone: '5515991418416', to: '593997680147', status: 'sent' }, 'EC'],
    [{ fromMe: true, phone: '5515991418416', to: '573001234567', status: 'sent' }, 'CO'],
    [{ connectedPhone: '5515991418416', event: 'connected' }, 'OTHER']
];

for (const [payload, expected] of cases) {
    assert.equal(zapiPayloadCountry(payload), expected, `payload routed to ${expected}`);
}

console.log(`Z-API EC/CO router: OK (${cases.length} cases)`);

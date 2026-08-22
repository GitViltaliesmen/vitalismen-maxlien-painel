import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const senderFiles = [
    'src/whatsapp/sendAudio.js',
    'src/whatsapp/sendImage.js',
    'src/whatsapp/sendVideo.js'
];

test('midia manual pode ser enviada no pos-venda sem desligar o guard automatico do Dropi', () => {
    for (const file of senderFiles) {
        const source = fs.readFileSync(file, 'utf8');
        assert.match(source, /const sendMode = options\.sendMode \|\| '';/, `${file} deve identificar o envio manual`);
        assert.match(
            source,
            /allowExistingDropiOrder: options\.allowExistingDropiOrder === true \|\| sendMode === 'manual_panel'/,
            `${file} deve liberar pedido Dropi existente somente para o operador manual`
        );
        assert.match(source, /checkDropiOrderBeforeOutbound\s*\(/, `${file} deve preservar o guard Dropi`);
        assert.match(source, /if \(!dropiGuard\.allowed\)/, `${file} deve continuar bloqueando automacao nao autorizada`);
    }
});

test('rota manual continua declarando o modo manual para audio, imagem e video', () => {
    const source = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
    const mediaDispatcher = source.slice(
        source.indexOf('const sendWhatsAppMessage = async'),
        source.indexOf('const scopedMessageQuery')
    );
    assert.match(mediaDispatcher, /const sendMode = options\.sendMode === 'manual_panel' \? 'manual_panel' : '';/);
    assert.match(mediaDispatcher, /sendAudio\([\s\S]*?sendMode,/);
    assert.match(mediaDispatcher, /sendImage\([\s\S]*?sendMode,/);
    assert.match(mediaDispatcher, /sendVideo\([\s\S]*?sendMode,/);
});

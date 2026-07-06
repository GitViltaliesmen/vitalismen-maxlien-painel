import fs from 'fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const assertIncludes = (path, text, label) => {
    const body = read(path);
    if (!body.includes(text)) throw new Error(`${label}: missing ${text}`);
};

assertIncludes('public/n/index.html', 'const SHOW_FORM_AFTER_SECONDS = 2280', 'CTA fallback deve respeitar minuto 38');
assertIncludes('public/n/index.html', 'Finalizar por WhatsApp', 'CTA final direto para WhatsApp existe');
assertIncludes('public/n/index.html', 'return waHttpsUrl(msg, sellerPhone)', 'Android deve usar wa.me compativel com navegador interno');
assertIncludes('public/n/index.html', 'recordFormVisible', 'Pagina deve medir CTA/form visivel');
assertIncludes('public/n/index.html', 'formVisible: true', 'Pagina deve enviar evento cta_visible');
assertIncludes('public/n/index.html', 'rawPhone && !isValidEcuadorPhone(phone)', 'Telefone deve ser opcional no CTA final');
assertIncludes('src/models/VslVisit.js', 'formVisibleCount', 'Modelo deve guardar quantidade de CTA visivel');
assertIncludes('src/routes/whatsapp.js', 'formVisibleCount: formVisible ? 1 : 0', 'Rota deve incrementar CTA visivel');
assertIncludes('src/routes/whatsapp.js', "['form_visible', 'cta_visible', 'checkout_visible']", 'Rota deve reconhecer eventos de CTA visivel');
assertIncludes('src/routes/whatsapp.js', 'if (formVisible) {', 'Rota deve preservar CTA visivel contra requisicoes paralelas');

console.log('[audit-ec-nx-funnel-click-path] OK - CTA final Nitrix medido e sem bloqueio de formulario.');

import fs from 'node:fs/promises';

// Somente fronteiras de I/O. Lifecycle, reconciliação, decisão, ledger e dispatch permanecem reais.
export async function load(url, context, nextLoad) {
    if (url.includes('?r4-original')) return nextLoad(url, context);
    const send = url.match(/\/src\/whatsapp\/(sendText|sendAudio|sendImage|sendDocument)\.js$/)?.[1];
    if (send) return { format: 'module', shortCircuit: true, source:
        `export const ${send} = async (...args) => globalThis.__R4_SINK_SEND('${send}', args);` };
    if (url.endsWith('/src/services/carrierTrackingService.js')) return {
        format: 'module', shortCircuit: true, source: `
            export * from ${JSON.stringify(`${url}?r4-original`)};
            export const trackCarrierGuide = async (input) => globalThis.__R4_TRACK(input);
            export const trackServientregaGuide = async (guide) => globalThis.__R4_TRACK({trackingNumber:guide,carrier:'servientrega'});
        `
    };
    if (url.endsWith('/src/services/droppiEcuadorBrowserService.js')) return {
        format: 'module', shortCircuit: true, source: `
            export * from ${JSON.stringify(`${url}?r4-original`)};
            export const syncDroppiEcuadorFromPanel = async () => ({ok:true,reason:'SINK_READ_ONLY'});
            export const fetchDroppiEcuadorOrdersApiReadOnly = async () => ({ok:true,rows:[]});
            export const downloadDroppiEcuadorInvoicePdf = async () => ({ok:false,reason:'SINK_NO_INVOICE'});
        `
    };
    if (url.endsWith('/src/whatsapp/sessionRouter.js')) return {
        format: 'module', shortCircuit: true, source: `
            export * from ${JSON.stringify(`${url}?r4-original`)};
            export const resolveOutboundSessionForJid = async () => ({sessionId:'r4-sink',reason:'SINK'});
            export const getSenderPoolStatus = () => ({sessions:[{sessionId:'r4-sink',connected:true}]});
            export const markSenderWalletDelivered = async () => ({ok:true});
        `
    };
    if (url.endsWith('/src/services/adminPanelStatusService.js')) {
        const source = (await fs.readFile(new URL(url), 'utf8')).replace(
            "return '/opt/maxlien-mvp/leads_ec.sqlite3';",
            "return process.env.V147_R4_SINK_DIRECTORY + '/leads_ec.sqlite3';"
        );
        return { format: 'module', shortCircuit: true, source };
    }
    return nextLoad(url, context);
}

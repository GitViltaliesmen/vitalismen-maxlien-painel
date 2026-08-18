import Shipment from '../models/Shipment.js';
import { applyShipmentLifecycleStatus } from './shipmentLifecycleStatusService.js';

const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.CARRIER_TRACKING_TIMEOUT_MS || '60000', 10);
const CARRIER_TRACKING_ENABLED = String(process.env.CARRIER_TRACKING_ENABLED || 'true').toLowerCase() !== 'false';

const normalizeText = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeCarrier = (carrier = '') => {
    const value = normalizeText(carrier).toLowerCase();
    if (/laar|laar\s*courier|laarcourier/.test(value)) return 'laar';
    if (/servientrega|servi\s*entrega/.test(value)) return 'servientrega';
    return value || 'servientrega';
};

export const normalizeCarrierTrackingStatus = (status = '') => {
    const raw = normalizeText(status).toUpperCase();
    if (!raw) return '';
    if (/ENTREGAD[OA]|MERCANCIA ENTREGADA|PEDIDO ENTREGADO|REPORTADO ENTREGADO/.test(raw)) return 'ENTREGADO';
    if (/DEVUELT[OA]|DEVOLUCION|NO RETIRAD[OA]|RETORNAD[OA]/.test(raw)) return 'DEVUELTO';
    if (/NOVEDAD|INCIDENCIA|REPROGRAMAD[OA]/.test(raw)) return 'NOVEDAD';
    if (/LIST[OA] PARA RETIRO|DISPONIBLE.*RETIRO|PARA RETIRO EN AGENCIA/.test(raw)) return 'READY_FOR_PICKUP';
    if (/INGRESANDO EN AGENCIA|PUNTO DE RETIRO|EN AGENCIA/.test(raw)) return 'EN_RUTA';
    if (/GUIA GENERADA|PREPARAD[OA] PARA TRANSPORTADORA|CREAD[OA]|ADMITID[OA]/.test(raw)) return 'GUIA_GENERADA';
    if (/EN RUTA|REPARTO|DESPACHO|BODEGA|TRANSPORTADORA|DISTRIBUCION|TRANSITO|TRANSITO|RECIBID[OA] EN|OPERATIVO/.test(raw)) return 'EN_RUTA';
    return raw;
};

const getPlaywright = async () => {
    try {
        return await import('playwright');
    } catch {
        throw new Error('playwright_not_installed');
    }
};

const launchCarrierBrowser = async () => {
    if (!CARRIER_TRACKING_ENABLED) throw new Error('carrier_tracking_disabled');
    const { chromium } = await getPlaywright();
    const browser = await chromium.launch({
        headless: String(process.env.CARRIER_TRACKING_HEADLESS || '1') !== '0',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    });
    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        locale: process.env.CARRIER_TRACKING_LOCALE || 'es-EC',
        timezoneId: process.env.CARRIER_TRACKING_TIMEZONE || 'America/Guayaquil',
        userAgent: process.env.CARRIER_TRACKING_USER_AGENT || undefined
    });
    await context.setExtraHTTPHeaders({
        'Accept-Language': process.env.CARRIER_TRACKING_ACCEPT_LANGUAGE || 'es-EC,es;q=0.9,en-US;q=0.8,en;q=0.7'
    });
    const page = await context.newPage();
    return { browser, context, page };
};

const closeCarrierBrowser = async ({ browser, context } = {}) => {
    if (context) await context.close().catch(() => null);
    if (browser) await browser.close().catch(() => null);
};

const cleanGuide = (value = '') => String(value || '').trim().replace(/\s+/g, '');

export const trackServientregaGuide = async (trackingNumber) => {
    const guide = cleanGuide(trackingNumber);
    if (!guide) return { ok: false, carrier: 'servientrega', reason: 'missing_tracking_number' };

    const session = await launchCarrierBrowser();
    const { page } = session;
    try {
        await page.goto(`https://www.servientrega.com.ec/Tracking/?guia=${encodeURIComponent(guide)}&tipo=GUIA`, {
            waitUntil: 'domcontentloaded',
            timeout: DEFAULT_TIMEOUT_MS
        });
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
        await page.waitForFunction(() => document.body?.innerText?.trim()?.length > 0, { timeout: 20000 });

        const result = await page.evaluate((expectedGuide) => {
            const lines = (document.body?.innerText || '')
                .split(/\n+/)
                .map((line) => line.replace(/\s+/g, ' ').trim())
                .filter(Boolean);
            const lineAfter = (label) => {
                const index = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());
                return index >= 0 ? (lines[index + 1] || '') : '';
            };
            const routeLine = lines.find((line) => /Origen:/i.test(line) && /Destino\s*:/i.test(line)) || '';
            const routeMatch = routeLine.match(/Origen:\s*(.*?)\s*\/\s*Destino\s*:\s*(.*)$/i);
            const guiaLine = lines.find((line) => /Gu[ií]a\s*N/i.test(line)) || '';
            const guiaMatch = guiaLine.match(/(\d{5,})/);
            const movementDate = lines.find((line) => /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(line)) || '';
            const movementIndex = movementDate ? lines.indexOf(movementDate) : -1;
            return {
                guia: guiaMatch?.[1] || expectedGuide,
                statusAtual: lineAfter('Estado actual:'),
                origem: routeMatch?.[1] || '',
                destino: routeMatch?.[2] || '',
                dataEnvio: '',
                dataMovimento: movementDate,
                ultimoMovimiento: movementIndex >= 0 ? (lines[movementIndex + 1] || '') : ''
            };
        }, guide);

        if (!result?.statusAtual && !result?.guia) {
            return { ok: false, carrier: 'servientrega', trackingNumber: guide, reason: 'not_found' };
        }
        return {
            ok: true,
            carrier: 'servientrega',
            trackingNumber: result.guia || guide,
            statusAtual: result.statusAtual || '',
            normalizedStatus: normalizeCarrierTrackingStatus([
                result.statusAtual,
                result.ultimoMovimiento
            ].filter(Boolean).join(' ')),
            origem: result.origem || '',
            destino: result.destino || '',
            dataEnvio: result.dataEnvio || '',
            dataMovimento: result.dataMovimento || '',
            ultimoMovimiento: result.ultimoMovimiento || ''
        };
    } catch (error) {
        return { ok: false, carrier: 'servientrega', trackingNumber: guide, reason: 'tracking_failed', error: error.message || String(error) };
    } finally {
        await closeCarrierBrowser(session);
    }
};

const normalizeLaarGuide = (value = '') => {
    const guide = cleanGuide(value).toUpperCase();
    if (/^LC\d+$/.test(guide)) return guide;
    if (/^\d{7,}$/.test(guide)) return `LC${guide}`;
    return guide;
};

export const trackLaarGuide = async (trackingNumber) => {
    const guide = cleanGuide(trackingNumber);
    if (!guide) return { ok: false, carrier: 'laar', reason: 'missing_tracking_number' };

    const session = await launchCarrierBrowser();
    const { page } = session;
    const attempts = [...new Set([normalizeLaarGuide(guide), guide.toUpperCase()])];
    try {
        await page.goto('https://fenixoper.laarcourier.com/Tracking/Guiacompleta.aspx', {
            waitUntil: 'domcontentloaded',
            timeout: DEFAULT_TIMEOUT_MS
        });

        for (const attempt of attempts) {
            const inputSel = '[id$="txtGuia"], [id$="txtNumGuia"]';
            const btnSel = '[id$="btnBuscar"], button:has-text("Buscar"), input[type="submit"]';
            await page.waitForSelector(inputSel, { timeout: 30000 });
            await page.fill(inputSel, '');
            await page.fill(inputSel, attempt);
            await Promise.all([
                page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT_MS }).catch(() => null),
                page.click(btnSel).catch(() => page.keyboard.press('Enter'))
            ]);
            await page.waitForSelector('#modalCargando, .modal-backdrop, [id*="Cargando"]', {
                state: 'detached',
                timeout: 5000
            }).catch(() => null);

            const hasResult = await page.waitForFunction(() => {
                const el = document.querySelector('[id$="lbltituloT"], #lbltituloT');
                const text = (el?.textContent || '').trim();
                return Boolean(text);
            }, { timeout: 30000 }).catch(() => null);
            if (!hasResult) continue;

            const result = await page.evaluate(() => {
                const tryText = (selectors) => {
                    for (const selector of selectors) {
                        const el = document.querySelector(selector);
                        const text = (el?.textContent || '').trim();
                        if (text) return text;
                    }
                    return '';
                };
                const findByLabel = (labels) => {
                    const nodes = Array.from(document.querySelectorAll('td, th, span, label, div'));
                    for (const el of nodes) {
                        const text = (el.textContent || '').trim().toLowerCase();
                        if (!text || !labels.some((label) => text.includes(label))) continue;
                        if (el.nextElementSibling?.textContent?.trim()) return el.nextElementSibling.textContent.trim();
                        const cells = Array.from(el.parentElement?.children || []);
                        const index = cells.indexOf(el);
                        for (let i = index + 1; i < cells.length; i += 1) {
                            const value = cells[i]?.textContent?.trim();
                            if (value) return value;
                        }
                    }
                    return '';
                };
                return {
                    guia: tryText(['[id$="lblGuia"]', '#ContentPlaceHolder1_lblGuia', '[id*="lblGuia"]']),
                    statusAtual: tryText(['[id$="lbltituloT"]', '#lbltituloT']),
                    origem: findByLabel(['origen']),
                    destino: findByLabel(['destino']),
                    dataEnvio: findByLabel(['fecha de envio', 'fecha de envío', 'fecha:']),
                    dataMovimento: findByLabel(['ultimo movimiento', 'último movimiento', 'movimiento'])
                };
            });

            if (result?.statusAtual || result?.guia) {
                return {
                    ok: true,
                    carrier: 'laar',
                    trackingNumber: result.guia || attempt,
                    statusAtual: result.statusAtual || '',
                    normalizedStatus: normalizeCarrierTrackingStatus(result.statusAtual || ''),
                    origem: result.origem || '',
                    destino: result.destino || '',
                    dataEnvio: result.dataEnvio || '',
                    dataMovimento: result.dataMovimento || ''
                };
            }
        }
        return { ok: false, carrier: 'laar', trackingNumber: guide, reason: 'not_found' };
    } catch (error) {
        return { ok: false, carrier: 'laar', trackingNumber: guide, reason: 'tracking_failed', error: error.message || String(error) };
    } finally {
        await closeCarrierBrowser(session);
    }
};

export const trackCarrierGuide = async ({ trackingNumber, carrier = 'servientrega' } = {}) => {
    const normalizedCarrier = normalizeCarrier(carrier);
    if (normalizedCarrier === 'laar') return trackLaarGuide(trackingNumber);
    return trackServientregaGuide(trackingNumber);
};

export const saveCarrierTrackingResult = async ({ shipmentId, result, updateStatus = false } = {}) => {
    if (!shipmentId || !result) return null;
    const setFields = {
        'raw.carrierTracking.lastCheckedAt': new Date(),
        'raw.carrierTracking.lastResult': result,
        'automation.browserCheckpoint': result.ok ? 'carrier_tracking_checked' : 'carrier_tracking_failed'
    };
    if (updateStatus && result.ok && result.normalizedStatus) {
        setFields['logistics.status'] = result.normalizedStatus;
        if (result.trackingNumber) setFields['logistics.trackingNumber'] = result.trackingNumber;
        if (result.carrier) setFields['logistics.distributionCompany'] = result.carrier.toUpperCase();
    }
    await Shipment.updateOne(
        { _id: shipmentId },
        {
            $set: setFields,
            $push: {
                events: {
                    $each: [{
                        kind: result.ok ? 'carrier_tracking_checked' : 'carrier_tracking_failed',
                        at: new Date(),
                        payload: result
                    }],
                    $slice: -80
                }
            }
        }
    );
    if (updateStatus && result.ok && result.normalizedStatus) {
        const lifecycle = await applyShipmentLifecycleStatus({
            shipmentId,
            status: result.normalizedStatus,
            source: 'carrier_tracking',
            carrierResult: result
        });
        if (lifecycle?.shipment) return lifecycle.shipment;
    }
    return Shipment.findById(shipmentId).lean();
};

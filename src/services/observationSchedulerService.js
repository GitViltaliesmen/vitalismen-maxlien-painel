import { generateObservationReport } from './observationReportService.js';

let running = false;

const flagEnabled = (name, fallback = false) => {
    const raw = process.env[name];
    if (raw === undefined) return fallback;
    return String(raw).toLowerCase() === 'true' || raw === '1';
};

const parseNumber = (name, fallback) => {
    const parsed = Number.parseInt(String(process.env[name] || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const runObservationReport = async () => {
    if (running) return;
    running = true;
    try {
        const report = await generateObservationReport({
            country: process.env.OBSERVATION_COUNTRY || 'EC',
            hours: parseNumber('OBSERVATION_LOOKBACK_HOURS', 24),
            limit: parseNumber('OBSERVATION_MESSAGE_LIMIT', 800),
            mode: 'automatic',
            generatedBy: 'observation-scheduler'
        });
        console.log(`[OBSERVATION] Relatorio salvo: ${report._id} | criticos=${report.summary?.critical || 0} importantes=${report.summary?.important || 0}`);
    } catch (error) {
        console.error('Observation Report Error:', error);
    } finally {
        running = false;
    }
};

export const startObservationScheduler = () => {
    if (!flagEnabled('OBSERVATION_REPORTS_ENABLED', false)) {
        console.log('[OBSERVATION] Observador desligado. Set OBSERVATION_REPORTS_ENABLED=true para ligar.');
        return;
    }

    const intervalMinutes = parseNumber('OBSERVATION_REPORT_INTERVAL_MINUTES', 60);
    const intervalMs = Math.max(15, intervalMinutes) * 60 * 1000;

    console.log(`[OBSERVATION] Observador ligado em modo somente leitura a cada ${Math.round(intervalMs / 60000)} minutos.`);
    setTimeout(() => runObservationReport(), 30000);
    setInterval(runObservationReport, intervalMs);
};

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const dashboard = fs.readFileSync(new URL('../public/funnel-metrics.html', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../src/services/funnelMetricsService.js', import.meta.url), 'utf8');

test('V134 mostra decisão compacta sem executar mudança de orçamento', () => {
    for (const text of [
        'Radar de Investimento',
        'Melhor janela para investir',
        'Horas quentes',
        'Criativo promissor',
        'Sugestão de investimento',
        '% ideal do orçamento',
        'Investir agora',
        'Manter',
        'Aguardar',
        'nenhuma alteração automática no Meta Ads'
    ]) assert.match(dashboard, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    assert.match(service, /mode:\s*'READ_ONLY_RECOMMENDATION'/);
    assert.doesNotMatch(dashboard, /budget[^\n]{0,80}(?:update|mutate|patch)\s*\(/i);
});

test('V134 usa janela de três horas, horário do Equador e exclui placements de QA', () => {
    assert.match(service, /America\/Guayaquil/);
    assert.match(service, /startHour \+ 3|slice\(startHour, startHour \+ 3\)/);
    assert.match(service, /startsWith\('qa_'\)/);
    assert.match(dashboard, /horário do Equador/i);
});

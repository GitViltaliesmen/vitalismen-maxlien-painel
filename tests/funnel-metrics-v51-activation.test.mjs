import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const activation = fs.readFileSync(
    'docs/PANEL_CUSTOMER_SELECTION_ISOLATION_ACTIVATION_RESULT_V51_20260824.md',
    'utf8'
);

test('registro da ativação V51 contém release, rollback e validações oficiais', () => {
    assert.match(activation, /production-20260824-bab7bbb/);
    assert.match(activation, /20260824T001100Z_production-20260824-bab7bbb/);
    assert.match(activation, /20260823T235000Z_production-20260823-a17e519/);
    assert.match(activation, /316\/316/);
    assert.match(activation, /PANEL_CUSTOMER_SELECTION_BROWSER_V51=OK|Playwright/);
    assert.match(activation, /Guayaquil \/ Guayas \/ Guayaquil Los Almendros/);
    assert.match(activation, /não criou nem alterou\s+esse pedido/);
});

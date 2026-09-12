const SAFE_OPERATIONS = new Set(['fixture', 'mock', 'normalize', 'read_health', 'read_channel', 'simulate_route']);

export class ShadowModeGate {
    constructor({ phase = 'V152_B', shadow = true } = {}) {
        this.phase = phase;
        this.shadow = shadow === true;
        Object.freeze(this);
    }

    assert(operation) {
        const normalized = String(operation || '').trim().toLowerCase();
        if (!this.shadow || !SAFE_OPERATIONS.has(normalized)) {
            const error = new Error(`v152_b_shadow_blocked:${normalized || 'unknown'}`);
            error.code = 'V152_B_REAL_EFFECT_BLOCKED';
            error.phase = this.phase;
            throw error;
        }
        return true;
    }

    status() {
        return Object.freeze({
            phase: this.phase,
            shadow: this.shadow,
            realPairing: false,
            realOutbound: false,
            realCustomerRouting: false,
            realHandoff: false,
            providerSwitch: false
        });
    }
}

export const V152_B_SHADOW_GATE = new ShadowModeGate();

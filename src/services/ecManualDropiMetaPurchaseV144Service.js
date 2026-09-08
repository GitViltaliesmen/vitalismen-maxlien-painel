import { ecManualDropiReleaseV119RouteDecision } from './ecManualDropiReleaseV119Service.js';
import { resolveEcBotCoreV78Configuration } from './ecBotCoreOperationalV78Service.js';

const clean = (value = '') => String(value ?? '').trim();

export const EC_MANUAL_DROPI_META_PURCHASE_V144_VERSION = 144;
export const EC_MANUAL_DROPI_META_PURCHASE_V144_EFFECT = 'meta_purchase';

export const ecManualDropiMetaPurchaseAllowedV144 = ({
    effect = '',
    context = null,
    env = process.env
} = {}) => {
    if (clean(effect).toLowerCase() !== EC_MANUAL_DROPI_META_PURCHASE_V144_EFFECT) return false;
    if (!resolveEcBotCoreV78Configuration(env).ready) return false;
    if (
        context?.writeContext !== true
        || context?.manualDropiV119 !== true
        || context?.manualDropiOperation !== 'submit'
        || context?.humanDropiActionV138 !== true
        || !clean(context?.humanDropiActorId)
        || !clean(context?.humanDropiRequestedOrderId)
    ) return false;

    const decision = ecManualDropiReleaseV119RouteDecision({
        method: context.method,
        path: context.path,
        env
    });
    return decision.allowed === true && decision.operation === 'submit';
};

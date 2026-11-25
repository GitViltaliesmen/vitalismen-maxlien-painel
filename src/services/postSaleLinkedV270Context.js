import { AsyncLocalStorage } from 'node:async_hooks';

// Shared with the EC runtime guard so transport checks use the exact
// authenticated request context, not a process-wide flag.
export const ecRuntimeContextStore = new AsyncLocalStorage();

const MEDIA_COMPONENTS = Object.freeze({
    DELIVERED_THANK_YOU: [undefined],
    PRODUCT_USAGE: [undefined],
    READY_FOR_PICKUP: ['AUDIO', 'GUIDE_PDF']
});

export const postSaleV270MediaAllowed = ({ env = process.env, options = {},
    context = ecRuntimeContextStore.getStore(), linkedCurrent = false,
    sealedCommit = globalThis.__VITALISMEN_SEALED_SUCCESSOR_CONTEXT?.commit } = {}) => {
    const event = options.postSaleEvent;
    return env.POST_SALE_V270_RUNTIME_ACTIVE === 'true'
        && /^[a-f0-9]{40}$/.test(env.POST_SALE_V270_COMMIT || '')
        && sealedCommit === env.POST_SALE_V270_COMMIT
        && linkedCurrent === true
        && context?.postSaleV270 === true
        && context?.postSaleV270Mode === 'run'
        && context?.writeContext === true
        && context?.method === 'POST'
        && context?.path === '/api/shipments/internal/post-sale-v270/cycle'
        && options.sendMode === 'post_sale_v270'
        && options.country === 'EC'
        && Boolean(event?.dedupeKey)
        && MEDIA_COMPONENTS[event.stage]?.includes(event.component) === true;
};

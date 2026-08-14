import path from 'path';
import ContactState from '../models/ContactState.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { sendImage } from '../whatsapp/sendImage.js';
import { sendText } from '../whatsapp/sendText.js';
import { resolveCountryAudio } from './audioTemplateService.js';
import { getSalesMedia } from './salesMediaCatalog.js';
import { TEX_ULTRA_EC_PRODUCT_PROFILE, texUltraPublicOfferText } from './texUltraProductProfile.js';

export const TEX_ULTRA_INITIAL_LAYER_ID = 'tex_ultra_initial_cancellable_v1';
export const texUltraInitialLayerEnabled = (env = process.env) => (
    String(env.TEX_ULTRA_INITIAL_LAYER_ENABLED || 'false').toLowerCase() === 'true'
);

export const TEX_ULTRA_INITIAL_CADENCE = Object.freeze([
    Object.freeze({ key: 'intro01', minMs: 2000, maxMs: 10000 }),
    Object.freeze({ key: 'intro02', minMs: 11000, maxMs: 20000 }),
    Object.freeze({ key: 'proof', minMs: 21000, maxMs: 25000 }),
    Object.freeze({ key: 'bottle', minMs: 28000, maxMs: 33000 }),
    Object.freeze({ key: 'offer', minMs: 35000, maxMs: 40000 })
]);
export const TEX_ULTRA_INITIAL_WAVE_JOIN_MS = 20000;

const AGENT_KEY = TEX_ULTRA_EC_PRODUCT_PROFILE.key;
const flowTimers = new Map();
let openWave = null;
let layerSendTail = Promise.resolve();
const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const stateChatId = (state = {}) => state.chatId || (state.phoneDigits ? `${digitsOnly(state.phoneDigits)}@c.us` : '');
const memoryOf = (state = {}) => state?.metadata?.perAgentMemory?.[AGENT_KEY] || {};
const flowOf = (state = {}) => memoryOf(state).initialLayerCadence || null;
const nowIso = () => new Date().toISOString();
const randomBetween = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
const continueRequested = (text = '') => (
    /\b(continue|continua|continuar|siga|sigue|seguir|puede seguir|mande lo demas|envie lo demas|envieme lo demas|muestreme lo demas|quiero ver lo demas)\b/i
        .test(String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
);

const clearFlowTimers = (flowId = '') => {
    const timers = flowTimers.get(flowId) || [];
    timers.forEach((timer) => clearTimeout(timer));
    flowTimers.delete(flowId);
};

const waveForStart = (anchor = new Date()) => {
    const startedAt = anchor.getTime();
    if (!openWave || startedAt > openWave.closesAt) {
        openWave = {
            id: `${TEX_ULTRA_INITIAL_LAYER_ID}_wave_${startedAt}`,
            openedAt: startedAt,
            closesAt: startedAt + TEX_ULTRA_INITIAL_WAVE_JOIN_MS
        };
    }
    return openWave;
};

const withLayerSendQueue = (task) => {
    const queued = layerSendTail.then(task, task);
    layerSendTail = queued.catch(() => null);
    return queued;
};

const saveFlow = async (state, flow, memoryPatch = {}) => {
    const currentMemory = memoryOf(state);
    state.assignedAgent = AGENT_KEY;
    state.countryCode = 'EC';
    state.tags = [...new Set([...(state.tags || []), 'TEX_ULTRA_EC'])];
    state.metadata = {
        ...(state.metadata || {}),
        productKey: AGENT_KEY,
        productName: TEX_ULTRA_EC_PRODUCT_PROFILE.displayName,
        productMedia: TEX_ULTRA_EC_PRODUCT_PROFILE.bottle.media,
        perAgentMemory: {
            ...((state.metadata || {}).perAgentMemory || {}),
            [AGENT_KEY]: {
                ...currentMemory,
                ...memoryPatch,
                initialLayerCadence: flow,
                updatedAt: nowIso()
            }
        },
        lastKnownFunnelStage: memoryPatch.stage
            ? `tex_ultra_${memoryPatch.stage}`
            : state.metadata?.lastKnownFunnelStage || 'tex_ultra_initial_cadence'
    };
    state.markModified('metadata');
    await state.save();
};

const proofKeyForState = (state = {}) => {
    const items = TEX_ULTRA_EC_PRODUCT_PROFILE.entry.proofItems
        .map((item) => String(item || '').replace(/^image:/, ''))
        .filter(Boolean);
    if (!items.length) return 'social_01';
    const digits = digitsOnly(state.phoneDigits || state.chatId);
    const seed = Number.parseInt(digits.slice(-4) || '0', 10) || 0;
    return items[seed % items.length];
};

export const buildTexUltraInitialSteps = ({
    anchor = new Date(),
    previous = {},
    randomBetweenFn = randomBetween
} = {}) => {
    let cumulativeDelayMs = 0;
    return Object.fromEntries(TEX_ULTRA_INITIAL_CADENCE.map((definition) => {
        const existing = previous?.[definition.key] || {};
        if (existing.sentAt) return [definition.key, existing];
        const delayMs = randomBetweenFn(definition.minMs, definition.maxMs);
        cumulativeDelayMs += delayMs;
        return [definition.key, {
            ...existing,
            minMs: definition.minMs,
            maxMs: definition.maxMs,
            delayMs,
            cumulativeDelayMs,
            timingMode: 'cumulative_between_steps',
            dueAt: new Date(anchor.getTime() + cumulativeDelayMs).toISOString(),
            sendingAt: '',
            failedAt: ''
        }];
    }));
};

const newFlow = ({ state, previous = null, sourceInboundAt = null } = {}) => {
    const anchor = new Date();
    const wave = previous?.waveId
        ? { id: previous.waveId, openedAt: new Date(previous.waveOpenedAt || anchor).getTime() }
        : waveForStart(anchor);
    return {
        id: `${TEX_ULTRA_INITIAL_LAYER_ID}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        version: 2,
        timingMode: 'cumulative_between_steps',
        status: 'running',
        startedAt: anchor.toISOString(),
        sourceInboundAt: new Date(sourceInboundAt || state.lastInboundAt || anchor).toISOString(),
        resumedAt: previous ? anchor.toISOString() : '',
        resumeCount: Number(previous?.resumeCount || 0) + (previous ? 1 : 0),
        waveId: wave.id,
        waveOpenedAt: new Date(wave.openedAt).toISOString(),
        interruptedAt: '',
        interruptionReason: '',
        proofKey: previous?.proofKey || proofKeyForState(state),
        steps: buildTexUltraInitialSteps({ anchor, previous: previous?.steps || {} })
    };
};

const sendLayerAudio = async ({ state, baseName, context }) => {
    const audioPath = await resolveCountryAudio({ country: 'EC', baseName });
    if (!audioPath) return false;
    return Boolean(await sendAudio(stateChatId(state), audioPath, true, {
        sessionId: state?.metadata?.lastSessionId || null,
        country: 'EC',
        outboundContext: context,
        dedupeValue: `${TEX_ULTRA_INITIAL_LAYER_ID}:${context}:${state._id}`
    }));
};

const sendProof = async ({ state, proofKey }) => {
    const proof = getSalesMedia(proofKey);
    if (!proof?.path) return false;
    return Boolean(await sendImage(stateChatId(state), proof.path, 'Le comparto una experiencia de clientes de nuestra atencion en Ecuador.', {
        country: 'EC',
        sessionId: state?.metadata?.lastSessionId || null,
        outboundContext: `tex_ultra_initial_${proofKey}`
    }));
};

const sendBottle = async (state) => Boolean(await sendImage(
    stateChatId(state),
    path.join(process.cwd(), 'public', TEX_ULTRA_EC_PRODUCT_PROFILE.bottle.media.replace(/^\/+/, '')),
    TEX_ULTRA_EC_PRODUCT_PROFILE.bottle.caption,
    {
        country: 'EC',
        sessionId: state?.metadata?.lastSessionId || null,
        outboundContext: 'tex_ultra_initial_bottle'
    }
));

const sendOffer = async (state) => Boolean(await sendText(
    stateChatId(state),
    `Hoy tenemos estas opciones de Tex Ultra:\n${texUltraPublicOfferText()}\n\n¿Cuantos frascos desea?`,
    null,
    {
        sessionId: state?.metadata?.lastSessionId || null,
        country: 'EC',
        outboundContext: 'tex_ultra_initial_offer_1_2_3_6',
        humanize: false,
        antiSpamKey: `${TEX_ULTRA_INITIAL_LAYER_ID}:offer:${state._id}`
    }
));

const sendStep = async ({ state, flow, stepKey }) => {
    const [intro01, intro02] = TEX_ULTRA_EC_PRODUCT_PROFILE.entry.audioNames;
    if (stepKey === 'intro01') return sendLayerAudio({ state, baseName: intro01, context: 'tex_ultra_inicio_01' });
    if (stepKey === 'intro02') return sendLayerAudio({ state, baseName: intro02, context: 'tex_ultra_inicio_02' });
    if (stepKey === 'proof') return sendProof({ state, proofKey: flow.proofKey });
    if (stepKey === 'bottle') return sendBottle(state);
    if (stepKey === 'offer') return sendOffer(state);
    return false;
};

const inboundAfterFlowStarted = (state, flow) => {
    const lastInboundAt = new Date(state.lastInboundAt || 0).getTime();
    const sourceInboundAt = new Date(flow.sourceInboundAt || 0).getTime();
    return Number.isFinite(lastInboundAt)
        && Number.isFinite(sourceInboundAt)
        && lastInboundAt > sourceInboundAt;
};

const previousStepSent = (flow, stepKey) => {
    const index = TEX_ULTRA_INITIAL_CADENCE.findIndex((item) => item.key === stepKey);
    if (index <= 0) return true;
    const previousKey = TEX_ULTRA_INITIAL_CADENCE[index - 1].key;
    return Boolean(flow.steps?.[previousKey]?.sentAt);
};

const firstWaveComplete = async (flow = {}) => {
    if (!flow.waveId) return true;
    const cadencePath = `metadata.perAgentMemory.${AGENT_KEY}.initialLayerCadence`;
    const blockers = await ContactState.countDocuments({
        [`${cadencePath}.waveId`]: flow.waveId,
        [`${cadencePath}.status`]: 'running',
        $or: [
            { [`${cadencePath}.steps.intro01.sentAt`]: { $in: ['', null] } },
            { [`${cadencePath}.steps.intro01.sentAt`]: { $exists: false } },
            { [`${cadencePath}.steps.intro02.sentAt`]: { $in: ['', null] } },
            { [`${cadencePath}.steps.intro02.sentAt`]: { $exists: false } }
        ]
    });
    return blockers === 0;
};

const scheduleStepRetry = ({ contactStateId, flowId, stepKey, delayMs = 750 }) => {
    const timer = setTimeout(() => {
        executeScheduledStep({ contactStateId, flowId, stepKey }).catch((error) => {
            console.error(`[TEX-ULTRA-INITIAL] falha no retry ${stepKey}:`, error.message);
        });
    }, delayMs);
    const timers = flowTimers.get(flowId) || [];
    timers.push(timer);
    flowTimers.set(flowId, timers);
};

async function executeScheduledStep({ contactStateId, flowId, stepKey }) {
    if (!texUltraInitialLayerEnabled()) return;
    let state = await ContactState.findById(contactStateId);
    if (!state) return;
    let flow = flowOf(state);
    if (!flow || flow.id !== flowId || flow.status !== 'running') return;

    if (inboundAfterFlowStarted(state, flow)) {
        flow = {
            ...flow,
            status: 'paused_by_customer',
            interruptedAt: nowIso(),
            interruptionReason: 'new_customer_interaction'
        };
        await saveFlow(state, flow, { stage: 'initial_cadence_paused' });
        clearFlowTimers(flowId);
        return;
    }

    if (!previousStepSent(flow, stepKey)) {
        scheduleStepRetry({ contactStateId, flowId, stepKey });
        return;
    }

    if (!['intro01', 'intro02'].includes(stepKey) && !await firstWaveComplete(flow)) {
        scheduleStepRetry({ contactStateId, flowId, stepKey });
        return;
    }

    const step = flow.steps?.[stepKey] || {};
    if (step.sentAt || step.sendingAt) return;
    const cadencePath = `metadata.perAgentMemory.${AGENT_KEY}.initialLayerCadence`;
    const sendingAt = nowIso();
    state = await ContactState.findOneAndUpdate(
        {
            _id: contactStateId,
            [`${cadencePath}.id`]: flowId,
            [`${cadencePath}.status`]: 'running',
            $and: [
                {
                    $or: [
                        { [`${cadencePath}.steps.${stepKey}.sentAt`]: { $in: ['', null] } },
                        { [`${cadencePath}.steps.${stepKey}.sentAt`]: { $exists: false } }
                    ]
                },
                {
                    $or: [
                        { [`${cadencePath}.steps.${stepKey}.sendingAt`]: { $in: ['', null] } },
                        { [`${cadencePath}.steps.${stepKey}.sendingAt`]: { $exists: false } }
                    ]
                }
            ]
        },
        {
            $set: {
                [`${cadencePath}.steps.${stepKey}.sendingAt`]: sendingAt,
                [`${cadencePath}.steps.${stepKey}.failedAt`]: ''
            }
        },
        { new: true }
    );
    if (!state) return;
    flow = flowOf(state);
    if (!flow || flow.id !== flowId) return;

    const outcome = await withLayerSendQueue(async () => {
        const freshState = await ContactState.findById(contactStateId);
        const freshFlow = flowOf(freshState);
        if (!freshState || !freshFlow || freshFlow.id !== flowId || freshFlow.status !== 'running') {
            return { cancelled: true, sent: false };
        }
        if (inboundAfterFlowStarted(freshState, freshFlow)) {
            const pausedFlow = {
                ...freshFlow,
                status: 'paused_by_customer',
                interruptedAt: nowIso(),
                interruptionReason: 'new_customer_interaction_before_queued_send'
            };
            await saveFlow(freshState, pausedFlow, { stage: 'initial_cadence_paused' });
            clearFlowTimers(flowId);
            return { cancelled: true, sent: false };
        }
        return { cancelled: false, sent: await sendStep({ state: freshState, flow: freshFlow, stepKey }) };
    });
    if (outcome.cancelled) return;
    const sent = outcome.sent;
    state = await ContactState.findById(contactStateId);
    if (!state) return;
    flow = flowOf(state);
    if (!flow || flow.id !== flowId) return;
    const finishedAt = nowIso();
    const nextStep = {
        ...(flow.steps?.[stepKey] || {}),
        sendingAt: '',
        sentAt: sent ? finishedAt : '',
        failedAt: sent ? '' : finishedAt
    };
    const completed = sent && stepKey === 'offer';
    flow = {
        ...flow,
        status: sent ? (completed ? 'completed' : 'running') : 'paused_error',
        completedAt: completed ? finishedAt : flow.completedAt || '',
        steps: { ...(flow.steps || {}), [stepKey]: nextStep }
    };
    const memoryPatch = {
        ...(stepKey === 'intro01' && sent ? { intro01SentAt: finishedAt } : {}),
        ...(stepKey === 'intro02' && sent ? { intro02SentAt: finishedAt } : {}),
        ...(stepKey === 'proof' && sent ? { proofSentAt: finishedAt, initialProofKey: flow.proofKey } : {}),
        ...(stepKey === 'bottle' && sent ? { bottleSentAt: finishedAt, presentationSentAt: finishedAt } : {}),
        ...(stepKey === 'offer' && sent ? { offerSentAt: finishedAt } : {}),
        stage: completed ? 'awaiting_quantity' : sent ? 'initial_cadence' : 'initial_cadence_paused'
    };
    await saveFlow(state, flow, memoryPatch);
    if (!sent || completed) clearFlowTimers(flowId);
};

const scheduleFlow = ({ contactStateId, flow }) => {
    clearFlowTimers(flow.id);
    const timers = [];
    for (const definition of TEX_ULTRA_INITIAL_CADENCE) {
        const step = flow.steps?.[definition.key] || {};
        if (step.sentAt) continue;
        const dueAt = new Date(step.dueAt || 0).getTime();
        const delayMs = Math.max(0, dueAt - Date.now());
        timers.push(setTimeout(() => {
            executeScheduledStep({ contactStateId, flowId: flow.id, stepKey: definition.key }).catch((error) => {
                console.error(`[TEX-ULTRA-INITIAL] falha na etapa ${definition.key}:`, error.message);
            });
        }, delayMs));
    }
    flowTimers.set(flow.id, timers);
};

export const startTexUltraInitialLayer = async ({ state } = {}) => {
    if (!texUltraInitialLayerEnabled() || !state?._id) return { started: false, reason: 'disabled_or_missing_state' };
    const existing = flowOf(state);
    if (existing && ['running', 'paused_by_customer', 'paused_error'].includes(existing.status)) {
        return { started: false, reason: 'flow_already_exists', flow: existing };
    }
    const flow = newFlow({ state, sourceInboundAt: state.lastInboundAt || new Date() });
    await saveFlow(state, flow, { stage: 'initial_cadence' });
    scheduleFlow({ contactStateId: state._id, flow });
    return { started: true, flow };
};

const resumeFlow = async ({ state, previous }) => {
    clearFlowTimers(previous.id);
    const flow = newFlow({ state, previous, sourceInboundAt: state.lastInboundAt || new Date() });
    await saveFlow(state, flow, { stage: 'initial_cadence' });
    scheduleFlow({ contactStateId: state._id, flow });
    return flow;
};

export const interruptTexUltraInitialLayerOnInbound = async ({ state, inboundText = '' } = {}) => {
    if (!texUltraInitialLayerEnabled() || !state?._id) return { active: false, handled: false };
    let flow = flowOf(state);
    if (!flow || flow.status === 'completed') return { active: false, handled: false, flow };

    if (flow.status === 'running') {
        clearFlowTimers(flow.id);
        flow = {
            ...flow,
            status: 'paused_by_customer',
            interruptedAt: nowIso(),
            interruptionReason: 'new_customer_interaction'
        };
        await saveFlow(state, flow, { stage: 'initial_cadence_paused' });
    }

    if (continueRequested(inboundText)) {
        const resumed = await resumeFlow({ state, previous: flow });
        return { active: true, handled: true, resumed: true, flow: resumed };
    }

    return { active: true, handled: false, interrupted: true, flow };
};

// Timers Node nao sobrevivem a restart. Em vez de reconstruir timers e
// disparar mensagens durante um deploy, qualquer fluxo orfao e pausado de
// forma persistente. Fluxos iniciados depois do boot continuam usando a
// cadencia normal; um fluxo pausado so volta mediante pedido explicito do
// cliente para continuar.
export const pauseOrphanedTexUltraInitialFlowsOnStartup = async (env = process.env) => {
    if (!texUltraInitialLayerEnabled(env)) {
        return { acknowledged: 0, modified: 0, reason: 'layer_disabled' };
    }
    const cadencePath = `metadata.perAgentMemory.${AGENT_KEY}.initialLayerCadence`;
    const pausedAt = nowIso();
    const result = await ContactState.updateMany(
        {
            [`${cadencePath}.status`]: 'running',
            $or: [
                { assignedAgent: AGENT_KEY },
                { 'metadata.productKey': AGENT_KEY },
                { tags: 'TEX_ULTRA_EC' }
            ]
        },
        {
            $set: {
                [`${cadencePath}.status`]: 'paused_restart',
                [`${cadencePath}.interruptedAt`]: pausedAt,
                [`${cadencePath}.interruptionReason`]: 'process_restart_no_automatic_outbound',
                'metadata.lastKnownFunnelStage': 'tex_ultra_initial_cadence_paused_restart'
            }
        }
    );
    const summary = {
        acknowledged: result.acknowledged ? 1 : 0,
        modified: Number(result.modifiedCount || 0),
        reason: 'startup_pause_without_outbound'
    };
    console.log(`[TEX-ULTRA-INITIAL] startup seguro: ${summary.modified} cadencia(s) orfa(s) pausada(s), sem disparo.`);
    return summary;
};

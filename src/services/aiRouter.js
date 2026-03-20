import fs from "fs";
import path from "path";
import OpenAI from "openai";

import { getMemory, pushHistory } from "./memoryStore.js";
import { getPrice } from "./tools/pricing.js";
import { listShippingOptions } from "./tools/shipping.js";
import { getTracking } from "./tools/tracking.js";
import { createOrderNote } from "./tools/orders.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function loadKB(country = "CO") {
    const base = path.resolve(process.cwd(), "src", "kb");
    // Ensure directory exists or handle error gracefully if needed, 
    // but for now we assume they exist as per code logic.
    const policiesPath = path.join(base, "policies.md");
    const productPath = path.join(base, country === "CO" ? "product_co.md" : "product_ec.md");

    let policies = "";
    let product = "";

    try {
        policies = fs.readFileSync(policiesPath, "utf-8");
    } catch (e) {
        console.warn(`[KB] Missing policies.md at ${policiesPath}`);
    }

    try {
        product = fs.readFileSync(productPath, "utf-8");
    } catch (e) {
        console.warn(`[KB] Missing product file at ${productPath}`);
    }

    return { policies, product };
}

export async function routeAndRespond({ phoneE164, country, userText }) {
    const mem = await getMemory(phoneE164);
    const { policies, product } = loadKB(country);

    const tools = [
        {
            type: "function",
            function: {
                name: "get_price",
                description: "Retorna preço para país e quantidade.",
                parameters: {
                    type: "object",
                    properties: {
                        country: { type: "string", enum: ["CO", "EC"] },
                        qty: { type: "integer", enum: [1, 3, 6] }
                    },
                    required: ["country", "qty"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "list_shipping_options",
                description: "Lista opções de entrega e agências por cidade (se existir base).",
                parameters: {
                    type: "object",
                    properties: {
                        country: { type: "string", enum: ["CO", "EC"] },
                        city: { type: "string" }
                    },
                    required: ["country", "city"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "get_tracking",
                description: "Busca rastreio por telefone e/ou orderId (stub até plugar Dropi).",
                parameters: {
                    type: "object",
                    properties: {
                        country: { type: "string", enum: ["CO", "EC"] },
                        phoneE164: { type: "string" },
                        orderId: { type: "string" }
                    },
                    required: ["country", "phoneE164"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "create_order_note",
                description: "Registra anotação de pedido/atendimento no DB.",
                parameters: {
                    type: "object",
                    properties: {
                        phoneE164: { type: "string" },
                        country: { type: "string", enum: ["CO", "EC"] },
                        note: { type: "string" }
                    },
                    required: ["phoneE164", "country", "note"]
                }
            }
        }
    ];

    const system = `
Você é um atendente humano de alta conversão (Maxlien/SuperFull).
Fale em espanhol natural (CO se country=CO, EC se country=EC).
Respostas curtas. 1 pergunta por vez.
NUNCA invente preço, rastreio, agência ou políticas: use as tools quando precisar.
Sempre termine com CTA (uma pergunta para avançar).
`;

    const messages = [
        { role: "system", content: system },
        { role: "system", content: `POLÍTICAS:\n${policies}` },
        { role: "system", content: `PRODUTO:\n${product}` },
        ...(mem?.history || []).slice(-12),
        { role: "user", content: userText }
    ];

    const resp = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.4
    });

    const msg = resp.choices?.[0]?.message;
    if (!msg) return { text: "Perdón, tuve un fallo. ¿Puedes repetir?" };

    // tool-calls
    if (msg.tool_calls?.length) {
        const toolResults = [];

        for (const call of msg.tool_calls) {
            const name = call.function.name;
            const args = JSON.parse(call.function.arguments || "{}");

            let result = { ok: false, error: "Unknown tool" };

            try {
                if (name === "get_price") result = await getPrice(args.country, args.qty);
                if (name === "list_shipping_options") result = await listShippingOptions(args.country, args.city);
                if (name === "get_tracking") result = await getTracking(args.country, args.phoneE164, args.orderId);
                if (name === "create_order_note") result = await createOrderNote(args.phoneE164, args.country, args.note);
            } catch (err) {
                console.error(`Error executing tool ${name}:`, err);
                result = { ok: false, error: err.message };
            }

            toolResults.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify(result)
            });
        }

        const resp2 = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
            messages: [...messages, msg, ...toolResults],
            temperature: 0.4
        });

        const text = (resp2.choices?.[0]?.message?.content || "").trim() || "Listo. ¿Me confirmas un dato?";
        await pushHistory(phoneE164, userText, text);
        return { text };
    }

    const text = (msg.content || "").trim();
    await pushHistory(phoneE164, userText, text);
    return { text };
}

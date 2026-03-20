import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder'
});

export const generateWelcomeMessage = async ({ name, country, type = 'welcome' }) => {
    // Determine context based on country
    const context = country === 'CO'
        ? {
            agentName: 'Isabel Sánchez',
            teamName: 'equipo de la Dra. María Fernández',
            productName: 'superfull',
            basePrompt: `Hola ${name}, aquí Isabel Sánchez del equipo de la Dra. María Fernández. Gracias por confiar en superfull, la solución natural para recuperar tu potencia y vitalidad. Me alegra mucho que haya decidido dar este paso. Si tiene alguna duda, puede contar conmigo. Considérame una amiga en este proceso. Te aviso que su pedido ya fue procesado para ser enviado. El envío tarda de 2 a 5 días hábiles. Feliz noche.`
        }
        : {
            agentName: 'Ana',
            teamName: 'equipo de la Dra. María Fernández',
            productName: 'VitPowerss',
            basePrompt: `Hola ${name}, aquí Ana del equipo de la Dra. María Fernández. Gracias por confiar en VitPowerss, la solución natural para recuperar tu potencia y vitalidad. Me alegra mucho que haya decidido dar este paso. Si tiene alguna duda, puede contar conmigo. Considérame una amiga en este proceso. Te aviso que su pedido ya fue procesado para ser enviado. El envío tarda de 2 a 5 días hábiles. Feliz noche.`
        };

    if (type === 'recovery') {
        const recoveryPrompt = country === 'CO'
            ? `Hola, soy Isabel Sánchez del equipo de la doctora María Fernández. Vi que dejaste iniciado tu pedido de 3 frascos de superfull pero no se terminó de completar. Si quieres, yo misma te ayudo a dejar todo listo ahora mismo, para que empieces tu tratamiento cuanto antes. Si prefieres más privacidad, podemos enviarlo a una oficina de Servientrega para que lo retires tú mismo, o si prefieres a domicilio, me pasas calle, referencia y ciudad y te lo mandamos directo a tu casa. Dime, ¿cuántos frascos deseas llevar al final, mantenemos los 3 frascos o quieres ajustar la cantidad?`
            : `Hola, soy Ana del equipo de la doctora María Fernández. Vi que dejaste iniciado tu pedido de 3 frascos de VitPowerss pero no se terminó de completar. Si quieres, yo misma te ayudo a dejar todo listo ahora mismo, para que empieces tu tratamiento cuanto antes. Si prefieres más privacidad, podemos enviarlo a una oficina de Servientrega para que lo retires tú mismo, o si prefieres a domicilio, me pasas calle, referencia y ciudad y te lo mandamos directo a tu casa. Dime, ¿cuántos frascos deseas llevar al final, mantenemos los 3 frascos o quieres ajustar la cantidad?`;

        return generateAIResponse(recoveryPrompt, name);
    }

    return generateAIResponse(context.basePrompt, name);
};

export const rewriteMessage = async ({ baseMessage, customerName = 'Cliente', systemPrompt }) => {
    if (!baseMessage) return '';
    if (!process.env.OPENAI_API_KEY) return baseMessage;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: systemPrompt || "Reescribe el mensaje proporcionado ligeramente para que suene natural y variado, manteniendo el significado central y los detalles clave exactamente como están. No agregues emojis. Mantenlo adecuado para una nota de voz de WhatsApp."
                },
                { role: "user", content: `Reescribe este mensaje para el cliente ${customerName}: "${baseMessage}"` }
            ],
            model: "gpt-3.5-turbo",
            temperature: 0.7,
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('OpenAI Error:', error);
        return baseMessage;
    }
};

const generateAIResponse = async (baseMessage, customerName) => {
    // If no API key, return base message
    if (!process.env.OPENAI_API_KEY) return baseMessage;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "Eres un asistente de ventas amable, cálido y profesional. Tu tarea es reescribir el mensaje proporcionado ligeramente para que suene natural y variado, manteniendo el significado central, el nombre del agente (`Isabel Sánchez` o `Ana`), el nombre del producto (`superfull` o `VitPowerss`) y los detalles clave exactamente como están. Agrega un saludo cálido apropiado para la hora (Buenos días/tardes/noches) basado en la hora actual (asume UTC-5). NO elimines la oferta ni los detalles de envío." },
                { role: "user", content: `Reescribe este mensaje para el cliente ${customerName}: "${baseMessage}"` }
            ],
            model: "gpt-3.5-turbo",
            temperature: 0.7,
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('OpenAI Error:', error);
        return baseMessage; // Fallback to template
    }
};

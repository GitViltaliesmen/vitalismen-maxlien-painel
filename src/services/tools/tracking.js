export async function getTracking(country, phoneE164, orderId) {
    return {
        ok: true,
        country,
        phoneE164,
        orderId: orderId || null,
        status: "pending_integration",
        message: "Aún no tengo el rastreo conectado. Puedo verificar y confirmarte en breve."
    };
}

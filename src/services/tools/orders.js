export async function createOrderNote(phoneE164, country, note) {
    // TODO: gravar no Mongo (Model) ou chamar seu dashboard Flask
    return { ok: true, saved: true, phoneE164, country, note };
}

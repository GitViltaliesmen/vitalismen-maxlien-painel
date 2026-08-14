import fs from "fs";
import path from "path";

function loadAgencies(country) {
    const base = path.resolve(process.cwd(), "src", "kb");
    // Check if directory exists, if not, creating it would be outside this function scope but good to know
    const p = path.join(base, "shipping_agencies_ec.json");
    try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return []; }
}

export async function listShippingOptions(country, city) {
    const agencies = loadAgencies(country);
    const c = (city || "").toLowerCase().trim();
    const matches = c
        ? agencies.filter(a => (a.city || "").toLowerCase().includes(c)).slice(0, 8)
        : [];

    return { ok: true, country, city, options: ["domicilio", "agencia"], agencies: matches };
}

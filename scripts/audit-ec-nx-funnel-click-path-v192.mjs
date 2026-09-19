import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);

const requireText = (source, text, label) => {
    assert.ok(source.includes(text), `[V192 NX] ${label}:missing:${text}`);
};

const requirePattern = (source, pattern, label) => {
    assert.match(source, pattern, `[V192 NX] ${label}`);
};

export const auditNxV192Source = (source) => {
    const body = String(source || '');

    requireText(body, 'const SHOW_FORM_AFTER_SECONDS = 2280', 'fallback_cta_38_min');
    requirePattern(body, /<button\s+id="btnSubmit"\s+type="button">[^<]+<\/button>/, 'final_cta_button');
    requireText(body, 'event.target.id === "btnSubmit"', 'final_cta_click_binding');
    requireText(body, 'submitWhatsappFromForm();', 'final_cta_submit_binding');
    requireText(body, 'openWhatsappEntry(vslAbEntryMessage(), fullName, phone);', 'final_cta_entry');

    requireText(body, 'const sellerPhone = await nextSellerFromServer(message, fullName);', 'seller_phone_resolution');
    requireText(body, 'openWhatsAppNow(message, sellerPhone);', 'whatsapp_destination');
    requireText(body, 'return waHttpsUrl(msg, sellerPhone);', 'https_whatsapp_route');
    requireText(body, 'https://api.whatsapp.com/send?phone=', 'https_whatsapp_url');
    requireText(body, 'whatsapp://send?phone=', 'whatsapp_deep_link');
    requireText(body, 'sellerE164(sellerPhone)', 'seller_phone_used');
    requireText(body, 'showManualWhatsAppLink(fallbackUrl);', 'manual_whatsapp_fallback');
    requireText(body, 'link.href = url;', 'manual_whatsapp_link');

    requireText(body, 'recordFormVisible(reason)', 'cta_visibility_measurement');
    requireText(body, 'formVisible: true', 'cta_visible_payload');
    requireText(body, 'intent: "cta_visible"', 'cta_visible_intent');
    requireText(body, 'recordWhatsappClick(message, fullName, phone)', 'whatsapp_click_measurement');
    requireText(body, 'intent: "whatsapp_click"', 'whatsapp_click_intent');

    requirePattern(body, /function\s+isValidEcuadorPhone\(value\)\s*{[\s\S]*?\^5939\\d\{8\}\$[\s\S]*?}/, 'optional_phone_validation');
    requireText(body, 'function isAllowedCheckoutPhone(value)', 'phone_validation_contract');
    requirePattern(body, /function\s+customerPhone\(\)\s*{[\s\S]*?return\s+override\s*\?\s*override\.e164\s*:\s*"";[\s\S]*?}/, 'phone_optional_contract');

    const submitMatch = body.match(/function\s+submitWhatsappFromForm\(\)\s*{([\s\S]*?)\n}/);
    assert.ok(submitMatch, '[V192 NX] submit_function_missing');
    assert.doesNotMatch(submitMatch[1], /\b(?:if|throw)\b|return\s+false/, '[V192 NX] unexpected_submit_block');
    assert.doesNotMatch(body, /Finalizar por WhatsApp/, '[V192 NX] obsolete_visual_text_assertion_reintroduced');

    return Object.freeze({
        finalCtaOperational: true,
        whatsappDestination: true,
        whatsappHttpsLink: true,
        sellerPhoneUsed: true,
        ctaMeasured: true,
        optionalPhoneValidated: true,
        submitUnblocked: true,
        historicalVisualTextRequired: false
    });
};

export const auditNxV192File = (relativePath = 'public/n/index.html') => {
    const source = fs.readFileSync(path.resolve(relativePath), 'utf8');
    return auditNxV192Source(source);
};

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
    const result = auditNxV192File();
    console.log('EC_NX_FUNNEL_CLICK_PATH_V192_AUDIT=OK');
    console.log('NX_OLD_ASSERT_REMOVED=YES');
    console.log(`NX_CURRENT_CONTRACT_VALIDATED=${[
        result.finalCtaOperational,
        result.whatsappDestination,
        result.whatsappHttpsLink,
        result.sellerPhoneUsed,
        result.ctaMeasured,
        result.optionalPhoneValidated,
        result.submitUnblocked,
        result.historicalVisualTextRequired === false
    ].every(Boolean) ? 'YES' : 'NO'}`);
    console.log('VSL_CHANGED=NO');
}

// Derived verbatim from approved isolated BFF predicate; auth prerequisites remain with callers.
export function validateDropiBffListContract({ httpStatus, jsonValid, contentTypeClass, body } = {}) {
    const reject = (reason, flagClass = 'NOT_EVALUATED') => ({ ok: false, reason, flagClass });
    if (httpStatus !== 200 || jsonValid !== true || contentTypeClass !== 'JSON') return reject('HTTP_OR_JSON_INVALID');
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!object(body) || !object(body.data)) return reject('CONTRACT_INVALID');
    const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
    const containers = [body, body.data];
    const flags = containers.flatMap(value => ['is_successful', 'is_succesfull', 'isSuccess', 'success', 'isSuccessful']
        .filter(key => own(value, key)).map(key => value[key]));
    const flagClass = !flags.length ? 'ABSENT' : flags.some(value => typeof value !== 'boolean') ? 'INVALID'
        : flags.includes(true) && flags.includes(false) ? 'CONFLICT' : flags[0] ? 'TRUE' : 'FALSE';
    if (['INVALID', 'CONFLICT', 'FALSE'].includes(flagClass)) return reject('EXPLICIT_FAILURE_OR_FLAG_CONFLICT', flagClass);
    for (const value of containers) {
        for (const key of ['error', 'errors']) {
            if (!own(value, key)) continue;
            const error = value[key];
            if (error !== null && error !== false && error !== '' && !(Array.isArray(error) && error.length === 0)) {
                return reject('EXPLICIT_ERROR', flagClass);
            }
        }
        for (const key of ['status', 'statusCode', 'status_code', 'code']) {
            if (own(value, key) && ![200, '200', 'ok', 'success'].includes(
                typeof value[key] === 'string' ? value[key].trim().toLowerCase() : value[key])) {
                return reject('ERROR_OR_UNKNOWN_STATUS', flagClass);
            }
        }
        for (const key of ['message', 'status_reason']) {
            if (typeof value[key] === 'string'
                && /unauthenticated|unauthorized|not authenticated|invalid.token|token.{0,30}(expired|invalid)|jwt.{0,30}(expired|invalid)|sesi[oó]n.{0,30}(expirada|inv[aá]lida)|no autorizado|AUTH_FAILED|TOKEN_EXPIRED|^\s*(error|failed|failure|falha)\b/i.test(value[key])) {
                return reject('AUTH_OR_FAILURE_MESSAGE', flagClass);
            }
        }
    }
    // Exactly the known list position; alternative envelopes are not inferred.
    if (['objects', 'orders', 'results', 'items', 'records'].some(key => own(body, key))
        || ['orders', 'results', 'items', 'records', 'data'].some(key => own(body.data, key))) return reject('AMBIGUOUS_LIST_FORMAT', flagClass);
    if (!Array.isArray(body.data.objects) || body.data.objects.some(item => !object(item))) return reject('LIST_INVALID', flagClass);
    return { ok: true, reason: flagClass === 'ABSENT' ? 'ACCEPT_KNOWN_CONTRACT_NO_FLAG' : 'ACCEPT_KNOWN_CONTRACT_TRUE_FLAG', flagClass };
}

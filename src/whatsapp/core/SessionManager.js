import fs from 'node:fs/promises';
import path from 'node:path';

const SAFE_NAMESPACE = /^[a-z0-9][a-z0-9_-]{1,79}$/i;
const containsQrMaterial = (value) => {
    if (!value || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, nested]) => /(^|_)(qr|qrcode|pairingcode)($|_)/i.test(key)
        || (nested && typeof nested === 'object' && containsQrMaterial(nested)));
};

export class SessionManager {
    constructor({ storageRoot, fsApi = fs } = {}) {
        if (!storageRoot || !path.isAbsolute(storageRoot)) throw new Error('whatsapp_session_storage_root_absolute_required');
        this.storageRoot = path.resolve(storageRoot);
        this.fs = fsApi;
    }

    resolveNamespace(namespace) {
        if (!SAFE_NAMESPACE.test(String(namespace || ''))) throw new Error('invalid_session_namespace');
        const resolved = path.resolve(this.storageRoot, String(namespace));
        if (!resolved.startsWith(`${this.storageRoot}${path.sep}`)) throw new Error('session_namespace_escape');
        return resolved;
    }

    async ensureNamespace(namespace) {
        const directory = this.resolveNamespace(namespace);
        await this.fs.mkdir(directory, { recursive: true, mode: 0o700 });
        await this.fs.chmod(directory, 0o700);
        return directory;
    }

    async writeState(namespace, name, value) {
        if (!SAFE_NAMESPACE.test(String(name || ''))) throw new Error('invalid_session_state_name');
        if (containsQrMaterial(value)) throw new Error('qr_material_persistence_forbidden');
        const directory = await this.ensureNamespace(namespace);
        const target = path.join(directory, `${name}.json`);
        const temporary = `${target}.${process.pid}.tmp`;
        await this.fs.writeFile(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600, flag: 'wx' });
        await this.fs.chmod(temporary, 0o600);
        await this.fs.rename(temporary, target);
        await this.fs.chmod(target, 0o600);
        return target;
    }

    async readState(namespace, name) {
        if (!SAFE_NAMESPACE.test(String(name || ''))) throw new Error('invalid_session_state_name');
        const target = path.join(this.resolveNamespace(namespace), `${name}.json`);
        return JSON.parse(await this.fs.readFile(target, 'utf8'));
    }

    static fromEnvironment(env = process.env) {
        return new SessionManager({ storageRoot: env.WHATSAPP_SESSION_STORAGE_ROOT });
    }
}

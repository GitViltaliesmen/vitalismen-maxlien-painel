const successorOverrideKey = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const normalizeOverrideFiles = (overrideFiles) => {
    if (!Array.isArray(overrideFiles)) {
        throw new TypeError('[SUCCESSOR-GUARD-CONTEXT] lista de overrides inválida.');
    }

    return overrideFiles.map((relativePath) => {
        if (
            typeof relativePath !== 'string'
            || relativePath.length === 0
            || relativePath.startsWith('/')
            || relativePath.startsWith('\\')
            || relativePath.includes('..')
            || relativePath.includes('\\')
        ) {
            throw new TypeError(`[SUCCESSOR-GUARD-CONTEXT] caminho relativo inválido: ${relativePath}`);
        }
        return relativePath;
    });
};
export const getSuccessorOverrideFiles = () => [
    ...(globalThis[successorOverrideKey] || [])
];

export const withSuccessorGuardContext = async (overrideFiles, operation) => {
    if (typeof operation !== 'function') {
        throw new TypeError('[SUCCESSOR-GUARD-CONTEXT] operação obrigatória.');
    }

    const inherited = getSuccessorOverrideFiles();
    const normalized = normalizeOverrideFiles(overrideFiles);
    globalThis[successorOverrideKey] = [...new Set([...inherited, ...normalized])];

    try {
        return await operation();
    } finally {
        if (inherited.length > 0) {
            globalThis[successorOverrideKey] = inherited;
        } else {
            delete globalThis[successorOverrideKey];
        }
    }
};

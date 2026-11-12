import Message from '../models/Message.js';
import { captureInboundMedia as captureInboundMediaV30, inboundMediaInternalUrl, inboundMediaStorageRoot, loadStoredInboundMedia, INBOUND_MEDIA_STATUS } from './inboundMediaStorageService.js';

// Preserve the frozen V30 storage implementation. Incomplete inbound callbacks
// may report an existing media message without repeating its temporary URL.
export const captureInboundMedia = async (options = {}) => {
    const { messageId, providerUrl, messageModel = Message, storageRoot = inboundMediaStorageRoot() } = options;
    const id = String(messageId || '').trim();
    if (!id || providerUrl) return captureInboundMediaV30(options);

    const read = () => messageModel.findById(id).select('+storedMediaPath').lean();
    const preserve = async (message) => {
        if (message?.mediaStorageStatus === INBOUND_MEDIA_STATUS.FETCHING) {
            return { status: INBOUND_MEDIA_STATUS.FETCHING, cached: false, inProgress: true };
        }
        if (message?.mediaStorageStatus !== INBOUND_MEDIA_STATUS.READY) return null;
        try {
            const stored = await loadStoredInboundMedia({ filePath: message.storedMediaPath, storageRoot });
            return {
                status: INBOUND_MEDIA_STATUS.READY,
                cached: true,
                mediaUrl: message.mediaUrl || inboundMediaInternalUrl(id),
                storedMime: message.storedMime || '',
                size: stored.stat.size,
                sha256: message.mediaSha256 || ''
            };
        } catch (error) {
            return { status: INBOUND_MEDIA_STATUS.FAILED, error: error.code || 'stored_media_unavailable' };
        }
    };
    const existing = await preserve(await read());
    if (existing) return existing;

    const failed = await messageModel.updateOne({
        _id: id,
        mediaStorageStatus: { $nin: [INBOUND_MEDIA_STATUS.READY, INBOUND_MEDIA_STATUS.FETCHING] }
    }, {
        $set: {
            mediaStorageStatus: INBOUND_MEDIA_STATUS.FAILED,
            mediaDownloadError: 'missing_provider_media_url',
            mediaUrl: '',
            mediaPreviewUrl: ''
        }
    });
    if (failed.matchedCount === 0) {
        const concurrent = await preserve(await read());
        if (concurrent) return concurrent;
    }
    return { status: INBOUND_MEDIA_STATUS.FAILED, error: 'missing_provider_media_url' };
};

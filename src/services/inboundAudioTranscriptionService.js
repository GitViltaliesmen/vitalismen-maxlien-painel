import fs from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

const mimeToExtension = (mime = '') => {
    const normalized = String(mime || '').toLowerCase();
    if (normalized.includes('ogg')) return 'ogg';
    if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
    if (normalized.includes('mp4') || normalized.includes('m4a')) return 'm4a';
    if (normalized.includes('webm')) return 'webm';
    if (normalized.includes('wav')) return 'wav';
    return 'ogg';
};

const writeTempAudio = async ({ buffer, mimetype, messageId = 'audio' }) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-audio-'));
    const safeId = String(messageId || 'audio').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60);
    const filePath = path.join(dir, `${safeId}.${mimeToExtension(mimetype)}`);
    fs.writeFileSync(filePath, buffer);
    return { dir, filePath };
};

const cleanupTempAudio = ({ dir, filePath }) => {
    try {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    } catch (error) {
        console.warn('[AUDIO-INBOUND] falha ao limpar temporario:', error.message);
    }
};

export const transcribeInboundAudioBuffer = async ({
    buffer,
    mimetype = 'audio/ogg',
    messageId = 'audio'
} = {}) => {
    if (String(process.env.WHATSAPP_TRANSCRIBE_INBOUND_AUDIO || 'true').toLowerCase() !== 'true') {
        return { ok: false, skipped: 'disabled' };
    }

    if (!buffer?.length) return { ok: false, skipped: 'empty_audio' };

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn('[AUDIO-INBOUND] OPENAI_API_KEY ausente; audio inbound nao transcrito.');
        return { ok: false, skipped: 'missing_openai_key' };
    }

    const temp = await writeTempAudio({ buffer, mimetype, messageId });
    try {
        const form = new FormData();
        form.append('file', fs.createReadStream(temp.filePath));
        form.append('model', process.env.OPENAI_AUDIO_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe');
        form.append('language', process.env.OPENAI_AUDIO_TRANSCRIPTION_LANGUAGE || 'es');

        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${apiKey}`
            },
            timeout: Number.parseInt(String(process.env.OPENAI_AUDIO_TRANSCRIPTION_TIMEOUT_MS || '45000'), 10)
        });

        const text = String(response.data?.text || '').trim();
        if (!text) return { ok: false, skipped: 'empty_transcription' };
        return { ok: true, text };
    } catch (error) {
        const detail = error.response?.data?.error?.message || error.message;
        console.warn('[AUDIO-INBOUND] falha ao transcrever audio:', detail);
        return { ok: false, error: detail };
    } finally {
        cleanupTempAudio(temp);
    }
};

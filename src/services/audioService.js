import axios from 'axios';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import dotenv from 'dotenv';
dotenv.config();

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID_ANA_LOPEZ
    || process.env.ELEVENLABS_VOICE_ID_ANA
    || '';
let ttsDisabledReason = null;
let ttsDisabledLogged = false;

export const generateAudio = async (text, outputPath) => {
    // If no API key, return null (skip audio)
    if (!process.env.ELEVENLABS_API_KEY || !VOICE_ID) {
        console.warn('ElevenLabs API key or approved Ana Lopez voice missing. Skipping audio generation.');
        return null;
    }

    if (ttsDisabledReason) {
        if (!ttsDisabledLogged) {
            console.warn(`ElevenLabs audio disabled: ${ttsDisabledReason}`);
            ttsDisabledLogged = true;
        }
        return null;
    }

    try {
        const mp3Path = outputPath.replace('.ogg', '.mp3');

        // 1. Generate MP3 from ElevenLabs
        const response = await axios({
            method: 'POST',
            url: `${ELEVENLABS_API_URL}/${VOICE_ID}`,
            data: {
                text: text,
                model_id: 'eleven_multilingual_v2', // Good for Spanish
                output_format: 'mp3_44100_128',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            },
            headers: {
                'Accept': 'audio/mpeg',
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer',
            validateStatus: () => true
        });

        const contentType = String(response.headers?.['content-type'] || '');
        if (response.status < 200 || response.status >= 300 || !contentType.includes('audio')) {
            const errorBody = Buffer.from(response.data || []).toString('utf8');
            if (response.status === 401 && errorBody.includes('missing_permissions')) {
                ttsDisabledReason = 'API key missing text_to_speech permission';
            }
            console.error('Audio Generation Error:', `status=${response.status} body=${errorBody}`);
            return null;
        }

        // Save MP3 temporarily
        const writer = fs.createWriteStream(mp3Path);
        writer.write(Buffer.from(response.data));
        writer.end();

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // 2. Convert to OGG (Opus) for WhatsApp
        await new Promise((resolve, reject) => {
            ffmpeg(mp3Path)
                .toFormat('ogg')
                .audioCodec('libopus')
                .on('end', () => {
                    // Clean up MP3
                    fs.unlinkSync(mp3Path);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    console.error('FFmpeg error:', err);
                    reject(err);
                })
                .save(outputPath);
        });

        return outputPath;

    } catch (error) {
        console.error('Audio Generation Error:', error.response ? error.response.data : error.message);
        return null;
    }
};

import path from 'path';
import fs from 'fs';

const mediaPath = (...parts) => path.join(process.cwd(), 'public', 'media', 'sales', ...parts);

const CATALOG = {
    social_01: {
        key: 'social_01',
        path: mediaPath('shared', 'social_01.jpeg'),
        caption: 'Mire estos clientes que ya usaron el producto y hablaron muy bien de su resultado.'
    },
    social_02: {
        key: 'social_02',
        path: mediaPath('shared', 'social_02.jpeg'),
        caption: 'Le comparto otra prueba social real para que vea como otros clientes mejoraron con el tratamiento.'
    },
    social_03: {
        key: 'social_03',
        path: mediaPath('shared', 'social_03.jpeg'),
        caption: 'Aqui tiene otra referencia de cliente satisfecho para darle mas tranquilidad.'
    },
    social_04: {
        key: 'social_04',
        path: mediaPath('shared', 'social_04.jpeg'),
        caption: 'Le comparto una prueba social adicional para que vea continuidad en los resultados.'
    },
    testimonial_audio: {
        key: 'testimonial_audio',
        path: path.join(process.cwd(), 'public', 'media', 'templates', 'EC', 'DEPOIMENTO_AUDIO_PRODUTO.ogg'),
        type: 'audio',
        caption: ''
    },
    prova_social_video_boquet: {
        key: 'prova_social_video_boquet',
        path: mediaPath('shared', 'prova_social_video_boquet.mp4'),
        type: 'video',
        viewOnce: true,
        caption: ''
    },
    vit_power_bottle: {
        key: 'vit_power_bottle',
        path: mediaPath('ec', 'vit_power.jpeg'),
        caption: 'Este es el frasco oficial de Vit Power para Ecuador.'
    }
};

export const getSalesMedia = (key) => {
    const item = CATALOG[String(key || '').trim()];
    if (!item) return null;
    if (!fs.existsSync(item.path)) return null;
    return item;
};

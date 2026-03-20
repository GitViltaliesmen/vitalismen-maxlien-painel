import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegStatic);

const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const isNewer = (a, b) => {
    try {
        return fs.statSync(a).mtimeMs >= fs.statSync(b).mtimeMs;
    } catch {
        return false;
    }
};

const copyIfMissingOrOlder = (src, dest) => {
    try {
        if (!fs.existsSync(src)) return false;
        if (fs.existsSync(dest) && isNewer(dest, src)) return true;
        ensureDir(path.dirname(dest));
        fs.copyFileSync(src, dest);
        return true;
    } catch {
        return false;
    }
};

export const ensureOggFromMp3 = async ({ mp3Path, oggPath }) => {
    if (!mp3Path || !oggPath) return null;
    if (!fs.existsSync(mp3Path)) return null;

    if (fs.existsSync(oggPath) && isNewer(oggPath, mp3Path)) return oggPath;

    ensureDir(path.dirname(oggPath));

    await new Promise((resolve, reject) => {
        ffmpeg(mp3Path)
            .toFormat('ogg')
            .audioCodec('libopus')
            .on('end', resolve)
            .on('error', reject)
            .save(oggPath);
    });

    return oggPath;
};

const serverRoot = () => process.cwd(); // when started via `cd server && ...`
const repoRoot = () => path.resolve(process.cwd(), '..');
const templatesDir = () => path.join(serverRoot(), 'public', 'media', 'templates');

export const syncTemplatesForCountry = async (country) => {
    const targetDir = path.join(templatesDir(), country);
    ensureDir(targetDir);

    const sources = [];
    if (country === 'CO') {
        const srcDir = path.join(repoRoot(), 'AUDIOS REFORMULADOS COLOMBIA_GERSON');
        if (fs.existsSync(srcDir)) {
            for (const file of fs.readdirSync(srcDir)) {
                if (file.toLowerCase().endsWith('.mp3')) {
                    sources.push(path.join(srcDir, file));
                }
            }
        }
    }
    if (country === 'EC') {
        const srcDir = path.join(repoRoot(), 'ec');
        if (fs.existsSync(srcDir)) {
            for (const file of fs.readdirSync(srcDir)) {
                if (file.toLowerCase().endsWith('.mp3')) {
                    sources.push(path.join(srcDir, file));
                }
            }
        }
    }

    const converted = [];
    for (const mp3Path of sources) {
        const base = path.basename(mp3Path, path.extname(mp3Path));
        // Copy MP3 to public templates for in-dashboard preview (Safari doesn't play OGG)
        const mp3CopyPath = path.join(targetDir, `${base}.mp3`);
        copyIfMissingOrOlder(mp3Path, mp3CopyPath);

        const oggPath = path.join(targetDir, `${base}.ogg`);
        try {
            const out = await ensureOggFromMp3({ mp3Path, oggPath });
            if (out) converted.push(out);
        } catch (e) {
            console.error(`[TEMPLATES] Failed converting ${mp3Path}:`, e);
        }
    }

    return converted;
};

export const listAudioTemplates = async (country) => {
    if (country !== 'CO' && country !== 'EC') return [];

    await syncTemplatesForCountry(country);

    const dir = path.join(templatesDir(), country);
    if (!fs.existsSync(dir)) return [];

    const items = fs.readdirSync(dir)
        .filter((f) => f.toLowerCase().endsWith('.ogg'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
        .map((filename) => {
            const base = filename.replace(/\.ogg$/i, '');
            const mp3Filename = `${base}.mp3`;
            const mp3Exists = fs.existsSync(path.join(dir, mp3Filename));
            return {
                id: `${country}:${filename}`,
                label: base.replace(/_/g, ' ').toUpperCase(),
                country,
                mediaUrl: `/media/templates/${country}/${filename}`,
                previewUrl: mp3Exists ? `/media/templates/${country}/${mp3Filename}` : null
            };
        });

    return items;
};

export const resolveCountryAudio = async ({ country, baseName }) => {
    if (!country || !baseName) return null;
    const dir = path.join(templatesDir(), country);
    const oggPath = path.join(dir, `${baseName}.ogg`);
    if (fs.existsSync(oggPath)) return oggPath;

    // Try to create it from the matching MP3 sources in repo root folders
    const mp3FromCo = path.join(repoRoot(), 'AUDIOS REFORMULADOS COLOMBIA_GERSON', `${baseName}.mp3`);
    const mp3FromEc = path.join(repoRoot(), 'ec', `${baseName}.mp3`);
    const mp3Path = country === 'CO' ? mp3FromCo : mp3FromEc;

    const out = await ensureOggFromMp3({ mp3Path, oggPath });
    return out;
};

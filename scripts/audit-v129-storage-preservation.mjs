import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

// Read production; only create protected evidence and byte-identical external copies.
const root = '/opt/vitalismen-automacao/current';
const expectedRelease = '/opt/vitalismen-automacao/releases/20260904T234516Z_production-20260904-ef05d09';
const previousBackup = '/opt/vitalismen-automacao/backups/v129-prepublish-20260904T235735Z';
const backup = process.argv[2];
if (!backup || !/^\/opt\/vitalismen-automacao\/backups\/v129-storage-\d{8}T\d{6}Z$/.test(backup)) throw Error('protected_backup_path_required');
if (fs.realpathSync(root) !== expectedRelease) throw Error('active_release_changed');
if (fs.existsSync(backup)) throw Error('backup_already_exists');
const req = createRequire(root + '/package.json');
const env = req('dotenv').parse(fs.readFileSync(root + '/.env'));
const { MongoClient } = req('mongodb');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const diagnosis = JSON.parse(fs.readFileSync(previousBackup + '/runtime-fingerprint-diagnosis.json'));
const client = await new MongoClient(env.MONGODB_URI).connect();
try {
    const files = [];
    for (const artifact of diagnosis.artifacts) {
        if (!/^public\/media\/(uploads|remote-cache)\/[a-zA-Z0-9_.-]+$/.test(artifact.file)) throw Error('unexpected_artifact');
        const original = path.join(expectedRelease, artifact.file);
        const stat = fs.lstatSync(original);
        if (!stat.isFile() || hash(original) !== artifact.sha256) throw Error('artifact_changed');
        const cache = artifact.file.includes('/remote-cache/');
        const destination = path.join(cache ? '/opt/vitalismen-automacao/shared/runtime/remote-media-cache' : '/opt/vitalismen-automacao/shared/media/uploads', path.basename(original));
        const metadataPath = cache ? original.replace(/\.[^.]+$/, '.json') : null;
        const metadata = metadataPath ? JSON.parse(fs.readFileSync(metadataPath)) : null;
        const publicUrl = artifact.file.replace(/^public/, '');
        const refs = await client.db().collection('messages').find({ $or: [
            { mediaUrl: publicUrl },
            ...(metadata?.url ? [{ mediaUrl: metadata.url }, { 'rawPayload.image.imageUrl': metadata.url }] : [])
        ] }, { projection: { _id: 1, providerMessageId: 1, mediaUrl: 1, timestamp: 1, type: 1, isFromMe: 1, senderRole: 1 } }).toArray();
        files.push({ path: original, relativePath: artifact.file, destination, size: stat.size, sha256: artifact.sha256, owner: `${stat.uid}:${stat.gid}`, mode: (stat.mode & 0o777).toString(8), mtime: stat.mtime.toISOString(), ctime: stat.ctime.toISOString(), publicUrl, cacheMetadataReference: metadataPath, associatedMessages: refs.map(x => ({ id: String(x._id), providerMessageId: x.providerMessageId, timestamp: x.timestamp, type: x.type, isFromMe: x.isFromMe, senderRole: x.senderRole })) });
    }
    fs.mkdirSync(backup, { mode: 0o700 });
    fs.writeFileSync(path.join(backup, 'inventory-before.json'), JSON.stringify({ release: expectedRelease, files }, null, 2), { mode: 0o600, flag: 'wx' });
    for (const file of files) {
        const copy = path.join(backup, 'quarantine', file.relativePath);
        fs.mkdirSync(path.dirname(copy), { recursive: true, mode: 0o700 });
        fs.copyFileSync(file.path, copy, fs.constants.COPYFILE_EXCL);
        fs.chmodSync(copy, 0o600);
        fs.utimesSync(copy, new Date(file.mtime), new Date(file.mtime));
        if (hash(copy) !== file.sha256) throw Error('backup_mismatch');
        fs.mkdirSync(path.dirname(file.destination), { recursive: true, mode: 0o755 });
        if (!fs.existsSync(file.destination)) {
            fs.copyFileSync(file.path, file.destination, fs.constants.COPYFILE_EXCL);
            fs.chmodSync(file.destination, Number.parseInt(file.mode, 8));
            fs.utimesSync(file.destination, new Date(file.mtime), new Date(file.mtime));
        }
        if (hash(file.destination) !== file.sha256 || !fs.readFileSync(file.path).equals(fs.readFileSync(file.destination))) throw Error('persistent_copy_mismatch');
        file.backup = copy;
        file.backupSha256 = hash(copy);
        file.persistentSha256 = hash(file.destination);
        file.byteEqual = true;
    }
    fs.writeFileSync(path.join(backup, 'preservation-result.json'), JSON.stringify({ at: new Date().toISOString(), release: expectedRelease, files, originalsRemoved: 0, mongoWrites: 0, pm2Actions: 0 }, null, 2), { mode: 0o600, flag: 'wx' });
    console.log(JSON.stringify({ backup, preserved: files.length, hashesMatch: files.every(x => x.byteEqual), originalsRemoved: 0, files: files.map(({ associatedMessages, ...file }) => ({ ...file, associatedMessages })) }, null, 2));
} finally {
    await client.close();
}

import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Message from '../src/models/Message.js';

const argValue = (name, fallback = '') => {
    const prefix = `--${name}=`;
    const arg = process.argv.find((item) => item.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : fallback;
};

const apply = process.env.APPLY === 'YES' || process.argv.includes('--apply');
const sinceHours = Math.max(1, Number.parseInt(argValue('sinceHours', process.env.SINCE_HOURS || '96'), 10) || 96);
const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

await connectDB();

const query = {
    isFromMe: true,
    createdAt: { $gte: since },
    $or: [
        { type: { $in: ['audio', 'ptt'] } },
        { body: /^\s*\[AUDIO\]/i },
        { mediaUrl: /\.(ogg|opus|mp3|wav|m4a|aac|webm)(\?|$)/i }
    ],
    $and: [
        {
            $or: [
                { deliveryStatus: { $in: ['failed', 'unconfirmed', 'pending_confirmation'] } },
                { deliveryStatus: { $exists: false } },
                { sendError: { $exists: true, $ne: '' } }
            ]
        }
    ]
};

const matches = await Message.find(query)
    .sort({ createdAt: -1, timestamp: -1 })
    .limit(1000)
    .select({ _id: 1, chatId: 1, peerPhone: 1, body: 1, type: 1, deliveryStatus: 1, sendError: 1, createdAt: 1 })
    .lean();

console.log(JSON.stringify({
    apply,
    sinceHours,
    matched: matches.length,
    sample: matches.slice(0, 20).map((message) => ({
        id: message._id,
        phone: message.peerPhone || message.chatId,
        type: message.type,
        status: message.deliveryStatus || '',
        body: String(message.body || '').slice(0, 80)
    }))
}, null, 2));

if (apply && matches.length) {
    const ids = matches.map((message) => message._id);
    const result = await Message.updateMany(
        { _id: { $in: ids } },
        {
            $set: { deliveryStatus: 'sent' },
            $unset: { sendError: '' }
        }
    );
    console.log(JSON.stringify({
        updated: result.modifiedCount || 0
    }, null, 2));
}

await mongoose.disconnect();

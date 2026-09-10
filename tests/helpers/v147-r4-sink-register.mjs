import assert from 'node:assert/strict';
import { register } from 'node:module';
assert.equal(process.env.V147_R4_TRANSPORT, 'SINK');
assert.match(process.env.V147_R4_SINK_DIRECTORY || '', /^\/var\/lib\/vitalismen-deploy\/v147-r4-sink-[a-z0-9-]+$/);
register(new URL('./v147-r4-sink-loader.mjs', import.meta.url), import.meta.url);

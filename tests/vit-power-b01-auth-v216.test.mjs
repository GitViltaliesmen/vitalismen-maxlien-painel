import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const route = fs.readFileSync(new URL('../src/routes/whatsapp.js', import.meta.url), 'utf8');
const source = route.match(/const b01ActorV216 = req => Boolean\([^\n]+\);/)[0];
const authorize = vm.runInNewContext(source + '\nb01ActorV216');
const valid = { headers: { authorization: 'Bearer signedsession_test' }, user: { _id: 'abcdef0123456789abcdef01', isActive: true, role: 'admin' } };
test('B01 operator boundary accepts authenticated admin and operator identities', () => {
  assert(authorize(valid));
  assert(authorize({ ...valid, user: { ...valid.user, role: 'operator' } }));
});
for (const [name, patch] of Object.entries({
  absentBearer: { headers: {} },
  localNoPassword: { user: { ...valid.user, _id: 'local-no-password' } },
  inactive: { user: { ...valid.user, isActive: false } },
  missingActive: { user: { _id: valid.user._id, role: 'admin' } },
  unknownRole: { user: { ...valid.user, role: 'viewer' } },
  wrongId: { user: { ...valid.user, _id: 'not-an-object-id' } },
  invalidHeader: { headers: { authorization: 'Bearer not a token' } }
})) test('B01 rejects ' + name, () => assert.equal(authorize({ ...valid, ...patch }), false));
test('both B01 endpoints retain real auth middleware and reject local anonymous identity', () => {
  for (const method of ['get', 'post']) {
    assert(route.includes("router." + method + "('/b01-v216', authMiddleware"));
  }
  assert.equal((route.match(/if \(!b01ActorV216\(req\)\)/g) || []).length, 2);
});
test('legacy B01 block is rejected before a manual grant can take the old path', () => {
  const sendRoute = route.slice(route.indexOf("router.post('/send', authMiddleware"));
  assert(sendRoute.indexOf('funnelBlockStep') < sendRoute.indexOf('hasManualHumanRequest'));
});

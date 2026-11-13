import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { SAMPLE } from '../frontend/src/lib/core.js';

const { API_URL, PUBLISHABLE_KEY, SECRET_KEY } = process.env;
assert.ok(API_URL && PUBLISHABLE_KEY && SECRET_KEY, 'Load the local Supabase stack environment.');
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(API_URL).hostname), 'Run against the isolated local stack only.');
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(API_URL, SECRET_KEY, opts);
const result = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};
const users = [];
const fileName = 'integration.png';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1gcAAAAASUVORK5CYII=', 'base64');
async function account() {
  const email = `${crypto.randomUUID()}@example.com`;
  const password = crypto.randomUUID();
  const { user } = result(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  users.push(user.id);
  const client = createClient(API_URL, PUBLISHABLE_KEY, opts);
  result(await client.auth.signInWithPassword({ email, password }));
  return { user, client };
}
const id = () => crypto.randomUUID();
const rpc = (client, name, args = {}) => client.rpc(name, args);
let file;
try {
  const { user, client: a } = await account();
  const { client: b } = await account();
  file = `${user.id}/${fileName}`;
  const anon = createClient(API_URL, PUBLISHABLE_KEY, opts);
  assert.ok((await rpc(anon, 'get_my_state')).error);
  assert.ok((await rpc(anon, 'claim_quest', { p_kind: 'login', p_request_id: id() })).error);
  const card = result(await rpc(a, 'save_measurement', { p_input: SAMPLE, p_request_id: id() }));
  assert.deepEqual(result(await b.from('cards').select('id').eq('id', card.id)), []);
  assert.ok((await b.from('players').update({ tickets: 999 }).eq('user_id', user.id)).error);

  const attempts = await Promise.all([a, a].map(client => rpc(client, 'claim_quest', { p_kind: 'login', p_request_id: id() })));
  assert.equal(attempts.filter(item => !item.error).length, 1);
  result(await rpc(a, 'start_play', { p_kind: 'daily', p_request_id: id() }));
  const before = result(await rpc(a, 'get_my_state'));
  assert.equal(before.player.tickets, 1);
  const attacks = await Promise.all([a, a].map(client => rpc(client, 'attack_boss', { p_request_id: id(), p_expected_version: before.player.version })));
  const accepted = attacks.filter(item => !item.error);
  assert.equal(accepted.length, 1);
  const after = result(await rpc(a, 'get_my_state'));
  assert.equal(after.player.version, before.player.version + 1);
  assert.deepEqual(after.player, accepted[0].data.player);

  result(await a.storage.from('cards').upload(file, png, { contentType: 'image/png' }));
  assert.ok((await b.storage.from('cards').download(file)).error);
  assert.ok((await b.storage.from('cards').createSignedUrl(file, 60)).error);
  assert.ok((await b.storage.from('cards').upload(`${user.id}/forbidden.png`, png, { contentType: 'image/png' })).error);
  const signed = result(await a.storage.from('cards').createSignedUrl(file, 60));
  assert.equal((await fetch(signed.signedUrl)).status, 200);
  for (const kind of ['year', 'month', 'week']) {
    const ranks = result(await rpc(anon, 'get_rankings', { p_kind: kind, p_limit: 100 }));
    assert.ok(ranks.some(row => row.cleared === after.player.cleared));
    assert.ok(ranks.every(row => !('user_id' in row)));
  }
  console.log('PASS real JWT, account isolation, concurrent requests, signed Storage files and public rankings');
} finally {
  if (file) await admin.storage.from('cards').remove([file]);
  for (const user of users) await admin.auth.admin.deleteUser(user);
}

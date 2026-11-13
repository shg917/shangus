// Uses only the public publishable key; never creates test accounts or records.
import assert from 'node:assert/strict';
const {VITE_SUPABASE_URL:supabaseUrl,VITE_SUPABASE_PUBLISHABLE_KEY:supabasePublishableKey}=process.env;
assert.ok(supabaseUrl&&supabasePublishableKey,'Configure a project before running live checks.');
const headers={apikey:supabasePublishableKey,'Content-Type':'application/json'};
async function request(path,body){return fetch(supabaseUrl+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});}
const settings=await request('/auth/v1/settings');assert.equal(settings.status,200);const auth=await settings.json();console.log('Auth settings reachable. Kakao enabled:',auth.external?.kakao===true);
const metrics=await request('/rest/v1/metric_definitions?select=code');assert.equal(metrics.status,200);assert.equal((await metrics.json()).length,8);console.log('PASS public metric reference read');
for(const kind of ['year','month','week']){const r=await request('/rest/v1/rpc/get_rankings',{p_kind:kind,p_limit:100});assert.equal(r.status,200);assert.ok(Array.isArray(await r.json()));console.log('PASS '+kind+' ranking RPC');}
for(const [path,body] of [['/rest/v1/players?select=user_id'],['/rest/v1/cards?select=id'],['/rest/v1/rpc/get_my_state',{}],['/rest/v1/rpc/claim_quest',{p_kind:'login',p_request_id:crypto.randomUUID()}]]){const r=await request(path,body);assert.ok([401,403].includes(r.status),`${path} unexpectedly allowed: ${r.status}`);console.log('PASS anonymous access denied: '+path.split('?')[0]);}
console.log('Live public API smoke checks passed. Authenticated gameplay still requires Kakao setup.');

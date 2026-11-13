import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,SAMPLE,newPlayer,applyStats,hpAt,resolveAttack,rankProgress,compareProgress,periods} from '../frontend/src/lib/core.js';
import {DemoApi} from '../frontend/src/lib/api.js';
import {fixtures} from './fixtures.mjs';
test('128 diverse measurement fixtures keep missing axes distinct and stats bounded',()=>{
 for(const f of fixtures){const r=calculate(f);for(const v of Object.values(r.axes))assert.ok(v===null||(v>=0&&v<=100));assert.ok(r.stats.hits>=1&&r.stats.hits<=999);assert.ok(r.stats.crit>=0&&r.stats.crit<=50);assert.ok(Number.isFinite(r.stats.power));}
});
test('OHP 70 scores above deadlift 70; absent axes stay null',()=>{
 const f=code=>calculate({body_weight:75,reference_sex:'m',entries:[{code,value:70,reps:1}]});assert.ok(f('ohp').axes.strength>f('dead').axes.strength);assert.equal(f('ohp').axes.cardio,null);
});
test('invalid and duplicate entries rejected',()=>{
 for(const entries of [[],[{code:'ohp',value:0}],[{code:'ohp',value:40,reps:1.5}],[{code:'run5k',value:1}],[{code:'ohp',value:70},{code:'ohp',value:80}],[{code:'plank',value:10,reps:2}]])assert.throws(()=>calculate({...SAMPLE,entries}));
});
test('new cardio stats apply immediately without healing or resurrecting',()=>{
 const p={...newPlayer(),hp:100,status:'active'};let next=applyStats(p,{...p.stats,max_hp:1000});assert.equal(next.hp,100);next=applyStats(next,{...p.stats,max_hp:80});assert.equal(next.hp,80);next=applyStats({...next,hp:0,status:'dead'},{...p.stats,max_hp:1000});assert.equal(next.hp,0);assert.equal(next.status,'dead');
});
test('1000 damage crosses 54 early bosses, preserves leftover damage and counters once',()=>{
 const p={...newPlayer(),status:'active',hp:1000,stats:{power:1000,hits:1,crit:0,max_hp:1000}};const r=resolveAttack(p,()=>1);assert.equal(r.player.level,55);assert.equal(r.kills,54);assert.ok(r.player.boss_hp<hpAt(55));assert.equal(r.player.hp,1000-r.counter);
});
test('final boss caps at 9999, no counter or phantom overkill ranking',()=>{
 const p={...newPlayer(),level:9999,cleared:9998,boss_hp:5,hp:1,status:'active',stats:{power:1000,hits:999,crit:50,max_hp:1000}};const r=resolveAttack(p,()=>0);assert.equal(r.player.status,'complete');assert.equal(r.effective,5);assert.equal(r.counter,0);assert.deepEqual(rankProgress(r.player),{cleared:9999,damage:0});assert.throws(()=>resolveAttack(r.player));
});
test('ranking compares cleared level before partial damage; ties are equal',()=>{
 assert.ok(compareProgress({cleared:20,damage:1},{cleared:19,damage:100000})<0);assert.ok(compareProgress({cleared:20,damage:100},{cleared:20,damage:20})<0);assert.equal(compareProgress({cleared:20,damage:100},{cleared:20,damage:100}),0);
});
test('Seoul year, month, Monday weekly boundary',()=>{
 assert.deepEqual(periods(new Date('2026-12-31T14:59:59Z')),{day:'2026-12-31',year:'2026-01-01',month:'2026-12-01',week:'2026-12-28'});
 assert.deepEqual(periods(new Date('2026-12-31T15:00:00Z')),{day:'2027-01-01',year:'2027-01-01',month:'2027-01-01',week:'2026-12-28'});
 assert.equal(periods(new Date('2026-11-15T15:00:00Z')).week,'2026-11-16');
});
test('local adapter: duplicate rewards, replay attacks, revival and reload',async()=>{
 const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},api=new DemoApi(storage);
 await api.saveRecord(SAMPLE,'record');await api.claim('login','claim');await api.claim('login','claim');assert.equal((await api.state()).player.tickets,1);await assert.rejects(api.claim('login','claim-again'));
 await api.start('daily','start');const before=(await api.state()).player;const a=await api.attack('attack',before.version),b=await api.attack('attack',before.version);assert.deepEqual(a,b);
 const s=api.read();s.player.hp=0;s.player.status='dead';s.player.boss_hp=1;api.write(s);await api.start('ticket','revive');const loaded=await new DemoApi(storage).state();assert.equal(loaded.player.boss_hp,1);assert.equal(loaded.player.tickets,0);assert.equal(loaded.player.hp,loaded.player.stats.max_hp);await assert.rejects(api.start('daily','bad-start'));
});

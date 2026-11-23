import test from 'node:test';
import assert from 'node:assert/strict';
import { BOSSES, newClickPlayer, startRun, settleTime, resolveClicks, hpAt } from '../frontend/src/lib/click-combat.js';
import { ClickDemoApi } from '../frontend/src/lib/click-demo.js';

const stats={power:1000,hits:1,crit:0,max_hp:10000};
test('ten bosses have distinct names and sharply increased HP',()=>{
 assert.equal(BOSSES.length,10);assert.equal(new Set(BOSSES.map(b=>b.name)).size,10);
 assert.equal(hpAt(1),100000);assert.equal(hpAt(10),750000000);
 for(let i=1;i<10;i++)assert.ok(hpAt(i+1)>hpAt(i));
});
test('cumulative clicks are exact, repeated and reordered counts cannot double damage',()=>{
 const player=startRun(newClickPlayer(),stats,1000,'run');
 const first=resolveClicks(player,10,'run',1100,()=>1);
 assert.equal(first.effective,10000);
 const repeat=resolveClicks(first.player,10,'run',1200,()=>1);
 assert.equal(repeat.effective,0);assert.equal(repeat.player.boss_hp,90000);
 const older=resolveClicks(repeat.player,2,'run',1250,()=>1);assert.equal(older.effective,0);
 const next=resolveClicks(older.player,15,'run',1300,()=>1);assert.equal(next.effective,5000);
 assert.throws(()=>resolveClicks(next.player,20,'other',1400));
 assert.throws(()=>resolveClicks(next.player,100000,'run',1400));
});
test('boss counterattacks every two seconds even without clicks and offline time catches up',()=>{
 const player=startRun(newClickPlayer(),stats,1000,'run');
 assert.equal(settleTime(player,2999).hp,10000);
 const first=settleTime(player,3000);assert.equal(first.hp,9984);
 assert.equal(settleTime(first,7000).hp,9952);
 assert.equal(resolveClicks(first,1,'run',3001,()=>1).player.hp,9984);
});
test('time expiry commits an end state; revival keeps boss HP and renews 60 seconds',()=>{
 const player=startRun(newClickPlayer(),stats,1000,'run');
 const hit=resolveClicks(player,10,'run',1100,()=>1).player;
 const expired=settleTime(hit,61000);assert.equal(expired.status,'dead');assert.equal(expired.end_reason,'timeout');
 assert.equal(resolveClicks(hit,11,'run',61000,()=>1).effective,0);
 const revived=startRun(expired,stats,70000,'second');
 assert.equal(revived.boss_hp,90000);assert.equal(revived.ends_at,130000);assert.equal(revived.hp,10000);
});
test('player HP death takes effect before late attacks, overkill caps at boss ten',()=>{
 const weak=startRun(newClickPlayer(),{...stats,max_hp:10},1000,'run');
 assert.equal(resolveClicks(weak,1,'run',3000).effective,0);
 const final={...startRun(newClickPlayer(),stats,1000,'run'),level:10,cleared:9,boss_hp:1};
 const result=resolveClicks(final,2,'run',1001,()=>1);
 assert.equal(result.player.status,'complete');assert.equal(result.player.cleared,10);
 assert.equal(result.effective,1);assert.equal(result.player.boss_hp,0);
});
test('demo shares existing daily entitlement and ticket balance, preserves prior tower data',async()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const api=new ClickDemoApi(storage);
 const sample={body_weight:75,reference_sex:'m',entries:[{code:'ohp',value:70,reps:1}]};
 await api.saveRecord(sample,'record');
 const oldTower=structuredClone(api.read().player);
 await api.claim('login','reward');
 await api.start('daily','start');
 const current=(await api.state()).player;
 const hit=await api.clickAttack('attack',current.run_id,10);
 assert.deepEqual(hit,await api.clickAttack('attack',current.run_id,10));
 const saved=api.read();saved.click_player.status='dead';saved.click_player.hp=0;api.write(saved);
 await api.start('ticket','revive');
 const revived=(await api.state()).player;
 assert.equal(revived.boss_hp,hit.player.boss_hp);assert.equal(revived.tickets,0);
 assert.equal(api.read().player.level,oldTower.level);
 const dead=api.read();dead.click_player.status='dead';api.write(dead);
 await assert.rejects(api.start('daily','again'));
 await assert.rejects(api.start('ticket','again-ticket'));
});

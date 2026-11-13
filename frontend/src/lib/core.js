// Provisional game calibration, NOT a population percentile or medical assessment.
// SQL's private.calculate mirrors these rules; parity is tested in tests/database.mjs.
export const VERSION = 'v1';
export const CAP = 9999;
export const METRICS = [
  { code: 'ohp', label: '오버헤드 프레스', unit: 'kg', axis: 'strength', ref: 1.1, max: 250, lift: true },
  { code: 'bench', label: '벤치프레스', unit: 'kg', axis: 'strength', ref: 1.7, max: 500, lift: true },
  { code: 'squat', label: '스쿼트', unit: 'kg', axis: 'strength', ref: 2.5, max: 600, lift: true },
  { code: 'dead', label: '데드리프트', unit: 'kg', axis: 'strength', ref: 2.8, max: 650, lift: true },
  { code: 'pushup', label: '푸시업', unit: '회', axis: 'endurance', ref: 60, max: 500 },
  { code: 'jump', label: '제자리멀리뛰기', unit: 'cm', axis: 'agility', ref: 280, max: 450 },
  { code: 'run5k', label: '5km 달리기', unit: '초', axis: 'cardio', ref: 1080, max: 10800 },
  { code: 'plank', label: '플랭크', unit: '초', axis: 'core', ref: 240, max: 3600 },
];
export const AXES = [['strength','근력'],['endurance','근지구력'],['agility','순발력'],['cardio','심폐'],['core','코어']];
export const CLASSES = { strength: '힘형', agility: '민첩형', stamina: '스태미너형', unclassified: '탐색형' };
export const BOSSES = [
  { from: 1, name: '프로틴 괴물', color: '#e2ae80', slogan: '한 스쿱만 더…' },
  { from: 100, name: '원판 수집가', color: '#9cbb9b', slogan: '그 원판, 내가 쓰던 건데?' },
  { from: 500, name: '랙 점령자', color: '#ce888a', slogan: '마지막 한 세트. 진짜로.' },
  { from: 2000, name: '헬스장 최종 고인물', color: '#b2a2d2', slogan: '여기까지 왔다고?' },
];
export const bossAt = level => BOSSES.findLast(b => level >= b.from);
export const clamp = (n,min,max) => Math.max(min, Math.min(max,n));
export const hpAt = level => Math.round(6 + level * .45 + Math.max(0, level - 55) ** 1.27 * .075 + Math.max(0, level - 450) ** 1.6 * .013);
export const retaliation = level => Math.round(12 + 4 * Math.sqrt(level) + Math.max(0,level-120)*.16);

export function validateRecord(input) {
  const weight = Number(input.body_weight);
  if (!Number.isFinite(weight) || weight < 25 || weight > 300) throw Error('체중은 25~300kg 범위로 입력해 주세요.');
  if (!['m','f'].includes(input.reference_sex)) throw Error('점수 계산 기준을 선택해 주세요.');
  if (!Array.isArray(input.entries) || !input.entries.length || input.entries.length > METRICS.length) throw Error('종목을 한 개 이상 입력해 주세요.');
  const seen = new Set();
  const entries = input.entries.map(e => {
    const metric = METRICS.find(m=>m.code===e.code), value = Number(e.value), reps = e.reps == null ? 1 : Number(e.reps);
    if (!metric || seen.has(e.code)) throw Error('종목이 올바르지 않거나 중복되었습니다.');
    seen.add(e.code);
    if (!Number.isFinite(value) || value <= 0 || value > metric.max || (e.code==='run5k' && value < 600)) throw Error(`${metric.label} 입력 범위를 확인해 주세요.`);
    if (!Number.isInteger(reps) || reps < 1 || reps > 12 || (!metric.lift && reps !== 1)) throw Error('중량 종목 반복 횟수는 1~12회로 입력해 주세요.');
    return { code:e.code, value, reps };
  });
  return { body_weight:weight, reference_sex:input.reference_sex, entries };
}

export function calculate(raw) {
  const input=validateRecord(raw), axes=Object.fromEntries(AXES.map(([key])=>[key,null]));
  for(const e of input.entries) {
    const m=METRICS.find(m=>m.code===e.code);
    let score;
    if(m.lift) {
      const estimated=e.value*(e.reps===1 ? 1 : 1+e.reps/30);
      score=estimated/input.body_weight/(m.ref*(input.reference_sex==='f'?.62:1))*100;
    } else if(e.code==='jump') score=(e.value-150)/130*100;
    else if(e.code==='run5k') score=(2100-e.value)/1020*100;
    else score=e.value/m.ref*100;
    axes[m.axis]=Math.max(axes[m.axis]??0,Math.round(clamp(score,0,100)*10)/10);
  }
  let cls='unclassified', best=-1;
  for(const [key,value] of [['strength',axes.strength],['agility',axes.agility],['stamina',Math.max(axes.endurance??-1,axes.cardio??-1)]]) {
    if(value!=null && value>best) { cls=key; best=value; }
  }
  return { axes, class:cls, version:VERSION, measured:input.entries.length,
    stats: { power:Math.round(15+(axes.strength??0)*6), hits:1+Math.floor(998*((axes.endurance??0)/100)**3), crit:Math.round((axes.agility??0)*.5*10)/10, max_hp:Math.round(180+(axes.cardio??0)*12) } };
}

export const defaultStats=()=>({ power:15,hits:1,crit:0,max_hp:180 });
export const newPlayer=()=>({ level:1,boss_hp:hpAt(1),hp:0,status:'ready',cleared:0,tickets:0,stats:defaultStats(),avatar:'a',version:0 });
export function applyStats(player, stats) {
  return { ...player,stats:{...stats},hp:Math.min(player.hp,stats.max_hp),version:player.version+1 };
}
export function resolveAttack(player, random=Math.random) {
  if(player.status!=='active'||player.hp<=0) throw Error('플레이를 시작하거나 부활해 주세요.');
  const next=structuredClone(player), { power,hits,crit }=player.stats;
  let criticals=0;
  for(let i=0;i<hits;i++) if(random()*100<crit) criticals++;
  const total=(hits-criticals)*power+criticals*Math.round(power*1.5);
  let remaining=total,kills=0;
  while(remaining>=next.boss_hp) {
    remaining-=next.boss_hp; kills++; next.cleared=next.level;
    if(next.level===CAP) { next.boss_hp=0; next.status='complete'; break; }
    next.level++; next.boss_hp=hpAt(next.level);
  }
  if(next.status!=='complete') next.boss_hp-=remaining;
  const counter=next.status==='complete'?0:retaliation(next.level);
  next.hp=Math.max(0,next.hp-counter);
  if(!next.hp && next.status!=='complete') next.status='dead';
  next.version++;
  return { player:next, total, effective:next.status==='complete'?total-remaining:total, criticals,kills,counter };
}
export function rankProgress(player) {
  return { cleared:player.cleared,damage:player.status==='complete'?0:hpAt(player.level)-player.boss_hp };
}
export function compareProgress(a,b) { return b.cleared-a.cleared || b.damage-a.damage; }
export function periods(now=new Date()) {
  const seoul=new Date(now.getTime()+9*3600000), day=seoul.toISOString().slice(0,10);
  const monday=new Date(`${day}T00:00:00Z`); monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
  return { day,year:day.slice(0,4)+'-01-01',month:day.slice(0,7)+'-01',week:monday.toISOString().slice(0,10) };
}
export const SAMPLE = { body_weight:75,reference_sex:'m',entries:[{code:'ohp',value:70,reps:1},{code:'pushup',value:20,reps:1},{code:'jump',value:210,reps:1},{code:'run5k',value:1800,reps:1}] };

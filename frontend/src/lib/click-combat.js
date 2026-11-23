// Timed boss rules. Existing tower state and scoring remain versioned separately.
export const CAP = 10;
export const RUN_MS = 60000;
export const COUNTER_MS = 2000;
// Processing bound against forged batches, independent of the daily play allowance.
export const MAX_CPS = 30;
export const BOSSES = [
  { from: 1, name: '프로틴 괴물', hp: 100000, color: '#e2ae80' },
  { from: 2, name: '덤벨 도둑', hp: 400000, color: '#c2bd77' },
  { from: 3, name: '치팅 밀 포식자', hp: 1200000, color: '#ce888a' },
  { from: 4, name: '원판 수집가', hp: 3000000, color: '#9cbb9b' },
  { from: 5, name: '카페인 폭주자', hp: 8000000, color: '#e5b35f' },
  { from: 6, name: '랙 점령자', hp: 20000000, color: '#ad92c9' },
  { from: 7, name: '벌크업 대장', hp: 50000000, color: '#d29d87' },
  { from: 8, name: '유산소 파괴자', hp: 125000000, color: '#84bcca' },
  { from: 9, name: '무한 세트 장인', hp: 300000000, color: '#b2a2d2' },
  { from: 10, name: '헬스장 최종 고인물', hp: 750000000, color: '#d9c579' },
];
export const bossAt = level => BOSSES[Math.max(0, Math.min(CAP - 1, level - 1))];
export const hpAt = level => bossAt(level).hp;
export const retaliation = level => 12 + level * 4;
export const newClickPlayer = () => ({
  level: 1, cleared: 0, boss_hp: hpAt(1), hp: 0, status: 'ready', version: 0,
  run_id: null, started_at: 0, ends_at: 0, counter_at: 0, click_count: 0, end_reason: null,
});

// Settle elapsed server time before applying an attack or changing stats.
export function settleTime(player, now = Date.now()) {
  const next = { ...player };
  if (next.status !== 'active') return next;
  const until = Math.min(now, next.ends_at);
  const ticks = Math.max(0, Math.floor((until - next.counter_at) / COUNTER_MS));
  if (ticks) {
    next.hp = Math.max(0, next.hp - ticks * retaliation(next.level));
    next.counter_at += ticks * COUNTER_MS;
    next.version++;
  }
  if (!next.hp || now >= next.ends_at) {
    next.status = 'dead';
    next.end_reason = next.hp <= 0 ? 'hp' : 'timeout';
    next.version++;
  }
  return next;
}

export function startRun(player, stats, now = Date.now(), runId = crypto.randomUUID()) {
  const next = settleTime(player, now);
  if (next.status === 'active' || next.status === 'complete') throw Error('이미 도전 중이거나 보스를 모두 처치했습니다.');
  return {
    ...next, hp: stats.max_hp, stats: { ...stats }, status: 'active',
    run_id: runId, started_at: now, ends_at: now + RUN_MS, counter_at: now,
    click_count: 0, end_reason: null, version: next.version + 1,
  };
}

export function resolveClicks(player, totalClicks, runId, now = Date.now(), random = Math.random) {
  const next = settleTime(player, now);
  if (runId !== next.run_id) throw Error('종료되었거나 다른 도전의 요청입니다.');
  if (!Number.isSafeInteger(totalClicks) || totalClicks < 0 || totalClicks > RUN_MS / 1000 * MAX_CPS) throw Error('잘못된 클릭 수입니다.');
  const delta = totalClicks - next.click_count;
  if (delta <= 0 || next.status !== 'active') return { player: next, total: 0, effective: 0, criticals: 0, kills: 0, counter: player.hp - next.hp };
  if (totalClicks > (Math.max(0, now - next.started_at) / 1000 + 1) * MAX_CPS) throw Error('허용 범위를 초과한 클릭 요청입니다.');
  const { power, hits, crit } = next.stats;
  let criticals = 0;
  for (let click = 0; click < delta; click++) {
    for (let hit = 0; hit < hits; hit++) if (random() * 100 < crit) criticals++;
  }
  const total = (delta * hits - criticals) * power + criticals * Math.round(power * 1.5);
  let remaining = total, kills = 0;
  while (remaining >= next.boss_hp) {
    remaining -= next.boss_hp;
    next.cleared = next.level;
    kills++;
    if (next.level === CAP) { next.boss_hp = 0; next.status = 'complete'; next.end_reason = 'complete'; break; }
    next.level++;
    next.boss_hp = hpAt(next.level);
  }
  if (next.status !== 'complete') next.boss_hp -= remaining;
  next.click_count = totalClicks;
  next.version++;
  return {
    player: next, total, effective: next.status === 'complete' ? total - remaining : total,
    criticals, kills, counter: player.hp - Math.min(player.hp, settleTime(player, now).hp),
  };
}

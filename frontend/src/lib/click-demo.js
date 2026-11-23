import { DemoApi } from './api.js';
import { newClickPlayer, settleTime, startRun, resolveClicks, hpAt } from './click-combat.js';
import { periods, compareProgress } from './core.js';

export class ClickDemoApi extends DemoApi {
  async state() {
    const s = this.read();
    const player = settleTime({ ...(s.click_player || newClickPlayer()), stats: s.player.stats }, Date.now());
    player.hp = Math.min(player.hp, s.player.stats.max_hp);
    if (JSON.stringify(player) !== JSON.stringify(s.click_player)) { s.click_player = player; this.write(s); }
    const base = await super.state();
    return {
      ...base, player: { ...player, stats: s.player.stats, tickets: s.player.tickets, avatar: s.profile.avatar },
      achievements: player.cleared ? [{ label: player.cleared === 10 ? '10명 전원 격파' : '첫 보스 격파' }] : [],
      server_now: Date.now(),
    };
  }
  async start(kind, id) {
    return this.mutation(id, s => {
      if (!s.cards.length) throw Error('운동 기록을 먼저 저장해 주세요.');
      const player = startRun({ ...(s.click_player || newClickPlayer()), stats: s.player.stats }, s.player.stats);
      const day = periods().day;
      if (kind === 'daily') {
        if (s.daily.includes(day)) throw Error('오늘 기본 플레이를 이미 사용했습니다.');
        s.daily.push(day);
      } else if (kind === 'ticket') {
        if (!s.player.tickets) throw Error('부활권이 부족합니다.');
        s.player.tickets--;
      } else throw Error('잘못된 플레이 요청입니다.');
      s.click_player = player;
      return player;
    });
  }
  async clickAttack(id, runId, totalClicks) {
    return this.mutation(id, s => {
      const current = { ...(s.click_player || newClickPlayer()), stats: s.player.stats };
      const result = resolveClicks(current, totalClicks, runId);
      s.click_player = result.player;
      if (result.effective > 0) {
        const p = periods(), progress = { cleared: result.player.cleared, damage: result.player.status === 'complete' ? 0 : hpAt(result.player.level) - result.player.boss_hp };
        s.click_ranks ||= [];
        for (const kind of ['year', 'month', 'week']) {
          const row = s.click_ranks.find(row => row.kind === kind && row.start === p[kind]);
          if (!row) s.click_ranks.push({ kind, start: p[kind], ...progress });
          else if (compareProgress(progress, row) < 0) Object.assign(row, progress);
        }
      }
      return result;
    });
  }
  async rankings(kind) {
    const s = this.read(), row = s.click_ranks?.find(row => row.kind === kind && row.start === periods()[kind]);
    return row ? [{ ...row, rank: 1, nickname: s.profile.nickname, avatar: s.profile.avatar, is_me: true }] : [];
  }
}

import { createClient } from '@supabase/supabase-js';
import { calculate,validateRecord,newPlayer,applyStats,resolveAttack,periods,rankProgress,compareProgress } from './core.js';

const KEY='fitcard-app-v1';
const fresh=()=>({ player:newPlayer(),cards:[],daily:[],claims:[],ranks:[],requests:{},profile:{nickname:'나의 FitCard',avatar:'a'} });
const now=()=>new Date().toISOString();
export class DemoApi {
  mode='demo'; user=null;
  constructor(storage=globalThis.localStorage) { this.storage=storage; this.memory=fresh(); }
  read() { try { return JSON.parse(this.storage?.getItem(KEY)||'null')||this.memory; } catch { return this.memory; } }
  write(s) { this.memory=s; try { this.storage?.setItem(KEY,JSON.stringify(s)); } catch { throw Error('브라우저 저장 공간을 사용할 수 없습니다. 저장 설정을 확인해 주세요.'); } }
  async mutation(id,fn) {
    const run=async()=>{ const s=this.read(); if(s.requests[id]) return s.requests[id]; const result=fn(s); s.requests[id]=result; this.write(s); return result; };
    return globalThis.navigator?.locks ? navigator.locks.request(KEY,run) : run();
  }
  async state() { const s=this.read(),p=periods(); return { ...s,card:s.cards.at(-1)||null,daily_available:!s.daily.includes(p.day),claimed:s.claims.filter(x=>x.day===p.day).map(x=>x.kind),has_workout:s.cards.some(c=>periods(new Date(c.created_at)).day===p.day) }; }
  async saveRecord(input,id) { return this.mutation(id,s=>{ const record=validateRecord(input),result=calculate(record); const card={id:crypto.randomUUID(),input:record,result,created_at:now()}; s.cards.push(card); s.player=applyStats(s.player,result.stats); return card; }); }
  async start(kind,id) { return this.mutation(id,s=>{ if(['active','complete'].includes(s.player.status)) throw Error('이미 플레이 중이거나 탑을 완료했습니다.'); if(!s.cards.length) throw Error('운동 기록을 먼저 저장해 주세요.'); const day=periods().day; if(kind==='daily') { if(s.daily.includes(day)) throw Error('오늘 기본 플레이를 이미 사용했습니다.'); s.daily.push(day); } else if(kind==='ticket') { if(!s.player.tickets) throw Error('부활권이 부족합니다.'); s.player.tickets--; } else throw Error('잘못된 플레이 요청입니다.'); s.player.hp=s.player.stats.max_hp; s.player.status='active'; s.player.version++; return s.player; }); }
  async attack(id,expectedVersion) { return this.mutation(id,s=>{ if(s.player.version!==expectedVersion) throw Error('다른 화면에서 상태가 변경되었습니다. 새 상태를 불러왔습니다.'); const result=resolveAttack(s.player); s.player=result.player; const p=periods(),progress=rankProgress(s.player); for(const kind of ['year','month','week']) { const entry=s.ranks.find(r=>r.kind===kind&&r.start===p[kind]); if(!entry) s.ranks.push({kind,start:p[kind],...progress,achieved_at:now()}); else if(compareProgress(progress,entry)<0) Object.assign(entry,progress,{achieved_at:now()}); } return result; }); }
  async claim(kind,id) { return this.mutation(id,s=>{ const day=periods().day; if(!['login','workout'].includes(kind)) throw Error('잘못된 퀘스트입니다.'); if(s.claims.some(c=>c.day===day&&c.kind===kind)) throw Error('이미 받은 보상입니다.'); if(kind==='workout'&&!s.cards.some(c=>periods(new Date(c.created_at)).day===day)) throw Error('오늘 운동 기록을 먼저 저장해 주세요.'); s.claims.push({day,kind}); s.player.tickets++; return {tickets:s.player.tickets}; }); }
  async profile(nickname,avatar) { const s=this.read(); if(!nickname.trim()||nickname.length>20||!['a','b'].includes(avatar)) throw Error('닉네임은 1~20자로 입력해 주세요.'); s.profile={nickname:nickname.trim(),avatar}; s.player.avatar=avatar; this.write(s); }
  async rankings(kind) { const s=this.read(),entry=s.ranks.find(r=>r.kind===kind&&r.start===periods()[kind]); return entry?[{...entry,nickname:s.profile.nickname,avatar:s.profile.avatar,rank:1,is_me:true}]:[]; }
  async uploadCard() { throw Error('카카오 연결 후 공유 이미지를 저장할 수 있습니다. 지금은 이미지 다운로드를 이용해 주세요.'); }
}

export class SupabaseApi {
  mode='live';
  constructor(client,config) { this.client=client; this.config=config; this.user=null; this.kakaoEnabled=null; }
  async init() {
    const {data,error}=await this.client.auth.getSession();if(error)throw error;this.user=data.session?.user||null;
    await this.checkKakao();
  }
  async checkKakao() {
    try { const response=await fetch(`${this.config.supabaseUrl}/auth/v1/settings`,{headers:{apikey:this.config.supabasePublishableKey},signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw Error('Auth settings unavailable');const data=await response.json();this.kakaoEnabled=data.external?.kakao===true;
    }catch{this.kakaoEnabled=null;}
    return this.kakaoEnabled;
  }
  async rpc(name,args={}) { const {data,error}=await this.client.rpc(name,args); if(error) throw Error(error.message); return data; }
  state() { return this.rpc('get_my_state'); }
  saveRecord(input,id) { return this.rpc('save_measurement',{p_input:input,p_request_id:id}); }
  start(kind,id) { return this.rpc('start_play',{p_kind:kind,p_request_id:id}); }
  attack(id,version) { return this.rpc('attack_boss',{p_request_id:id,p_expected_version:version}); }
  claim(kind,id) { return this.rpc('claim_quest',{p_kind:kind,p_request_id:id}); }
  profile(nickname,avatar) { return this.rpc('set_profile',{p_nickname:nickname,p_avatar:avatar}); }
  rankings(kind) { return this.rpc('get_rankings',{p_kind:kind,p_limit:100}); }
  async login() { if(await this.checkKakao()===false)throw Error('카카오 로그인을 준비 중입니다. 잠시 후 다시 이용해 주세요.');const {error}=await this.client.auth.signInWithOAuth({provider:'kakao',options:{redirectTo:this.config.redirectUrl||`${location.origin}/`}}); if(error) throw error; }
  async logout() { const {error}=await this.client.auth.signOut(); if(error) throw error; this.user=null; }
  async uploadCard(blob,cardId) {
    const path=`${this.user.id}/${cardId}/${crypto.randomUUID()}.png`;
    const {error}=await this.client.storage.from('cards').upload(path,blob,{contentType:'image/png',upsert:false}); if(error) throw error;
    // Private bucket: sharing is explicit and expires after one hour.
    const {data,error:signError}=await this.client.storage.from('cards').createSignedUrl(path,3600); if(signError) throw signError;
    return data.signedUrl;
  }
}

export async function createApi(config) {
  if(!config.supabaseUrl&&!config.supabasePublishableKey) return new DemoApi();
  if(!config.supabaseUrl||!config.supabasePublishableKey) throw Error('Supabase URL과 공개 키를 모두 설정해야 합니다.');
  if(!config.supabasePublishableKey.startsWith('sb_publishable_')) throw Error('Supabase 공개 키(sb_publishable_…)가 필요합니다.');
  const api=new SupabaseApi(createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}}),config);
  await api.init(); return api;
}
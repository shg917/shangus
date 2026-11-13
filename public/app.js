import {METRICS,AXES,CLASSES,BOSSES,CAP,SAMPLE,calculate,validateRecord,newPlayer,hpAt,bossAt,periods} from './core.js';
import {createApi} from './api.js';
import {drawArena} from './art.js';

const $=s=>document.querySelector(s), fmt=n=>Number(n).toLocaleString('ko-KR'), escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const write=(key,data)=>{try{localStorage.setItem(key,JSON.stringify(data));}catch{toast('입력 초안을 브라우저에 보관할 수 없습니다.');}};
let api,state,preview=null,busy=false,rankKind='year',rankRequest=0,toastTimer,template='stat';
let draft=read('fitcard-record-draft',{body_weight:75,reference_sex:'m',entries:[]});
let pendingSave=read('fitcard-pending-record',false);
const guest=()=>({player:newPlayer(),profile:{nickname:'나의 FitCard',avatar:'a'},card:null,cards:[],claimed:[],daily_available:true,has_workout:false,achievements:[]});
const route=()=>['record','card','battle','ranking'].includes(location.hash.slice(1))?location.hash.slice(1):'record';
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4500);}
const logged=()=>api.mode==='demo'||!!api.user;
const displayedCard=()=>preview||state.card;
function showLogin(){ $('#login-note').textContent=api.mode==='demo'?'현재는 로컬 체험 모드입니다. Supabase 연결 후 카카오 로그인이 활성화됩니다.':'운동 기록은 자가 입력 자료이며, 로그인 자체가 기록 인증을 의미하지 않습니다.';$('#kakao-login').disabled=api.mode==='demo';$('#login-dialog').showModal(); }
async function refresh(){state=logged()?await api.state():guest();}
async function operation(fn){if(busy)return;busy=true;document.querySelectorAll('main button').forEach(b=>b.disabled=true);try{await fn();}catch(error){toast(error.message||'요청에 실패했습니다.');}finally{try{await refresh();}catch(error){toast(error.message);}busy=false;render();}}
// Persist request IDs across a lost response/reload. Repeating an uncertain mutation
// sends the same UUID and payload; the DB returns the original committed response.
async function mutate(action,payload={}) {
 let pending;try{pending=JSON.parse(sessionStorage.getItem('fitcard-request')||'null');}catch{}
 const scope=api.mode==='demo'?'local-demo':api.user?.id;
 if(pending && pending.scope!==scope){sessionStorage.removeItem('fitcard-request');pending=null;}
 if(pending && (pending.action!==action||JSON.stringify(pending.payload)!==JSON.stringify(payload))) {
   await dispatch(pending);sessionStorage.removeItem('fitcard-request');await refresh();
   throw Error('이전 요청 결과를 복구했습니다. 현재 상태를 확인한 뒤 다시 실행해 주세요.');
 }
 pending ||= {action,payload,id:crypto.randomUUID(),version:state.player.version,scope};
 sessionStorage.setItem('fitcard-request',JSON.stringify(pending));
 try {const result=await dispatch(pending);sessionStorage.removeItem('fitcard-request');return result;}
 catch(error){if(!/fetch|network|timeout|네트워크|연결/i.test(error.message))sessionStorage.removeItem('fitcard-request');throw error;}
}
function dispatch(p){if(p.action==='record')return api.saveRecord(p.payload,p.id);if(p.action==='attack')return api.attack(p.id,p.version);if(p.action==='start')return api.start(p.payload.kind,p.id);return api.claim(p.payload.kind,p.id);}

function intro(kicker,title,description,side=''){return `<div class="intro"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${description}</p></div>${side}</div>`;}
function render(){
 if(!api||!state)return;
 document.querySelectorAll('.navigation a').forEach(a=>{const current=a.hash===`#${route()}`;a.classList.toggle('active',current);if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 $('#mode').innerHTML=api.mode==='demo'?'<strong>로컬 체험</strong> · 이 브라우저에 저장됩니다. 실제 회원·전체 랭킹은 Supabase 연결 후 활성화됩니다.':api.user?'<strong>계정에 연결됨</strong> · 전투 결과와 보상은 서버에서 확정됩니다.':'카드는 로그인 없이 만들 수 있어요. 진행도 저장과 보스 도전은 카카오로 시작하세요.';
 $('#account').innerHTML=api.user?`<span>${escape(state.profile.nickname)}</span><button id="logout" class="secondary">로그아웃</button>`:'<button id="login-open" class="kakao">카카오로 시작</button>';
 $('#login-open')?.addEventListener('click',showLogin);
 $('#logout')?.addEventListener('click',()=>operation(async()=>{await api.logout();preview=null;toast('로그아웃했습니다.');}));
 if(route()==='record')renderRecord();if(route()==='card')renderCard();if(route()==='battle')renderBattle();if(route()==='ranking')renderRanking();
}
function renderRecord(){
 $('#app').innerHTML=intro('01 / YOUR STARTING POINT','오늘의 기록,<br>내일의 전투력.','자신 있는 종목 하나부터. 3대 운동도, 모든 항목도 필수가 아니에요.','<span class="pill">선택 입력 · 8개 종목</span>')+
 `<div class="grid"><form id="record-form" class="panel"><div class="section-head"><h2>나의 운동 기록</h2><button type="button" id="sample" class="text-button">예시 불러오기 ↗</button></div>
 <div class="body-fields"><label>체중 (kg)<input name="body_weight" type="number" min="25" max="300" step="0.1" required value="${escape(draft.body_weight)}"></label><label>점수 계산 기준<select name="reference_sex"><option value="m" ${draft.reference_sex==='m'?'selected':''}>남성 기준</option><option value="f" ${draft.reference_sex==='f'?'selected':''}>여성 기준</option></select></label></div>
 <div class="metric-grid">${METRICS.map(m=>{const e=draft.entries.find(e=>e.code===m.code);return `<div class="metric"><label for="metric-${m.code}">${m.label}</label><div class="entry"><input id="metric-${m.code}" name="${m.code}" type="number" min="${m.code==='run5k'?600:m.lift?.5:1}" max="${m.max}" step="${m.lift?'.5':'1'}" placeholder="선택" value="${e?.value??''}"><span class="unit">${m.unit}</span>${m.lift?`<input class="reps" name="${m.code}-reps" type="number" min="1" max="12" step="1" value="${e?.reps??1}" aria-label="${m.label} 반복 횟수"><span class="unit">회</span>`:''}</div><small>${m.lift?'1회는 실제 1RM · 2~12회는 추정 1RM':m.code==='run5k'?'예: 30분 = 1,800초':m.code==='plank'?'코어는 카드에 표시 · 전투 능력치에는 미반영':'미입력은 미측정으로 표시'}</small></div>`;}).join('')}</div>
 <div class="form-bottom"><p class="muted">입력 기록은 자가 입력입니다. 환산값은 통계적 백분위가 아닌 게임 점수예요.</p><button class="primary" type="submit">${state.card?'기록 갱신 · 즉시 반영':'내 카드 만들기'} →</button></div></form>
 <aside class="stack"><section class="panel"><p class="eyebrow">RECORD → CARD → BATTLE</p><h2>기록으로 시작하는<br>나의 성장 루프.</h2><ol class="steps"><li><div><strong>나를 표현하는 카드</strong>종목별 기준으로 계산한 5축 프로필</div></li><li><div><strong>기록이 전투 능력치로</strong>공격력 · 타격 수 · 치명타 · HP</div></li><li><div><strong>9,999층까지 도전</strong>초과 피해는 다음 보스까지 이어져요</div></li></ol></section><section class="panel"><h3>더 강해졌다면, 바로 반영.</h3><p class="muted">새 기록을 저장하면 진행 중인 전투에도 적용됩니다. 최대 HP가 늘어도 현재 HP는 자동 회복되지 않아요.</p><div class="callout">OHP 70kg과 데드리프트 70kg은 서로 다른 기준으로 평가합니다. 같은 축의 여러 종목은 최고 환산값을 사용합니다.</div></section></aside></div>`;
 $('#sample').onclick=()=>{draft=structuredClone(SAMPLE);write('fitcard-record-draft',draft);renderRecord();};
 const form=$('#record-form');
 const collect=()=>{const f=new FormData(form);return {body_weight:Number(f.get('body_weight')),reference_sex:f.get('reference_sex'),entries:METRICS.filter(m=>f.get(m.code)!=='').map(m=>({code:m.code,value:Number(f.get(m.code)),reps:m.lift?Number(f.get(m.code+'-reps')):1}))};};
 form.addEventListener('input',()=>{draft=collect();write('fitcard-record-draft',draft);});
 form.onsubmit=event=>{event.preventDefault();operation(async()=>{draft=validateRecord(collect());write('fitcard-record-draft',draft);if(logged()){preview=await mutate('record',draft);pendingSave=false;toast('카드와 전투 능력치를 갱신했습니다.');}else{preview={input:draft,result:calculate(draft),created_at:new Date().toISOString()};pendingSave=true;}write('fitcard-pending-record',pendingSave);location.hash='card';});};
}

function radar(axes){const pt=(i,r)=>[150+Math.sin(i*Math.PI*2/5)*r,128-Math.cos(i*Math.PI*2/5)*r];const rings=[.33,.66,1].map(r=>`<polygon points="${AXES.map((_,i)=>pt(i,83*r).join(',')).join(' ')}" fill="none" stroke="#455334"/>`).join('');const markers=AXES.map(([key,label],i)=>{const [x,y]=pt(i,axes[key]==null?0:83*axes[key]/100),[lx,ly]=pt(i,108);return `${axes[key]!=null?`<line x1="150" y1="128" x2="${x}" y2="${y}" stroke="#d4fc52" stroke-width="3"/><circle cx="${x}" cy="${y}" r="4" fill="#d4fc52"/>`:''}<text x="${lx}" y="${ly}" text-anchor="middle" font-size="11" fill="${axes[key]==null?'#81916e':'#d7e4c0'}">${label}<tspan x="${lx}" dy="15">${axes[key]??'미측정'}</tspan></text>`;}).join('');const filled=AXES.every(([key])=>axes[key]!=null)?`<polygon points="${AXES.map(([key],i)=>pt(i,83*axes[key]/100).join(',')).join(' ')}" fill="#d4fc5222" stroke="#d4fc52"/>`:'';return `<svg class="radar" viewBox="0 0 300 255" role="img" aria-label="${AXES.map(([k,l])=>l+' '+(axes[k]??'미측정')).join(', ')}">${rings}${filled}${markers}</svg>`;}
function statsHtml(s){return `<div class="stats"><div class="stat"><b>${fmt(s.power)}</b><span>근력 → 기본 공격력</span></div><div class="stat"><b>${fmt(s.hits)}<small> 타</small></b><span>근지구력 → 타격 수</span></div><div class="stat"><b>${s.crit}%</b><span>순발력 → 치명타</span></div><div class="stat"><b>${fmt(s.max_hp)}</b><span>심폐 → 최대 HP</span></div></div>`;}
const templateNames={stat:'스탯 카드',receipt:'운동 영수증',status:'상태창',report:'성적표',license:'운동 면허증',news:'헬스장 속보'};
function renderCard(){
 const card=displayedCard();
 if(!card){$('#app').innerHTML=intro('02 / YOUR FITCARD','아직 펼치지 않은 가능성.','종목 하나만 입력해도 나만의 카드를 만들 수 있어요.')+'<div class="panel empty"><h2>첫 운동 기록을 남겨보세요.</h2><a href="#record"><button class="primary">기록 입력하기 →</button></a></div>';return;}
 const {result,input}=card;
 $('#app').innerHTML=intro('02 / YOUR FITCARD','기록은 나를 닮는다.','나의 클래스는 기록으로, 아바타의 모습은 내 취향으로.')+
 `<div class="grid"><div class="card-stage"><article class="fitness-card"><div class="section-head"><b class="brand">FITCARD.</b><span class="pill">자가 입력</span></div><div class="card-type">${templateNames[template]} / ${result.version.toUpperCase()}</div><div class="class-name">${CLASSES[result.class]}</div><p class="muted">${escape(state.profile.nickname)} · ${input.body_weight}kg</p>${template==='stat'?radar(result.axes):`<div class="record-list">${AXES.map(([key,label])=>`<div>${label}<b>${result.axes[key]??'미측정'}</b></div>`).join('')}</div><div class="callout">${template==='news'?'헬스장에 새로운 강자가 나타났다.':template==='license'?'꾸준함이 증명하는 나의 운동 자격.':template==='receipt'?'오늘의 노력, 기록으로 남겼습니다.':template==='report'?'어제의 나와 비교하는 성장 성적표.':'새로운 능력치를 획득했습니다.'}</div>`}<div class="record-list">${input.entries.slice(0,4).map(e=>{const m=METRICS.find(m=>m.code===e.code);return `<div>${m.label}<b>${e.value}${m.unit}${m.lift?' × '+e.reps:''}</b></div>`;}).join('')}</div><div class="card-foot"><span>${new Date(card.created_at).toLocaleDateString('ko-KR')}</span><span>게임 점수 · ${input.entries.length}개 기록</span></div></article></div>
 <aside class="stack"><section class="panel"><div class="section-head"><h2>카드 스타일</h2><span class="pill">6 TYPES</span></div><select id="template" aria-label="카드 스타일">${Object.entries(templateNames).map(([k,n])=>`<option value="${k}" ${k===template?'selected':''}>${n}</option>`).join('')}</select><div class="buttons"><button id="download-card" class="secondary">이미지 저장 ↓</button><button id="share-card" class="secondary">공유 링크 ↗</button></div></section><section class="panel"><h2>나의 전투 능력치</h2>${statsHtml(result.stats)}<p class="muted">미측정 축은 게임 기본값으로 시작합니다. 실제 측정 점수로 표시하지 않습니다.</p><div class="buttons"><button class="primary" id="go-battle">${pendingSave?(api.user?'계정에 저장하고 도전':'로그인 후 업적 받기'):'보스 도전하기 →'}</button></div></section><section class="panel"><h3>아바타 & 닉네임</h3><div class="avatar-options">${['a','b'].map((a,i)=>`<button data-avatar="${a}" aria-pressed="${state.profile.avatar===a}">${i?'◈':'◆'}<small>${i?'바이올렛':'라임'} 트레이너</small></button>`).join('')}</div><label class="muted" for="nickname">랭킹에 표시할 닉네임</label><input id="nickname" maxlength="20" value="${escape(state.profile.nickname)}"><button id="save-profile" class="secondary wide" style="margin-top:10px">프로필 저장</button></section></aside></div>`;
 $('#template').onchange=e=>{template=e.target.value;renderCard();};
 $('#download-card').onclick=()=>operation(async()=>{const blob=await cardBlob(card),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`fitcard-${template}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('카드를 이미지로 저장했습니다.');});
 $('#share-card').onclick=()=>operation(async()=>{if(!logged()){showLogin();return;}if(!card.id){toast('카드를 계정에 먼저 저장해 주세요.');return;}const url=await api.uploadCard(await cardBlob(card),card.id);try{await navigator.clipboard.writeText(url);toast('1시간 동안 유효한 공유 링크를 복사했습니다.');}catch{window.prompt('1시간 동안 유효한 공유 링크',url);}});
 $('#go-battle').onclick=()=>operation(async()=>{if(!logged()){showLogin();return;}if(pendingSave){preview=await mutate('record',draft);pendingSave=false;write('fitcard-pending-record',false);}location.hash='battle';});
 let avatar=state.profile.avatar;
 document.querySelectorAll('[data-avatar]').forEach(b=>b.onclick=()=>{avatar=b.dataset.avatar;document.querySelectorAll('[data-avatar]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
 $('#save-profile').onclick=()=>operation(async()=>{if(!logged()){showLogin();return;}await api.profile($('#nickname').value,avatar);toast('프로필을 저장했습니다.');});
}

function renderBattle(){
 const p=state.player,boss=bossAt(p.level),canPlay=logged()&&!!state.card,active=p.status==='active',complete=p.status==='complete';
 $('#app').innerHTML=intro('03 / THE BOSS TOWER','어디까지 강해질 수 있을까.','초과 피해는 다음 보스까지. 쓰러져도 깎아둔 보스 HP는 그대로.','<span class="pill">LV. 1 — 9,999</span>')+
 `<div class="grid battle-grid"><section class="panel arena-panel"><div class="boss-heading"><div><div class="level">LV. ${fmt(p.level)}</div><h2>${complete?'보스 탑 정복':boss.name}</h2></div><div class="muted">처치 완료<br><strong>${fmt(p.cleared)} 레벨</strong></div></div><div class="health-wrap"><div class="health" role="progressbar" aria-label="보스 HP" aria-valuemin="0" aria-valuemax="${hpAt(p.level)}" aria-valuenow="${p.boss_hp}"><i style="width:${p.boss_hp/hpAt(p.level)*100}%"></i></div><div class="hp-label"><span>BOSS HP</span><span>${fmt(p.boss_hp)} / ${fmt(hpAt(p.level))}</span></div></div><div class="arena"><canvas id="arena-canvas" role="img" aria-label="헬스장에서 프로틴 괴물과 맞서는 나의 아바타"></canvas></div><div class="battle-bottom"><div class="health player" role="progressbar" aria-label="나의 HP" aria-valuemin="0" aria-valuemax="${p.stats.max_hp}" aria-valuenow="${p.hp}"><i style="width:${p.hp/p.stats.max_hp*100}%"></i></div><div class="hp-label"><span>MY HP</span><span>${fmt(p.hp)} / ${fmt(p.stats.max_hp)}</span></div><p class="battle-message" id="battle-message" aria-live="polite">${complete?'9,999레벨의 모든 보스를 쓰러뜨렸습니다.':p.status==='dead'?'잠시 숨 고르기. 보스에게 남긴 피해는 사라지지 않아요.':active?'내가 선공합니다. 공격이 끝나면 살아남은 보스가 한 번 반격합니다.':'오늘의 도전을 시작하세요. 공격 횟수의 일일 제한은 없습니다.'}</p><button id="attack" class="primary battle-button" ${complete?'disabled':''}>${!canPlay?(logged()?'기록 입력하고 시작':'카카오로 시작하기'):active?'공격하기  /  '+fmt(p.stats.hits)+' HIT':state.daily_available?'오늘 기본 플레이로 시작':p.tickets>0?'부활권 1장으로 이어하기':'부활권이 필요해요'}</button><div class="hp-label"><span>오늘 기본 플레이 ${state.daily_available?'1':'0'} / 1</span><span>부활권 ${p.tickets}장</span></div></div></section>
 <aside class="stack"><section class="panel"><div class="section-head"><h2>${CLASSES[state.card?.result.class||'unclassified']} 트레이너</h2><a class="text-button" href="#record">기록 갱신 ↗</a></div>${statsHtml(p.stats)}<p class="muted">기록 저장 즉시 능력치에 반영됩니다.</p></section><section class="panel"><h2>오늘의 퀘스트</h2>${[['login',api.mode==='demo'?'체험 출석':'오늘 로그인'],['workout','운동 기록 남기기']].map(([kind,label])=>`<div class="quest"><div><strong>${label}</strong><small>부활권 1장${kind==='workout'?' · 자가 기록':''}</small></div><button data-claim="${kind}" ${state.claimed.includes(kind)||!logged()||(kind==='workout'&&!state.has_workout)?'disabled':''}>${state.claimed.includes(kind)?'받음':'받기'}</button></div>`).join('')}</section><section class="panel"><h3>다음 상대</h3><div class="road">${BOSSES.map(b=>`<div class="${b.from===boss.from?'current':''}"><span>${b.name}</span><span>Lv.${fmt(b.from)}</span></div>`).join('')}</div></section><section class="panel"><h3>획득한 업적</h3>${(state.achievements?.length?state.achievements:api.mode==='demo'?[{level:1,label:'첫 보스 격파'},{level:100,label:'백 층 돌파'},{level:1000,label:'천 층의 주인'},{level:9999,label:'9,999층 정복'}].filter(a=>a.level<=p.cleared):[]).map(a=>`<div class="achievement">✦ ${escape(a.label)}</div>`).join('')||'<p class="muted">첫 보스를 쓰러뜨리면 업적이 열려요.</p>'}</section></aside></div>`;
 requestAnimationFrame(()=>{const c=$('#arena-canvas');if(c)drawArena(c,p.level,state.profile.avatar);});
 $('#attack').onclick=()=>{if(!logged()){showLogin();return;}if(!state.card){location.hash='record';return;}operation(async()=>{if(active){const result=await mutate('attack');await animateAttack(result);toast(`${fmt(result.kills)}레벨 돌파! 현재 Lv.${fmt(result.player.level)} · ${result.player.hp?'도전 계속':'보스 HP는 유지됩니다'}`);}else{await mutate('start',{kind:state.daily_available?'daily':'ticket'});toast('플레이를 시작했습니다.');}});};
 document.querySelectorAll('[data-claim]').forEach(b=>b.onclick=()=>operation(async()=>{await mutate('claim',{kind:b.dataset.claim});toast('부활권 1장을 받았습니다.');}));
}

async function animateAttack(result){
 const arena=$('.arena'),message=$('#battle-message');if(!arena||!message)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 arena.classList.add('hit');arena.insertAdjacentHTML('beforeend',`<div class="impact-ring"></div><div class="hit-slash"></div><div class="hit-slash reverse"></div><div class="damage-float"><small>${result.criticals?'CRITICAL × '+result.criticals:'POWER HIT'}</small>${fmt(result.total)}</div>${result.kills?`<div class="overkill">OVERKILL +${fmt(result.kills)} LV</div>`:''}`);
 message.textContent=`${fmt(result.total)} 피해 · ${result.kills}레벨 돌파 · 보스 반격 ${result.counter} 피해`;
 await new Promise(r=>setTimeout(r,reduced?400:850));
 if(result.counter)arena.insertAdjacentHTML('beforeend',`<div class="counter-note">−${fmt(result.counter)} HP</div>`);
 await new Promise(r=>setTimeout(r,reduced?400:550));
}

async function renderRanking(){
 const token=++rankRequest,p=periods();
 $('#app').innerHTML=intro('04 / THE LEADERBOARD','끝까지 올라간 사람들.','처치한 보스 레벨이 먼저. 같다면 다음 보스에게 남긴 피해로 순위를 정해요.')+
 `<div class="rank-tabs" role="tablist" aria-label="랭킹 기간">${[['year','누적 · 연간'],['month','월간'],['week','주간']].map(([k,n])=>`<button role="tab" aria-selected="${rankKind===k}" data-rank="${k}">${n}</button>`).join('')}</div><section class="panel"><div class="section-head"><h2>${{year:'올해',month:'이번 달',week:'이번 주'}[rankKind]}의 베스트</h2><small>${p[rankKind]}부터 · 한국 시간</small></div><div id="ranking-content" role="tabpanel"><p class="loading">순위를 불러오는 중…</p></div></section><div class="callout">매년 1월 1일 · 매월 1일 · 매주 월요일 00:00에 새 집계가 시작됩니다. 보스 진행도는 유지되고, 해당 기간에 실제로 공격한 기록만 참여합니다. 같은 레벨과 피해는 공동 순위입니다.${api.mode==='demo'?' 현재는 내 체험 기록만 표시합니다.':''}</div>`;
 document.querySelectorAll('[data-rank]').forEach(b=>b.onclick=()=>{rankKind=b.dataset.rank;renderRanking();});
 try{const rows=await api.rankings(rankKind);if(token!==rankRequest||route()!=='ranking')return;
 $('#ranking-content').innerHTML=rows.length?`<div style="overflow-x:auto"><table class="rank-table"><thead><tr><th scope="col">순위</th><th scope="col">트레이너</th><th scope="col">처치 완료</th><th scope="col">다음 보스 피해</th></tr></thead><tbody>${rows.map(r=>`<tr class="${r.is_me?'me':''}"><td>${r.rank}</td><td>${escape(r.nickname)} ${r.is_me?'<span class="pill">나</span>':''}<small>자가 입력 기록</small></td><td>Lv. ${fmt(r.cleared)}</td><td>${fmt(r.damage)} HP${r.cleared<CAP?`<small>Lv.${fmt(r.cleared+1)} · ${(r.damage/hpAt(r.cleared+1)*100).toFixed(1)}%</small><div class="mini-progress"><i style="width:${r.damage/hpAt(r.cleared+1)*100}%"></i></div>`:'<small>탑 정복</small>'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><h2>아직 이번 기간의 기록이 없어요.</h2><p>보스에게 첫 공격을 남기고 순위에 참여하세요.</p><a href="#battle"><button class="primary">보스 도전하기 →</button></a></div>';
 }catch(error){if(token===rankRequest&&route()==='ranking')$('#ranking-content').innerHTML=`<p class="error">${escape(error.message)}</p><button id="retry-ranking">다시 불러오기</button>`;$('#retry-ranking')?.addEventListener('click',renderRanking);}
}

async function cardBlob(card){
 const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1080;const c=canvas.getContext('2d');
 c.fillStyle='#182011';c.fillRect(0,0,720,1080);c.strokeStyle='#6d8344';c.lineWidth=2;c.strokeRect(24,24,672,1032);
 const text=(s,x,y,size,color='#f0f5e6',weight=700)=>{c.fillStyle=color;c.font=`${weight} ${size}px 'Malgun Gothic',sans-serif`;c.fillText(s,x,y);};
 text('FITCARD.',60,100,40,'#d4fc52',900);text(templateNames[template],60,155,18,'#aabc94');text(CLASSES[card.result.class],60,240,64);text(state.profile.nickname,60,285,22,'#b8c9a0');
 let y=365;for(const [key,label] of AXES){text(label,60,y,22);text(card.result.axes[key]==null?'미측정':String(card.result.axes[key]),540,y,26,'#d4fc52');c.fillStyle='#354327';c.fillRect(60,y+17,595,7);if(card.result.axes[key]!=null){c.fillStyle='#d4fc52';c.fillRect(60,y+17,595*card.result.axes[key]/100,7);}y+=90;}
 text(`${card.input.body_weight}kg · ${card.input.entries.length}개 종목`,60,875,24);text('자가 입력 · 게임 점수 v1',60,925,20,'#aabc94');text(new Date(card.created_at).toLocaleDateString('ko-KR'),60,995,18,'#aabc94');
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('이미지 생성에 실패했습니다.')),'image/png'));
}

$('#kakao-login').onclick=async()=>{try{$('#kakao-login').disabled=true;await api.login();}catch(error){toast(error.message);$('#kakao-login').disabled=false;}};
window.addEventListener('hashchange',()=>{if(!busy)render();});
window.addEventListener('resize',()=>{const c=$('#arena-canvas');if(c&&state)drawArena(c,state.player.level,state.profile.avatar);});
window.addEventListener('storage',event=>{if(event.key==='fitcard-app-v1'&&!busy)refresh().then(render).catch(e=>toast(e.message));});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&api&&!busy)refresh().then(render).catch(e=>toast(e.message));});
setInterval(()=>{if(api&&state&&!busy&&document.visibilityState==='visible'&&['ranking','battle'].includes(route()))refresh().then(render).catch(()=>{});},60000);
async function boot(){
 $('#app').innerHTML='<p class="loading">나의 운동 여정을 준비하는 중…</p>';
 try{api=await createApi();await refresh();if(pendingSave){try{preview={input:draft,result:calculate(draft),created_at:new Date().toISOString()};}catch{pendingSave=false;}}
 if(api.client)api.client.auth.onAuthStateChange((event,session)=>{api.user=session?.user||null;if(event!=='INITIAL_SESSION')setTimeout(()=>{if(!busy)refresh().then(render).catch(e=>toast(e.message));},0);});
 render();}catch(error){$('#app').innerHTML=`<section class="panel"><h1>연결을 확인해 주세요.</h1><p class="error">${escape(error.message)}</p><p class="muted">설정 오류를 체험 모드로 숨기지 않습니다. config.js와 Supabase 설정을 확인하세요.</p><button id="reload">다시 시도</button></section>`;$('#reload').onclick=()=>location.reload();}
}
boot();

# Shangus / FitCard 웹

기록 → 카드 → 보스 탑 → 연간/월간/주간 랭킹을 연결한 정적 웹입니다. 공식 소스 저장소는 https://github.com/shg917/shangus 입니다. 이후 개발은 이 저장소의 체크아웃에서 진행합니다.

## 바로 실행

Node.js 20 이상에서:

```sh
node scripts/serve.mjs
```

기본 주소는 http://127.0.0.1:4173 입니다. 개발 서버는 로컬 컴퓨터에서만 접근할 수 있습니다. HTML을 파일 탐색기에서 직접 여는 방식은 JS 모듈·인증 콜백 때문에 지원하지 않습니다.

`public/config.js`가 비어 있으면 **로컬 체험 모드**입니다. 실제 로그인·서버 저장·전체 사용자 랭킹으로 오인하지 않도록 화면에 표시합니다. 데이터는 브라우저에 저장되며, 설정을 채우면 같은 화면이 Supabase RPC를 사용합니다. 설정이 잘못되면 오류를 표시하며 체험 모드로 자동 전환하지 않습니다.

## 확정한 서비스 규칙

- 기록은 전 종목 선택 입력. 최소 한 종목은 필요합니다.
- 근력=공격력, 근지구력=턴당 1~999타, 순발력=치명타 확률, 심폐=최대 HP. 코어는 카드에만 표시합니다.
- 카드 계산으로 클래스가 정해지고 외형은 별도 선택합니다. 외형은 점수에 영향을 주지 않습니다.
- 새 기록 저장 즉시 능력치 적용. 최대 HP 증가 시 현재 HP는 유지하고, 감소 시 새 상한까지만 줄입니다. 기록 갱신으로 회복·부활되지 않습니다.
- 매일 기본 플레이 1회. 진행 중 공격의 일일 한도는 없습니다. 사망 후 기본 플레이 또는 부활권 1장을 소비해 이어갑니다.
- 부활 시 사용자 HP만 회복됩니다. **보스 레벨과 남은 HP는 유지**합니다.
- 로그인/오늘 기록 퀘스트는 각 하루 1장 지급. 서버 날짜는 Asia/Seoul입니다.
- 보스는 Lv.1~9,999. 초과 피해가 다음 보스에게 이어지고, 최종 보스 처치 후 남은 피해는 집계하지 않습니다.
- 랭킹: **처치 완료 레벨 내림차순 → 다음 보스에 준 피해 내림차순**. 동일 진행도는 공동 순위이며 동점자의 표시 순서만 달성 시각으로 정합니다.
- 누적(연간)은 1월 1일, 월간은 매월 1일, 주간은 월요일 00:00 한국 시간에 새 집계가 시작됩니다. 개인 보스 진행도는 초기화하지 않습니다. 기간 내 실제 공격해야 해당 기간 랭킹에 등록됩니다. 이전 기간의 결과는 DB에 보존합니다.
- 새 기간에 높은 층에서 시작한 기존 사용자는 그대로 높은 진행도로 참여합니다. 같은 출발점에서 겨루는 시즌제 탑은 이번 범위가 아닙니다.
- 9,999 보스 완료는 현재 버전의 종료 상태입니다. 다음 시즌의 추가 탑/재시작 규칙은 아직 구현하지 않았습니다.

## 판정 기준: 검증 전 게임 밸런스 v1

기존 데모의 임시 기준을 명시적 규칙으로 분리했습니다. **공식 체력 백분위나 신체 능력 인증 수치가 아닙니다.** 종목별 체중 대비 기준은 OHP 1.1, 벤치 1.7, 스쿼트 2.5, 데드 2.8이며 여성 기준 계수는 기존 시안의 0.62입니다. 이 계수의 타당성은 별도로 검증해야 합니다.

중량 1회는 실제 1RM 입력으로 취급하고 2~12회는 `중량 × (1 + 횟수/30)`의 추정값을 사용합니다. 같은 축에 여러 종목이 들어오면 **최고 환산 점수**를 사용합니다. 다른 종목을 추가한 횟수 자체로 공격력이 누적되지는 않습니다. 미측정 축은 `null`로 보관하고 카드에서 미측정으로 표시하며, 전투에는 최소 기본 능력치가 있습니다.

기준 변경은 서버 SQL과 `public/core.js`를 함께 변경하고 새 rules_version 및 데이터 변경 SQL을 추가해야 합니다. 현재 v1 스냅샷을 수정해 이미 발급된 카드·랭킹의 의미를 바꾸지 마세요. 128개 fixture는 계산 일치·범위 검증용이며, 실제 이용자 밸런스 적정성을 보장하는 데이터가 아닙니다.

## Supabase 설정 순서

1. 새 Supabase 프로젝트를 생성합니다. 기존 운영 DB에 초기 SQL을 실행하지 마세요.
2. SQL Editor에서 `supabase/001_initial.sql` 전체를 실행합니다. 테이블, 기준값, 권한, RPC 함수가 한 트랜잭션으로 생성됩니다.
3. `supabase/002_storage.sql`을 실행합니다. `cards`, `avatars` 비공개 버킷과 사용자 폴더 정책을 설정합니다.
4. Authentication → Providers에서 Kakao를 설정합니다. Kakao Developers 앱의 REST API 키와 로그인 Client Secret을 Supabase에 입력합니다.
5. Kakao Developers Redirect URI에 Supabase 대시보드가 표시하는 콜백 URL을 등록합니다. 일반적으로 `https://프로젝트ID.supabase.co/auth/v1/callback`입니다.
6. Supabase Auth의 Site URL 및 Redirect URLs에 실제 웹 주소를 등록합니다. 개발용 `http://127.0.0.1:4173/` 또는 현재 서버 포트도 별도로 등록합니다. 배포 미리보기 URL을 무분별한 와일드카드로 허용하지 않습니다.
7. 카카오에서 이메일 동의를 받지 않는 설정이면 Supabase Kakao 설정의 이메일 없는 사용자 허용 여부도 확인합니다. 회원 연결 기준은 이메일이 아닌 Supabase Auth 사용자 UUID입니다.
8. `public/config.js`에 Supabase 프로젝트 URL, **publishable key 또는 legacy anon key**, 실제 웹 redirect URL을 입력합니다. `secret`, `service_role`, DB 비밀번호, 카카오 Client Secret은 절대 웹 코드에 넣지 않습니다.
9. 로컬/배포 주소에서 카카오 로그인 → 게스트 카드 저장 → 전투 → 새로고침 → 로그아웃/재로그인을 검증합니다.

공식 문서: https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao

**SQL이 실행됐다고 OAuth 설정이나 Storage 서비스 통합이 검증된 것은 아닙니다.** 실제 프로젝트 생성·키 제공·카카오 앱 등록은 아직 하지 않았습니다. 네이버 로그인은 포함하지 않습니다.

초기 마이그레이션은 한 번 실행하도록 작성했습니다. 실패한 트랜잭션은 원인을 수정한 뒤 전체를 다시 실행하고, 성공한 마이그레이션은 재실행하지 않습니다. 이후 변경은 `003_...sql`처럼 새 파일로 추가합니다. 초기 SQL을 DROP/재생성해 운영 데이터를 지우지 않습니다.

## 데이터와 서버 처리

| 묶음 | 테이블 |
| --- | --- |
| 회원 | `profiles`, Supabase 관리 `auth.users` |
| 기록 원본 | `measurements`, `measurement_entries`, `metric_definitions` |
| 계산 스냅샷 | `cards` (입력, 축별 점수, 클래스, 능력치, 버전) |
| 현재 전투 | `players` |
| 요청 중복 방지 | `private.requests` |
| 플레이·보상 | `private.daily_plays`, `private.quest_claims`, `private.item_ledger` |
| 전투 근거 | `private.battle_events` (타격마다 한 행이 아닌 공격 요청당 한 행) |
| 기간별 랭킹 | `private.rankings` |
| 업적 | `achievement_definitions`, `achievements` |

공식 판정은 PostgreSQL 함수에서 실행합니다. 이번 범위에는 외부 API를 처리하는 Edge Function이 없어 **별도 Edge Function 배포가 필요하지 않습니다**. 로그인은 Supabase Auth가, 전투·보상은 SQL RPC가 담당합니다. 장래 외부 연동을 추가할 때 Edge Function을 별도로 배포할 수 있습니다.

| RPC | 입력 | 결과/역할 |
| --- | --- | --- |
| `get_my_state` | 없음 | 본인 프로필/카드/현재 전투/오늘 보상 |
| `save_measurement` | `p_input`, `p_request_id` | 서버 재계산, 원본·카드 저장, 능력치 즉시 적용 |
| `start_play` | `p_kind`=`daily`/`ticket`, `p_request_id` | 기본 플레이 또는 티켓 차감 후 사용자 HP 회복 |
| `attack_boss` | `p_request_id`, `p_expected_version` | 치명타/이월/반격/상태/랭킹/업적 원자적 확정 |
| `claim_quest` | `p_kind`=`login`/`workout`, `p_request_id` | 일일 중복 지급 방지 |
| `set_profile` | `p_nickname`, `p_avatar` | 공개 닉네임·외형 저장 |
| `get_rankings` | `p_kind`=`year`/`month`/`week`, `p_limit` | 상위 100명, 공동 순위, 사용자 ID 비공개 |

예시 기록 입력:

```json
{
  "body_weight": 75,
  "reference_sex": "m",
  "entries": [
    {"code":"ohp","value":70,"reps":1},
    {"code":"pushup","value":20,"reps":1},
    {"code":"run5k","value":1800,"reps":1}
  ]
}
```

게임 데이터 직접 쓰기 권한은 브라우저에 주지 않았습니다. RPC는 `auth.uid()`를 확인하고 사용자 전투 행을 잠근 뒤 처리합니다. 요청 UUID로 중복 실행을 막고 버전으로 오래된 화면에서의 공격을 거절합니다. 공격 요청 간 750ms 제한은 자동 연타 보호이며 일일 공격 횟수 제한은 아닙니다. 서버 난수를 사용해 치명타를 결정합니다.

공개 랭킹에는 닉네임/아바타/진행도만 제공하며 원본 운동·체중·Auth ID는 공개하지 않습니다. 파일 버킷은 비공개이고 공유 이미지는 1시간 유효한 signed URL을 명시적으로 발급합니다. 다운로드는 브라우저에서 처리합니다. Storage 정책은 로그인한 본인 UUID 폴더만 허용합니다.

## Cloudflare Pages 배포

이 폴더를 Git 저장소에 보관하고 Pages에 연결합니다. 브라우저 SDK는 공식 배포본을 `public/vendor`에 고정해 저장했으므로 첫 배포에서 패키지를 설치할 필요가 없습니다.

- 빌드 명령: `node scripts/build.mjs`
- 빌드 출력: `dist`
- 프로젝트 루트: 저장소 루트 (하위 디렉터리를 지정하지 않음)
- Node.js: 20 이상
- 도메인 연결 후 Supabase Auth Site URL/Redirect URLs, `public/config.js`도 같은 주소로 맞춥니다.

배포 결과물에 SQL·테스트·node_modules가 포함되지 않도록 `public`만 복사합니다. `public/_headers`에 CSP 등 응답 헤더를 포함했습니다. Supabase custom domain을 사용하면 CSP의 connect-src/img-src 허용 목록도 변경해야 합니다.

## 개발 및 검증

의존성을 새로 설치하려면 pnpm으로 `pnpm install --frozen-lockfile`을 실행합니다. SDK를 갱신하면 버전을 고정하고 `node scripts/vendor.mjs`로 번들을 갱신합니다. 라이선스는 `public/vendor/SUPABASE-LICENSE`에 보관했습니다.

```sh
node --test tests/core.test.mjs
node tests/database.mjs
node scripts/build.mjs
```

브라우저 검증: 실행 중인 개발 서버에 대해 `node tests/browser.mjs`. `PREVIEW_URL`, `PLAYWRIGHT_PATH`, `BROWSER_PATH`로 환경 경로를 지정할 수 있습니다. 기본 경로는 이번 Windows 개발 환경 기준입니다. 캡처는 `.qa/`에 저장합니다.

DB 검증은 PGlite의 PostgreSQL 엔진에 SQL을 실제 실행합니다. Auth/Storage의 기본 스키마와 사용자 역할은 테스트에서 모사하므로 **호스팅된 Supabase 서비스 전체의 통합 테스트를 대체하지 않습니다**. 테스트는 운영 DB에 접속하지 않고 폐기 가능한 메모리 DB에서 실행합니다.

## 출시 전에 남은 작업

- 실제 Supabase 프로젝트에서 SQL 적용 및 Kakao OAuth·세션 갱신·Storage 업로드 통합 확인.
- 실제 사용자 테스트로 가중치/치명타/타격수 곡선 검증. 현재 공식은 초기 실험값입니다.
- 서비스 약관·개인정보 처리 고지, 계정 탈퇴 및 업로드 파일 삭제 흐름, 운영 백업/복구 절차.
- 요청/전투 이력의 보관 기간, 대량 요청 방어 및 사용량 모니터링 설정. 현재 기록을 자동 삭제하지 않습니다.
- 공유 링크는 1시간 임시 파일 링크입니다. 영구 공개 카드 페이지·SNS 미리보기 메타데이터는 별도 구현 대상입니다.
- 크루·커뮤니티·운동 인증 심사·네이버 로그인은 이번 구현에 포함하지 않습니다.

이 버전은 **로컬 동작 및 서버 연결 준비를 마친 개발본**입니다. 실제 계정·도메인 연결 전에는 출시 완료 상태가 아닙니다.

# Shangus / FitCard

운동 기록, 카드, 보스 전투, 연간·월간·주간 랭킹을 연결합니다.
React·TypeScript·Vite 프론트는 `frontend/`, Supabase 백엔드는 `supabase/`에 있습니다.
개별 작업은 feat/* 또는 fix/* 브랜치에서 진행하고 첫 출시까지 V.1.0.0에 모읍니다.

## 로컬에서 실행

Node.js 24와 pnpm 11.25.0을 설치한 뒤 실행합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev --port 4175 --strictPort
```

Windows에서는 Start-FitCard.cmd도 같은 서버를 실행합니다. http://127.0.0.1:4175 에서 엽니다.
환경 변수 없이 실행하면 브라우저에만 저장하는 체험 모드입니다.
실제 프로젝트에 연결하려면 .env.example을 .env.local로 복사하고 URL과 sb_publishable_ 공개 키를 설정합니다.
VITE_ 변수는 빌드 결과에 포함됩니다. 서비스 비밀키와 카카오 Client Secret은 여기에 입력하지 않습니다.
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

기준 변경은 서버 SQL과 `frontend/src/lib/core.js`를 함께 변경하고 새 rules_version 및 데이터 변경 SQL을 추가해야 합니다. 현재 v1 스냅샷을 수정해 이미 발급된 카드·랭킹의 의미를 바꾸지 마세요. 128개 fixture는 계산 일치·범위 검증용이며, 실제 이용자 밸런스 적정성을 보장하는 데이터가 아닙니다.

## Supabase와 카카오

기존 Supabase 프로젝트에는 supabase/migrations의 세 파일이 표시된 버전으로 이미 적용됐습니다.
새 프로젝트는 파일을 날짜순으로 적용합니다. SQL Editor에서도 각 파일을 실행할 수 있지만, CLI 마이그레이션 이력을 따로 관리해야 하므로 일반 배포에는 Supabase CLI를 사용합니다.
변경된 SQL은 새 파일로 추가합니다. 기존 프로젝트에서 초기 파일을 다시 실행하지 않습니다.
격리된 로컬 백엔드는 Docker와 고정된 Supabase CLI 3.1.0으로 supabase start를 실행합니다. 회원 가입은 로컬 설정에서 비활성화하며 HTTP 통합 테스트는 관리자 API로 테스트 계정을 만듭니다.

1. Kakao Developers에 앱을 등록하고 카카오 로그인을 활성화합니다.
2. Kakao Developers의 Redirect URI에 Supabase 대시보드가 안내하는 /auth/v1/callback 주소를 등록합니다.
3. Supabase Authentication의 Kakao 공급자 설정에 REST API 키와 Client Secret을 입력합니다.
4. Supabase Auth URL 설정에 개발 주소 http://127.0.0.1:4175/ 및 실제 미리보기·운영 주소를 등록합니다.
5. 카드 미리보기 → 카카오 로그인 → 계정 저장 → 전투 → 로그아웃을 검증합니다.

[Supabase 카카오 공식 문서](https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao)
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

## Cloudflare Pages

Git 연결 대상은 shg917/shangus입니다. 프로젝트 루트는 저장소 루트, 빌드 명령은 pnpm run build, 출력 디렉터리는 dist입니다. Node 버전은 24를 지정합니다.
Preview와 Production에 각각 해당 환경의 공개 Supabase 설정을 입력합니다.
프론트가 사용할 DB 변경이 끝난 뒤 운영 빌드를 배포합니다. 공개 주소에서 OAuth 왕복, CSP, 모바일 화면을 확인합니다.
DB와 프론트에 대한 자동 운영 배포는 서로 독립적으로 활성화하지 않습니다.

## 검사

GitHub Actions는 코드·빌드, DB·권한, 브라우저의 세 검사로 구성됩니다.
로컬 명령과 현재 검사 범위는 VALIDATION.md를 참조하세요.
# 검증 범위

- `pnpm test`: 기록 128개, 미측정 축, OHP와 데드리프트 비교, 전투·부활·랭킹 규칙.
- `pnpm run test:db`: PGlite에서 마이그레이션 3개를 적용하고 SQL·프론트 계산 일치, 역할별 데이터 접근, 요청 재시도를 검사합니다.
- `pnpm run test:browser`: 환경 변수를 비운 데모 서버에서 카드 생성·PNG 다운로드·전투·부활·랭킹·모바일 레이아웃을 검사합니다.
- `pnpm run test:live`: 연결한 Supabase의 카카오 공급자 플래그, 공개 지표·랭킹, 비로그인 접근 차단을 검사합니다. 회원이나 기록을 만들지 않습니다.
- `tests/supabase-integration.mjs`: 격리된 Supabase에서 두 계정을 만들고 실제 JWT·REST·RPC·Storage, 공격과 보상 동시 요청을 검사합니다. GitHub CI의 DB 단계에서 실행됩니다.

카카오 왕복 로그인과 Cloudflare 배포 주소에서의 검증은 각각 서비스 설정 후 진행합니다. 기존 운영 데이터가 들어 있는 DB의 업그레이드는 적용할 새 마이그레이션마다 이전 버전 데이터로 검증합니다.

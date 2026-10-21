# CryptoPulse — Vercel 배포

## 기존 배포에서 Unavailable이 나온 원인

최초 버전은 Vite 프런트엔드와 **Cloudflare Workers API**로 구성되어 있었습니다. Vercel에는 정적 화면만 배포되었고, 실제 배포의 `/api/markets`가 HTTP 404를 반환했습니다. CoinGecko 키를 추가하는 것만으로는 이 경로가 생성되지 않습니다.

이번 수정으로 `api/markets.ts`, `api/global.ts`, `api/chart.ts`, `api/news.ts`에 Vercel Functions 진입점을 추가했습니다. `vercel.json`은 API 경로를 덮어쓰지 않고 `/markets`, `/news`, `/watchlist`의 직접 방문과 새로고침을 지원합니다. React + Vite 구조를 유지합니다.

## 먼저 데모 데이터로 배포 확인

1. 수정된 파일을 GitHub에 커밋하고 push합니다.
2. Vercel 프로젝트 `cryptopulse`에서 해당 커밋의 배포가 Ready인지 확인합니다.
3. `/api/markets`에 방문하면 JSON 응답과 `"mode":"demo"`가 나와야 합니다. HTML이나 404가 나오면 변경된 API 파일이 포함되지 않은 배포입니다.
4. Overview의 지표, 차트와 Markets 목록을 확인합니다.

키나 공유 저장소가 없으면 **Demo data**를 반환합니다. 실제 시장 데이터라고 표시하지 않습니다.

## 실제 CoinGecko 데이터 연결

여러 방문자가 한 API 키의 무료 호출량을 공유하므로, Vercel에서 실제 데이터를 쓰려면 **공유 Redis 저장소**가 필요합니다. 서버리스 프로세스의 메모리나 브라우저 저장소만으로는 전체 호출량을 제한할 수 없습니다.

1. CoinGecko에서 **Demo API 키**를 발급받습니다.
2. Upstash에서 **Free Redis 데이터베이스**를 하나 준비합니다. Vercel Marketplace를 통해 연결하거나 Upstash 콘솔에서 직접 만들 수 있습니다. 반드시 Free 요금제를 선택하고 유료 전환/자동 업그레이드를 활성화하지 마세요. 이 수정 과정에서는 계정이나 저장소를 생성하지 않았습니다.
3. Redis 상세 화면에서 REST URL과 쓰기 가능한 REST Token을 확인합니다. 읽기 전용 토큰으로는 호출량 예약이 불가능합니다.
4. Vercel → `cryptopulse` → **Settings → Environment Variables**에 아래 값을 저장합니다. API 키와 Redis 토큰은 Secret으로 저장하고 `Production` 환경을 선택합니다.

| 이름                       | 값                                  |
| -------------------------- | ----------------------------------- |
| `DATA_MODE`                | `live`                              |
| `COINGECKO_DEMO_API_KEY`   | 새로 발급한 CoinGecko Demo 키       |
| `UPSTASH_REDIS_REST_URL`   | `https://…upstash.io` 형식 REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | 해당 DB의 쓰기 가능한 REST 토큰     |
| `CG_MONTHLY_BUDGET`        | `7500` — 생략 가능                  |
| `CG_MINUTE_BUDGET`         | `25` — 생략 가능                    |

5. 환경변수 저장 후 **Redeploy**합니다. 이미 만들어진 배포에 새 환경변수가 자동 반영되지는 않습니다.
6. `/api/markets`의 `mode`가 `cached`이고 화면에 **Cached data**가 나타나면 집계 데이터가 연결된 것입니다. 이는 거래소 실시간 스트리밍이 아니라 캐시된 CoinGecko USD 집계 데이터입니다.

로컬 `.dev.vars`는 GitHub에 올라가지 않으며 Vercel에서도 읽지 않습니다. `VITE_` 접두사가 붙은 변수에 비밀 키를 넣지 마세요. Cloudflare의 `MARKET_GATEWAY` 바인딩은 Vercel에서 사용하지 않습니다.

**키 교체:** 이전 `.env.example`에 실제 API 키가 들어간 커밋이 확인되어 로컬 예제에서 값을 제거했습니다. 파일에서 삭제해도 과거 Git 커밋에는 남으므로 기존 키를 CoinGecko에서 폐기하고 새 키를 사용해야 합니다. Git 기록은 임의로 재작성하지 않았습니다. 키/토큰을 채팅에 붙여넣을 필요는 없습니다.

## 서버의 공유 캐시·호출량 보호

- Upstash REST API의 Lua `EVAL`이 Redis primary에서 원자적으로 캐시 확인, 잠금 확인, 호출량 검사와 예약을 처리합니다.
- Redis 서버 시간을 사용해 **직전 31일 7,500회 / 직전 1분 25회**를 제한합니다. 설정값으로 이보다 낮출 수 있으며 높일 수는 없습니다.
- 일반 시장/글로벌 갱신은 월 예산의 80%에서 멈추어 나머지를 차트에 남겨둡니다. 실패한 요청도 예약에 포함되고 upstream 자동 재시도는 없습니다.
- 30초 분산 잠금이 같은 자원의 동시 갱신을 합칩니다. 잠금 토큰이 일치하는 소유자만 새 캐시를 저장할 수 있습니다. 잠금이 있는 cold miss는 최대 1.2초 동안 저장소만 확인하며 CoinGecko 요청을 반복하지 않습니다.
- 시장 목록 15분, 글로벌 60분, 1/7/30일 차트 30분, 90/365일 차트 6시간의 TTL을 사용합니다. 공유 캐시는 최대 102개 자원입니다.
- 오류와 `Retry-After`는 전체 gateway의 갱신을 잠시 중단합니다. 기존 캐시는 `stale`, 캐시도 없으면 HTTP 503을 반환합니다. Redis 실패 시 호출량 제한 없는 provider 요청으로 우회하지 않습니다.
- 모든 요청은 허용된 API 경로와 현재 tracked 20개 자산, 1/7/30/90/365일 범위에 한정됩니다. 임의 proxy URL을 받지 않습니다.
- Cloudflare와 Vercel의 ledger는 서로 다른 저장소입니다. 같은 CoinGecko 키를 두 backend에서 동시에 사용하지 마세요. Vercel의 여러 인스턴스는 같은 Redis DB와 고정 namespace를 사용해야 합니다.

2026-10-21 확인 기준 [Upstash Free 요금제](https://upstash.com/pricing/redis)는 250MB, 월 500K commands, 월 10GB bandwidth를 표시합니다. 내부 Lua 명령도 저장소 사용량에 영향을 줄 수 있으며, 별도의 provider 무료 한도도 확인해야 합니다. 유료 요금제나 자동 업그레이드는 이 프로젝트가 활성화하지 않습니다.

## 확인 및 제한

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

추가 테스트는 실제 production Lua를 로컬 Lua VM에서 실행해 원자적 예약, 동시 갱신 합치기, Redis 서버 시간, quota reserve, 31일/1분 window, `Retry-After`, 만료된 잠금 소유자 거부, 캐시 크기 제한을 확인합니다. Lua VM의 Redis 명령 adapter는 테스트용이며, 원격 Upstash 서비스 자체를 실행한 테스트는 아닙니다.

테스트 전용 Lua VM 의존성(`fengari` → `sprintf-js`)에는 현재 upstream 수정 버전이 없는 moderate npm advisory가 있습니다. 테스트는 저장소에 작성된 고정 Lua만 실행하며 이 패키지는 운영 API/브라우저에서 import되지 않습니다. `npm audit` 결과를 무시하거나 통과했다고 표시하지 않았습니다.

Vercel의 원래 `/api/markets` 404는 배포 URL에서 직접 확인했습니다. 이번 수정은 로컬에서 준비한 것이며 GitHub push/재배포는 별도 단계입니다. Vercel 환경변수 목록은 연결 도구가 403으로 거부했고 사용 가능한 로컬 Vercel CLI가 없어 확인하지 못했습니다. 실제 키/Upstash 연결 확인은 환경변수를 등록한 새 배포에서 진행해야 합니다.

News는 계속 Demo editorial입니다. CoinGecko 키가 뉴스나 거래소 WebSocket 스트리밍까지 활성화하지는 않습니다.

공식 참고: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js), [Upstash REST API](https://upstash.com/docs/redis/features/restapi).

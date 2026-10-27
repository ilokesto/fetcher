# @ilokesto/fetcher

ky의 사용감을 유지하면서 OpenAPI 기반 요청 타입과 JSON 응답 추론을 더하는 얇은 래퍼입니다.

[![npm](https://img.shields.io/npm/v/@ilokesto/fetcher?style=flat&color=555&labelColor=555)](https://www.npmjs.com/package/@ilokesto/fetcher)
[![License](https://img.shields.io/npm/l/@ilokesto/fetcher?style=flat&color=555&labelColor=555)](./LICENSE)

[문서](https://ilokesto.ayden94.com/ko/fetcher) | [API](./docs/reference/create-fetcher.ko.mdx) | [English](./README.md)

- ky의 훅, 재시도, `create()`, `extend()`, 지연 응답 파싱을 그대로 사용합니다.
- OpenAPI로 경로 템플릿, 그룹 매개변수, JSON·폼 본문에 타입을 적용합니다.
- 예외를 던지는 요청과 파싱된 데이터를 반환하는 `safe` 결과 중에서 선택합니다.

## 설치

Node.js 24.22.1+와 peer dependency인 `ky ^1.14.0`이 필요합니다.

```bash
pnpm add @ilokesto/fetcher ky@^1.14.0
```

## 빠른 시작

스키마를 직접 정의한 예제입니다. `prefixUrl`을 실제 API 주소로 바꾸세요.

```ts
import { createFetcher } from '@ilokesto/fetcher/openapi';

type User = { id: string; name: string };

type Paths = {
  '/users/{id}': {
    get: {
      parameters: {
        path: { id: string };
        query?: { include?: 'profile' };
      };
      responses: {
        200: { content: { 'application/json': User } };
      };
    };
  };
};

const api = createFetcher<Paths>({
  prefixUrl: 'https://api.example.com',
});

const user = await api
  .get('/users/{id}', {
    params: {
      path: { id: '42' },
      query: { include: 'profile' },
    },
  })
  .json();

console.log(user.name);
```

응답 제네릭 없이 `.json()`이 `User`를 추론합니다. 큰 API에는 [생성된 OpenAPI 타입](./docs/guides/generated-openapi.ko.mdx)을 사용하세요. 상태 코드 선택 기준은 [응답 추론](./docs/advanced/response-inference.ko.mdx)에서 설명합니다.

기본 클라이언트는 HTTP 실패 시 예외를 던집니다. `params.cookie`는 타입 전용이며 쿠키나 인증을 자동 관리하지 않습니다. 타입이 적용된 `head`는 지연 응답을 유지하고 `safe.head`는 제공하지 않습니다. OPTIONS는 `api.options()` 대신 클라이언트를 직접 호출합니다.

## 더 알아보기

- [그룹 요청과 매개변수 처리](./docs/reference/request-grouped-request.ko.mdx)
- [JSON·폼 본문과 우선순위](./docs/reference/request-bodies.ko.mdx)
- [오류 처리와 safe 결과](./docs/reference/safe.ko.mdx)
- [prefixUrl과 선행 슬래시 동작](./docs/advanced/prefix-url.ko.mdx)
- [ky와 프로토타입 요청 형태에서 마이그레이션](./docs/advanced/migration.ko.mdx)

<details>
<summary>개발</summary>

저장소 루트에서 Node 24.22.1과 pnpm 10.17.1을 사용합니다. 다른 패키지의 체크아웃은 필요하지 않습니다.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test:types
pnpm test
pnpm test:dist
pnpm test:tooling
pnpm docs:publication:verify
pnpm docs:typecheck
pnpm docs:build
pnpm docs:test
```

`test:types`는 요청을 실행하지 않고 타입 계약 사례를 컴파일하며, `test`는 런타임 테스트를 실행합니다. `test:dist`는 `build` 이후에 실행하며 엔트리포인트의 구현 동일성과 패키지 소비자의 HEAD/OPTIONS 계약을 검증합니다. 문서 브라우저는 `pnpm --dir website exec playwright install chromium`으로 한 번 설치하고, `pnpm docs:start --hostname 127.0.0.1 --port 0`으로 미리 봅니다.

한영 원본 문서는 `docs/`, 렌더러는 `website/`에 있습니다. 공개 예제는 `docs-publication/active.json`의 정확한 npm 버전을, `/en/fetcher/next`와 `/ko/fetcher/next`는 현재 체크아웃을 사용합니다. schema 1/2 아카이브는 변경하지 않으며, 새 캡처는 명시적인 schema 3 독립 저장소 레이아웃과 검토된 릴리스 카탈로그 항목이 필요합니다.

`pnpm release:verify --sha <전체-SHA>`는 배포 없이 실제 GitHub Verify 결과, 패키지 아티팩트, main과 레지스트리 상태를 확인합니다. 원격 저장소 준비와 정확한 SHA의 CI 검증이 선행되어야 합니다. PR은 Verify CI를 실행합니다. main 병합은 Changesets 릴리스 PR을 생성·갱신하며,
릴리스 PR을 병합하면 GitHub Actions가 성공한 Verify의 정확한 아티팩트만 게시합니다.
적용 전에 `Allow GitHub Actions to create and approve pull requests`를 켜고
`Production` 환경에 `NPM_TOKEN`을 설정하세요. 로컬 게시나 문서 배포는 하지 않습니다.

</details>

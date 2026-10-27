# @ilokesto/fetcher

ky의 사용감을 유지하면서 OpenAPI 기반 요청 타입과 JSON 응답 추론을 더하는 얇은 래퍼입니다.

[![npm](https://img.shields.io/npm/v/@ilokesto/fetcher?style=flat&color=555&labelColor=555)](https://www.npmjs.com/package/@ilokesto/fetcher)
[![License](https://img.shields.io/npm/l/@ilokesto/fetcher?style=flat&color=555&labelColor=555)](./LICENSE)

[English](./README.md)

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

응답 제네릭 없이 `.json()`이 `User`를 추론합니다. 큰 API에는 생성된 OpenAPI 타입을 사용하세요.

기본 클라이언트는 HTTP 실패 시 예외를 던집니다. `params.cookie`는 타입 전용이며 쿠키나 인증을 자동 관리하지 않습니다. 타입이 적용된 `head`는 지연 응답을 유지하고 `safe.head`는 제공하지 않습니다. OPTIONS는 `api.options()` 대신 클라이언트를 직접 호출합니다.

<details>
<summary>개발</summary>

저장소 루트에서 Node 24.22.1과 pnpm 10.17.1을 사용합니다. 다른 패키지의 체크아웃은 필요하지 않습니다.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

`pnpm test`는 한 번 빌드한 뒤 단위·타입·도구·패키지 소비자 검증을 모두 실행합니다. 테스트는 `tests/unit`, `tests/types`, `tests/tooling`, `tests/fixtures`에 모여 있습니다. 개별 실행은 `test:unit`, `test:types`, `test:tooling`, `test:pack`을 사용하며, `test:pack`만 실행할 때는 먼저 빌드합니다.

`pnpm release:verify --sha <전체-SHA>`는 배포 없이 실제 GitHub Verify 결과, 패키지 아티팩트, main과 레지스트리 상태를 확인합니다. 원격 저장소 준비와 정확한 SHA의 CI 검증이 선행되어야 합니다. PR은 Verify CI를 실행합니다. main 병합은 Changesets 릴리스 PR을 생성·갱신하며,
릴리스 PR을 병합하면 GitHub Actions가 성공한 Verify의 정확한 아티팩트만 게시합니다.
적용 전에 `Allow GitHub Actions to create and approve pull requests`를 켜고
`Production` 환경에 `NPM_TOKEN`을 설정하세요. 로컬에서는 게시하지 않습니다.

</details>

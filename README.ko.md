# fetcher

`fetcher`는 실제 [`ky`](https://github.com/sindresorhus/ky) 런타임 위에 얇게 얹힌 OpenAPI-aware wrapper입니다.

이 패키지는 `create()`, `extend()`, hooks, `prefixUrl`, custom `fetch`, lazy `ResponsePromise` parsing처럼 사람들이 이미 좋아하는 `ky`의 사용감을 유지하면서, route template, grouped shortcut request, `.json()` 결과 추론에 OpenAPI 기반 타입을 더합니다.

## 상태

- 패키지 이름: `fetcher`
- 런타임 코어: `ky`
- 빌드 산출물: 컴파일된 `dist/` 패키지
- 공개 엔트리포인트: `.`, `./core`, `./openapi`
- v1 런타임 방향: `ky` fork가 아니라 `ky` wrapper

이 패키지는 이제 source-export-only 프로토타입이 아니라, 일반적인 dist 기반 라이브러리로 배포되는 형태를 기준으로 문서화됩니다.

## 왜 존재하나

타입이 강한 API wrapper는 OpenAPI를 다루는 대신 `ky`의 장점을 잃는 경우가 많습니다. JSON을 너무 일찍 파싱하거나, 요청 옵션을 별도 클라이언트 모양으로 숨기거나, `ky` 대신 다른 런타임 모델을 들고 오는 식입니다.

`fetcher`는 더 작은 방향을 택합니다.

1. 실제 `KyInstance`를 유지한다
2. route 준비를 위한 아주 얇은 런타임 계층만 추가한다
3. 가능한 많은 일을 타입 시스템에서 해결한다
4. 기본 surface에서는 일반 `ky` `ResponsePromise`를 그대로 돌려준다

## 설치

`fetcher`와 `ky`를 함께 설치합니다.

```bash
pnpm add fetcher ky
```

`ky`는 peer dependency입니다.

## 빠른 시작

```ts
import { createTypedKy, type MergePaths } from 'fetcher/openapi';
import type { paths as GeneratedPaths } from './__generated__/openapi';

type ExtraPaths = {
  '/api/bff/serialize-mdx': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            title: string;
            mdx: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              serializedMdx: string;
            };
          };
        };
      };
    };
  };
};

type ApiPaths = MergePaths<GeneratedPaths, ExtraPaths>;

const api = createTypedKy<ApiPaths>({
  prefixUrl: '/api',
  hooks: {
    beforeRequest: [
      (_request, options) => {
        options.context.openapi?.pathTemplate;
        options.context.openapi?.method;
      },
    ],
  },
});

const user = await api
  .get('/users/{id}', {
    params: {
      path: { id: '42' },
      query: { include: 'profile' },
    },
  })
  .json();

const mdx = await api
  .post('/api/bff/serialize-mdx', {
    json: { title: 'A', mdx: '# hello' },
  })
  .json();

const authed = api.extend({
  headers: {
    Authorization: 'Bearer ...',
  },
});
```

## 현재 배포된 요청 계약

타입이 붙는 shortcut method는 grouped request object를 사용합니다.

```ts
api.post('/uploads/{id}', {
  params: {
    path: { id: 'upload-1' },
    query: { draft: true },
    cookie: { session: 'type-only' },
  },
  headers: {
    'x-upload-token': 'token',
  },
  formData: {
    file,
    tags: ['a', 'b'],
  },
});
```

### Shortcut shape

- `params.path`, route template 값
- `params.query`, query parameter
- `params.cookie`, cookie parameter 타입 표현용, 런타임에서는 type-only
- top-level `headers`, typed header parameter
- top-level `json`, JSON request body
- top-level `formData`, multipart 또는 form 계열 body
- 세 번째 인자, 일반 `ky` options

### Direct callable shape

호출 가능한 client surface는 기존 `ky` 옵션 스타일을 유지하고, 그 위에 OpenAPI-aware typing만 덧씌웁니다.

```ts
await api('/users/{id}', {
  method: 'GET',
  path: { id: '42' },
  searchParams: { include: 'profile' },
}).json();
```

이 분리는 v1에서 의도된 설계입니다. shortcut method는 grouped OSS request contract를 따르고, callable surface는 plain `ky`에 더 가깝게 남겨둡니다.

## `safe` surface

기본 surface는 `ky`처럼 동작합니다. `ResponsePromise`를 반환하고, HTTP failure에서는 여전히 throw합니다.

throw하지 않는 분기가 필요하면 `safe`를 사용합니다.

```ts
const result = await api.safe.get('/users/{id}', {
  params: {
    path: { id: '42' },
  },
});

if (result.ok) {
  result.data;
  result.response;
} else {
  result.error;
  result.response;
}
```

실용적인 결과 shape는 다음과 같습니다.

```ts
type SafeResult<Data, Error = unknown> =
  | {
      ok: true;
      data: Data;
      error: null;
      response: Response;
    }
  | {
      ok: false;
      data: null;
      error: Error;
      response: Response | null;
    };
```

메모:

- 성공하면 파싱된 `data`와 원본 `response`를 함께 돌려줍니다
- 실패하면 원래 throw되던 에러를 `error`에 담아 resolve합니다
- 응답이 생기기 전에 `ky`가 실패하면 `response`는 `null`입니다
- `safe`는 callable surface와 typed shortcut method를 그대로 비추지만 `head`는 제외됩니다

## 런타임 동작

### Path interpolation

shortcut에서는 `params.path`, callable surface에서는 `path`가 route template을 `ky`로 넘기기 전에 먼저 치환합니다.

필수 path param이 빠지면 즉시 에러를 던집니다.

### `prefixUrl`와 leading slash

OpenAPI path는 보통 `/`로 시작하지만, raw `ky`는 `prefixUrl`이 설정된 상태에서 leading slash 입력을 거부합니다.

`fetcher`는 그 특정 `ky` 에러에 한해서 leading slash를 제거한 뒤 다시 시도합니다. 그래서 OpenAPI 스타일 route literal을 `prefixUrl`과 함께 그대로 쓸 수 있습니다.

### `params.cookie`는 type-only

`params.cookie`는 route 수준 cookie parameter가 OpenAPI typing에 참여하도록 두는 필드입니다.

하지만 이 값은 request header나 다른 런타임 출력으로 직렬화되지 않습니다. 실제 cookie 동작이 필요하면 앱의 런타임 설정이나 일반 `ky` 옵션에서 직접 처리해야 합니다.

### Header 병합

typed top-level `headers`는 세 번째 인자의 명시적 `ky` headers와 병합됩니다. header key는 대소문자를 구분하지 않고 병합되며, 충돌 시 나중에 전달된 명시적 `ky` headers가 이깁니다.

### JSON merge 경계

shortcut request가 `json`을 주고, 세 번째 `ky` options도 `json`을 주면 두 값이 모두 엄격한 plain object일 때만 얕게 병합합니다.

둘 중 하나라도 array, class instance, `Date` 같은 non-plain 값이면, 명시적인 `kyOptions.json`이 grouped request JSON을 대체합니다.

`kyOptions.body`가 주어지면 그 값이 우선하며 grouped JSON payload는 사용되지 않습니다.

### Multipart와 `formData`

`formData`는 실제 `FormData` body가 됩니다.

- 기존 `FormData` 인스턴스를 넘기면 그대로 사용합니다
- plain object를 넘기면 새 `FormData`에 field를 추가합니다
- array 값은 항목마다 하나씩 append합니다
- `Blob` 값은 그대로 append합니다
- `undefined` 항목은 건너뜁니다

`fetcher`는 multipart `Content-Type`을 강제로 지정하거나 boundary를 직접 세팅하지 않습니다. 그 부분은 플랫폼과 `fetch`에 맡깁니다.

### Hook metadata

요청은 hook과 관측성을 위해 `context.openapi` 메타데이터를 주입합니다.

```ts
options.context.openapi = {
  pathTemplate: '/users/{id}',
  method: 'get',
};
```

## 응답 추론

`.json()` 추론은 결정적입니다.

typed route에서 `InferJson`은 다음 순서로 해석됩니다.

1. `200`
2. `201`
3. `204`
4. `default`
5. `unknown`

현재 후보에 JSON content가 없을 때만 다음 단계로 넘어갑니다.

이렇게 해야 하나의 operation에 여러 응답이 있어도 `.json()` 추론 결과가 예측 가능하게 유지됩니다.

## API 메모

### `createTypedKy<Paths>()`

지원하는 overload는 다음과 같습니다.

```ts
createTypedKy<Paths>()
createTypedKy<Paths>(defaultOptions: Options)
createTypedKy<Paths>(instance: KyInstance)
```

### `TypedKy<Paths>`

typed client는 `ky` 동작을 유지하면서 다음을 추가합니다.

- typed callable request
- `get`, `post`, `put`, `patch`, `delete`용 typed shortcut method
- callable과 위 shortcut method를 비추는 `safe`
- 타입을 유지하는 `create()`와 `extend()` 반환값

`head`는 v1에서 의도적으로 plain `ky` surface에 남아 있습니다. 런타임에서는 사용 가능하지만, 다른 method처럼 OpenAPI shortcut typing은 붙지 않습니다.

### 공개 OpenAPI 타입

패키지는 `fetcher/openapi`에서 다음 주요 helper type을 export합니다.

- `OpenApiRequest`
- `OpenApiRequestOptions`
- `OpenApiOptions`
- `InferJson`
- `MergePaths`
- `SafeResult`

## 예전 프로토타입 shape에서 마이그레이션

예전 shortcut 예시는 flat request shape를 사용했지만, 그 형태는 더 이상 현재 배포 계약이 아닙니다.

### Before

```ts
await api.get('/users/{id}', {
  path: { id: '42' },
  searchParams: { include: 'profile' },
});

await api.post('/posts', {
  json: { title: 'Hello' },
});
```

### After

```ts
await api.get('/users/{id}', {
  params: {
    path: { id: '42' },
    query: { include: 'profile' },
  },
});

await api.post('/posts', {
  json: { title: 'Hello' },
});
```

header와 cookie parameter도 현재 배포된 grouped contract로 이동했습니다.

```ts
await api.post('/uploads/{id}', {
  params: {
    path: { id: 'upload-1' },
    cookie: { session: 'type-only' },
  },
  headers: {
    'x-upload-token': 'token',
  },
  formData: {
    file,
  },
});
```

마이그레이션 체크리스트:

- shortcut `path`를 `params.path`로 옮긴다
- shortcut `searchParams`를 `params.query`로 옮긴다
- shortcut cookie parameter를 `params.cookie`로 옮긴다
- typed header parameter를 top-level `headers`로 옮긴다
- JSON body는 top-level `json`에 둔다
- multipart 또는 form 계열 body는 top-level `formData`를 쓴다
- plain `ky` override는 세 번째 인자에 둔다

callable client는 raw `ky`에 더 가깝게 유지되므로, 이 마이그레이션 가이드는 typed shortcut method를 대상으로 합니다.

## Wrapper 방향

`fetcher`는 v1에서 의도적으로 wrapper-first 패키지입니다.

- `ky`가 런타임 코어로 남아 있습니다
- 패키지는 `ky` fork를 배포하지 않습니다
- `bindClientHooks`는 현재 배포 기능이 아닙니다
- hook과 extension 동작은 계속 일반 `ky`처럼 느껴져야 합니다

나중에 더 깊은 런타임 분기가 필요하면 별도로 판단할 수 있습니다. 하지만 그것은 현재 배포 계약에 포함되지 않습니다.

## 개발

```bash
pnpm typecheck
pnpm test
pnpm build
```

## 현재 한계

- `head`는 v1에서 plain `ky` typing에 남아 있습니다
- `params.cookie`는 type-only이며 의도적으로 직렬화되지 않습니다
- 응답 추론은 `200`, `201`, `204`, `default`만 고려합니다
- 이 패키지는 자동 auth 또는 cookie 관리를 약속하지 않습니다

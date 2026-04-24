import type { Input, KyInstance, Options, ResponsePromise } from 'ky';
import type { PathParameterValue } from '../internal/runtime';
import type {
  JsonRequestBody,
  JsonRequestBodyRequired,
  ShortcutRequestPayload,
} from './bodies';
import type { InferJson } from './responses';
import type {
  CookieParameters,
  CookieParametersRequired,
  HasMeaningfulKeys,
  HeaderParameters,
  HeaderParametersRequired,
  PathParametersFor,
  PathParametersRequired,
  QueryParameters,
  QueryParametersRequired,
} from './parameters';
import type {
  CallableMethod,
  DistributiveSimplify,
  HasRequiredKeys,
  MaybeProperty,
  OperationFor,
  PathKey,
  PathsLike,
  ShortcutMethod,
  Simplify,
} from './shared';

type NonStringInput = Exclude<Input, string>;

type SafeResponse<Json = unknown> = Awaited<ResponsePromise<Json>>;

export type SafeResult<Data, Error = unknown> =
  | {
      ok: true;
      data: Data;
      error: null;
      response: SafeResponse<Data>;
    }
  | {
      ok: false;
      data: null;
      error: Error;
      response: SafeResponse<Data> | null;
    };

export type OpenApiContext<Path extends string, Method extends string> = {
  openapi?: {
    pathTemplate?: Path;
    method?: Method;
  };
};

type OpenApiContextOptions<Path extends string, Method extends string> = {
  context?: Simplify<NonNullable<Options['context']> & OpenApiContext<Path, Method>>;
};

type DirectCallRequestOptions<Path extends string, Method extends string> = Simplify<
  Omit<Options, 'method' | 'json' | 'searchParams' | 'context'> & OpenApiContextOptions<Path, Method>
>;

type ShortcutRequestOptions<Path extends string, Method extends string> = Simplify<
  Omit<Options, 'method' | 'searchParams' | 'body' | 'json' | 'context'> &
    OpenApiContextOptions<Path, Method>
>;

export type OpenApiRequestOptions<Path extends string, Method extends string> =
  ShortcutRequestOptions<Path, Method>;

type ShortcutRequestParams<Path extends string, Operation> = Simplify<
  MaybeProperty<
    'path',
    PathParametersFor<Path, Operation>,
    PathParametersRequired<Path, Operation>,
    HasMeaningfulKeys<PathParametersFor<Path, Operation>>
  > &
    MaybeProperty<
      'query',
      QueryParameters<Operation>,
      QueryParametersRequired<Operation>,
      HasMeaningfulKeys<QueryParameters<Operation>>
    > &
    MaybeProperty<
      'cookie',
      CookieParameters<Operation>,
      CookieParametersRequired<Operation>,
      HasMeaningfulKeys<CookieParameters<Operation>>
    >
>;

type ShortcutRequest<
  Paths extends PathsLike,
  Path extends PathKey<Paths>,
  Method extends string,
> = DistributiveSimplify<
  MaybeProperty<
    'params',
    ShortcutRequestParams<Path, OperationFor<Paths, Path, Method>>,
    HasRequiredKeys<ShortcutRequestParams<Path, OperationFor<Paths, Path, Method>>>,
    HasMeaningfulKeys<ShortcutRequestParams<Path, OperationFor<Paths, Path, Method>>>
  > &
    MaybeProperty<
      'headers',
      HeaderParameters<OperationFor<Paths, Path, Method>>,
      HeaderParametersRequired<OperationFor<Paths, Path, Method>>,
      HasMeaningfulKeys<HeaderParameters<OperationFor<Paths, Path, Method>>>
    > &
    ShortcutRequestPayload<OperationFor<Paths, Path, Method>>
>;

export type OpenApiRequest<
  Paths extends PathsLike,
  Path extends PathKey<Paths>,
  Method extends string,
> = ShortcutRequest<Paths, Path, Method>;

type WideShortcutRequest = DistributiveSimplify<
  {
    params?: {
      path?: Record<string, PathParameterValue>;
      query?: NonNullable<Options['searchParams']>;
      cookie?: Record<string, unknown>;
    };
    headers?: NonNullable<Options['headers']>;
  } &
    ShortcutRequestPayload<{
      requestBody?: {
        content: {
          'application/json': unknown;
          'multipart/form-data': unknown;
          'application/x-www-form-urlencoded': unknown;
        };
      };
    }>
>;

export type OpenApiOptions<
  Paths extends PathsLike,
  Path extends PathKey<Paths>,
  Method extends string,
> = Simplify<
  DirectCallRequestOptions<Path, Method> &
    MaybeProperty<
      'path',
      PathParametersFor<Path, OperationFor<Paths, Path, Method>>,
      PathParametersRequired<Path, OperationFor<Paths, Path, Method>>,
      HasMeaningfulKeys<PathParametersFor<Path, OperationFor<Paths, Path, Method>>>
    > &
    MaybeProperty<
      'searchParams',
      QueryParameters<OperationFor<Paths, Path, Method>>,
      QueryParametersRequired<OperationFor<Paths, Path, Method>>,
      HasMeaningfulKeys<QueryParameters<OperationFor<Paths, Path, Method>>>
    > &
    MaybeProperty<
      'json',
      JsonRequestBody<OperationFor<Paths, Path, Method>>,
      JsonRequestBodyRequired<OperationFor<Paths, Path, Method>>,
      [JsonRequestBody<OperationFor<Paths, Path, Method>>] extends [never] ? false : true
    >
>;

type PathKeysWithMethod<Paths extends PathsLike, Method extends string> = {
  [Path in PathKey<Paths>]: Method extends keyof Paths[Path] ? Path : never;
}[PathKey<Paths>];

type MethodKeysForPath<Paths extends PathsLike, Path extends PathKey<Paths>> = Extract<
  keyof Paths[Path],
  CallableMethod
>;

type TypedShortcutArguments<
  Paths extends PathsLike,
  Path extends PathKey<Paths>,
  Method extends string,
> = [
  url: Path,
  request: ShortcutRequest<Paths, Path, Method>,
  options?: ShortcutRequestOptions<Path, Method>,
];

type UntypedShortcutPath<
  Paths extends PathsLike,
  Method extends string,
  Url extends string,
> = Url extends PathKeysWithMethod<Paths, Method> ? never : Url;

type WideShortcutMethodArguments<
  Paths extends PathsLike,
  Method extends string,
  Url extends string,
> = [
  url: UntypedShortcutPath<Paths, Method, Url>,
  request: WideShortcutRequest,
  options?: ShortcutRequestOptions<Url, Method>,
];

type TypedGetArguments<Paths extends PathsLike, Path extends PathKey<Paths>> = HasRequiredKeys<
  OpenApiOptions<Paths, Path, 'get'>
> extends true
  ? [url: Path, options: OpenApiOptions<Paths, Path, 'get'>]
  : [url: Path, options?: OpenApiOptions<Paths, Path, 'get'>];

type DirectCallOptions<
  Paths extends PathsLike,
  Path extends PathKey<Paths>,
  Method extends MethodKeysForPath<Paths, Path>,
> = Simplify<
  OpenApiOptions<Paths, Path, Method> & {
    method: Method | Uppercase<Method>;
  }
>;

type DirectCallArguments<
  Paths extends PathsLike,
  Path extends PathKey<Paths>,
  Method extends MethodKeysForPath<Paths, Path>,
> = HasRequiredKeys<DirectCallOptions<Paths, Path, Method>> extends true
  ? [url: Path, options: DirectCallOptions<Paths, Path, Method>]
  : [url: Path, options?: DirectCallOptions<Paths, Path, Method>];

type TypedShortcutMethod<Paths extends PathsLike, Method extends ShortcutMethod> = {
  <Path extends PathKeysWithMethod<Paths, Method>>(
    ...args: TypedShortcutArguments<Paths, Path, Method>
  ): ResponsePromise<InferJson<Paths, Path, Method>>;
  <Url extends string, Json = unknown>(
    ...args: WideShortcutMethodArguments<Paths, Method, Url>
  ): ResponsePromise<Json>;
  <Json = unknown>(url: NonStringInput, options?: Options): ResponsePromise<Json>;
};

type SafeTypedShortcutMethod<Paths extends PathsLike, Method extends ShortcutMethod> = {
  <Path extends PathKeysWithMethod<Paths, Method>>(
    ...args: TypedShortcutArguments<Paths, Path, Method>
  ): Promise<SafeResult<InferJson<Paths, Path, Method>>>;
  <Url extends string, Json = unknown>(
    ...args: WideShortcutMethodArguments<Paths, Method, Url>
  ): Promise<SafeResult<Json>>;
  <Json = unknown>(url: NonStringInput, options?: Options): Promise<SafeResult<Json>>;
};

type TypedCallable<Paths extends PathsLike> = {
  <Path extends PathKeysWithMethod<Paths, 'get'>>(
    ...args: TypedGetArguments<Paths, Path>
  ): ResponsePromise<InferJson<Paths, Path, 'get'>>;
  <Path extends PathKey<Paths>, Method extends MethodKeysForPath<Paths, Path>>(
    ...args: DirectCallArguments<Paths, Path, Method>
  ): ResponsePromise<InferJson<Paths, Path, Method>>;
  <Json = unknown>(url: Input, options?: Options): ResponsePromise<Json>;
};

type SafeTypedCallable<Paths extends PathsLike> = {
  <Path extends PathKeysWithMethod<Paths, 'get'>>(
    ...args: TypedGetArguments<Paths, Path>
  ): Promise<SafeResult<InferJson<Paths, Path, 'get'>>>;
  <Path extends PathKey<Paths>, Method extends MethodKeysForPath<Paths, Path>>(
    ...args: DirectCallArguments<Paths, Path, Method>
  ): Promise<SafeResult<InferJson<Paths, Path, Method>>>;
  <Json = unknown>(url: Input, options?: Options): Promise<SafeResult<Json>>;
};

type FetcherSafe<Paths extends PathsLike> = SafeTypedCallable<Paths> & {
  get: SafeTypedShortcutMethod<Paths, 'get'>;
  post: SafeTypedShortcutMethod<Paths, 'post'>;
  put: SafeTypedShortcutMethod<Paths, 'put'>;
  patch: SafeTypedShortcutMethod<Paths, 'patch'>;
  delete: SafeTypedShortcutMethod<Paths, 'delete'>;
};

export type Fetcher<Paths extends PathsLike> = TypedCallable<Paths> &
  Omit<KyInstance, 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'create' | 'extend'> & {
    safe: FetcherSafe<Paths>;
    get: TypedShortcutMethod<Paths, 'get'>;
    post: TypedShortcutMethod<Paths, 'post'>;
    put: TypedShortcutMethod<Paths, 'put'>;
    patch: TypedShortcutMethod<Paths, 'patch'>;
    delete: TypedShortcutMethod<Paths, 'delete'>;
    head: KyInstance['head'];
    create(defaultOptions?: Options): Fetcher<Paths>;
    extend(defaultOptions: Parameters<KyInstance['extend']>[0]): Fetcher<Paths>;
  };

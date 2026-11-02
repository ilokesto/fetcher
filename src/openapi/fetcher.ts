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

/** Parsed JSON success or a captured preparation, transport, HTTP or parsing failure. */
export type SafeResult<Data, Error = unknown> =
  | {
      /** Discriminant proving JSON parsing completed successfully. */
      ok: true;
      /** Parsed response JSON; its shape is inferred from the operation. */
      data: Data;
      /** Always null after a successful request and parse. */
      error: null;
      /** Successful ky response, retained alongside the parsed data. */
      response: SafeResponse<Data>;
    }
  | {
      /** Discriminant identifying a captured failure. */
      ok: false;
      /** Always null on failure, even when an HTTP response exists. */
      data: null;
      /** Original thrown value, including malformed-JSON and network errors. */
      error: Error;
      /** Available response, including parse failures; null before any response exists. */
      response: SafeResponse<Data> | null;
    };

/** Typed OpenAPI metadata carried in ky's request context. */
export type OpenApiContext<Path extends string, Method extends string> = {
  /** OpenAPI metadata merged with caller context during request preparation. */
  openapi?: {
    /** Original route template before parameter interpolation. */
    pathTemplate?: Path;
    /** Lowercase HTTP method selected for the request. */
    method?: Method;
  };
};

type OpenApiContextOptions<Path extends string, Method extends string> = {
  /** ky context augmented with route and method metadata. */
  context?: Simplify<NonNullable<Options['context']> & OpenApiContext<Path, Method>>;
};

type DirectCallRequestOptions<Path extends string, Method extends string> = Simplify<
  Omit<Options, 'method' | 'json' | 'searchParams' | 'context'> & OpenApiContextOptions<Path, Method>
>;

type ShortcutRequestOptions<Path extends string, Method extends string> = Simplify<
  Omit<Options, 'method' | 'searchParams' | 'body' | 'json' | 'context'> &
    OpenApiContextOptions<Path, Method>
>;

/** Extra ky options for grouped shortcuts; payload and parameters belong in the request argument. */
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

/** Grouped parameters, headers and mutually exclusive body formats inferred from an operation. */
export type OpenApiRequest<
  Paths extends PathsLike,
  Path extends PathKey<Paths>,
  Method extends string,
> = ShortcutRequest<Paths, Path, Method>;

type WideShortcutRequest = DistributiveSimplify<
  {
    /** Groups URL substitutions, query values and type-only cookies for an unknown route. */
    params?: {
      /** Values encoded into brace-delimited path tokens. */
      path?: Record<string, PathParameterValue>;
      /** Values forwarded to ky's searchParams. */
      query?: NonNullable<Options['searchParams']>;
      /** Compile-time cookie shape only; not automatically serialized. */
      cookie?: Record<string, unknown>;
    };
    /** Headers merged beneath explicit shortcut option headers. */
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

/** Direct-call ky options augmented with operation-specific parameters and JSON. */
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
      'headers',
      HeaderParameters<OperationFor<Paths, Path, Method>>,
      HeaderParametersRequired<OperationFor<Paths, Path, Method>>,
      HasMeaningfulKeys<HeaderParameters<OperationFor<Paths, Path, Method>>>
    > &
    MaybeProperty<
      'cookie',
      CookieParameters<OperationFor<Paths, Path, Method>>,
      CookieParametersRequired<OperationFor<Paths, Path, Method>>,
      HasMeaningfulKeys<CookieParameters<OperationFor<Paths, Path, Method>>>
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

type UntypedCallablePath<Paths extends PathsLike, Url extends string> = Url extends PathKey<Paths>
  ? never
  : Url;

type WideShortcutMethodArguments<
  Paths extends PathsLike,
  Method extends string,
  Url extends string,
> = [
  url: UntypedShortcutPath<Paths, Method, Url>,
  request: WideShortcutRequest,
  options?: ShortcutRequestOptions<Url, Method>,
];

type TypedHeadMethod<Paths extends PathsLike> = {
  <Path extends PathKeysWithMethod<Paths, 'head'>>(
    ...args: TypedShortcutArguments<Paths, Path, 'head'>
  ): ResponsePromise<InferJson<Paths, Path, 'head'>>;
  <Url extends string>(
    url: UntypedShortcutPath<Paths, 'head', Url>,
    options?: Options,
  ): ResponsePromise;
  (url: NonStringInput, options?: Options): ResponsePromise;
};

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
    /** Explicit operation method; lowercase and uppercase spellings are accepted. */
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
  <const Url extends string, Json = unknown>(
    ...args: WideShortcutMethodArguments<Paths, Method, Url>
  ): ResponsePromise<Json>;
  <Json = unknown>(url: NonStringInput, options?: Options): ResponsePromise<Json>;
};

type SafeTypedShortcutMethod<Paths extends PathsLike, Method extends ShortcutMethod> = {
  <Path extends PathKeysWithMethod<Paths, Method>>(
    ...args: TypedShortcutArguments<Paths, Path, Method>
  ): Promise<SafeResult<InferJson<Paths, Path, Method>>>;
  <const Url extends string, Json = unknown>(
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
  <Url extends string, Json = unknown>(
    url: UntypedCallablePath<Paths, Url>,
    options?: Options,
  ): ResponsePromise<Json>;
  <Json = unknown>(url: NonStringInput, options?: Options): ResponsePromise<Json>;
};

type SafeTypedCallable<Paths extends PathsLike> = {
  <Path extends PathKeysWithMethod<Paths, 'get'>>(
    ...args: TypedGetArguments<Paths, Path>
  ): Promise<SafeResult<InferJson<Paths, Path, 'get'>>>;
  <Path extends PathKey<Paths>, Method extends MethodKeysForPath<Paths, Path>>(
    ...args: DirectCallArguments<Paths, Path, Method>
  ): Promise<SafeResult<InferJson<Paths, Path, Method>>>;
  <Url extends string, Json = unknown>(
    url: UntypedCallablePath<Paths, Url>,
    options?: Options,
  ): Promise<SafeResult<Json>>;
  <Json = unknown>(url: NonStringInput, options?: Options): Promise<SafeResult<Json>>;
};

type FetcherSafe<Paths extends PathsLike> = SafeTypedCallable<Paths> & {
  /** Performs GET and eagerly parses JSON into SafeResult. */
  get: SafeTypedShortcutMethod<Paths, 'get'>;
  /** Performs POST and captures request or JSON parsing failures. */
  post: SafeTypedShortcutMethod<Paths, 'post'>;
  /** Performs PUT and captures request or JSON parsing failures. */
  put: SafeTypedShortcutMethod<Paths, 'put'>;
  /** Performs PATCH and captures request or JSON parsing failures. */
  patch: SafeTypedShortcutMethod<Paths, 'patch'>;
  /** Performs DELETE and captures request or JSON parsing failures. */
  delete: SafeTypedShortcutMethod<Paths, 'delete'>;
};

/**
 * OpenAPI-aware callable client preserving ky response promises and external retry/stop controls.
 * Direct calls use ky-style options; string shortcuts use a grouped request argument.
 * Unknown routes remain available and URL/Request inputs keep ky-compatible signatures.
 */
export type Fetcher<Paths extends PathsLike> = TypedCallable<Paths> &
  Pick<KyInstance, 'retry' | 'stop'> & {
    /** Non-throwing callable and shortcuts that eagerly parse JSON; no safe.head exists. */
    safe: FetcherSafe<Paths>;
    /** Lazy GET request using grouped params, headers and an optional schema-supported body. */
    get: TypedShortcutMethod<Paths, 'get'>;
    /** Lazy POST request accepting one schema-supported JSON, multipart or URL-encoded body. */
    post: TypedShortcutMethod<Paths, 'post'>;
    /** Lazy PUT request accepting grouped parameters and one schema-supported body. */
    put: TypedShortcutMethod<Paths, 'put'>;
    /** Lazy PATCH request accepting grouped parameters and one schema-supported body. */
    patch: TypedShortcutMethod<Paths, 'patch'>;
    /** Lazy DELETE request accepting grouped parameters and one schema-supported body. */
    delete: TypedShortcutMethod<Paths, 'delete'>;
    /** Lazy typed HEAD shortcut; unknown routes and URL/Request inputs use ky options. */
    head: TypedHeadMethod<Paths>;
    /** Creates a fully decorated client with replacement defaults, using ky.create semantics. */
    create(defaultOptions?: Options): Fetcher<Paths>;
    /** Creates a fully decorated client with defaults merged by ky.extend, including callback defaults. */
    extend(defaultOptions: Parameters<KyInstance['extend']>[0]): Fetcher<Paths>;
  };

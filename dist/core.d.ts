import { Options, ResponsePromise, Input, KyInstance } from 'ky';
export { ForceRetryError, HTTPError, Hooks, Input, KyInstance, KyRequest, KyResponse, Options, ResponsePromise, TimeoutError, isForceRetryError, isHTTPError, isKyError, isTimeoutError } from 'ky';

type OpenApiHttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';
type PathsLike = Record<string, Partial<Record<OpenApiHttpMethod, unknown>>>;
type ShortcutMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
type CallableMethod = ShortcutMethod | 'head';
type PathKey<Paths extends PathsLike> = Extract<keyof Paths, string>;
type Simplify<T> = {
    [K in keyof T]: T[K];
} & {};
type DistributiveSimplify<T> = T extends unknown ? Simplify<T> : never;
type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];
type HasRequiredKeys<T> = [RequiredKeys<T>] extends [never] ? false : true;
type UnknownIfNever<T> = [T] extends [never] ? unknown : T;
type MaybeProperty<Key extends PropertyKey, Value, IsRequired extends boolean, Include extends boolean> = Include extends true ? IsRequired extends true ? {
    [K in Key]-?: Value;
} : {
    [K in Key]?: Value;
} : {};
type OperationFor<Paths extends PathsLike, Path extends PathKey<Paths>, Method extends string> = Method extends keyof Paths[Path] ? Paths[Path][Method] : never;
type MergePathMethods<BasePath, ExtraPath> = Simplify<{
    [Method in keyof BasePath | keyof ExtraPath]: Method extends keyof ExtraPath ? ExtraPath[Method] : Method extends keyof BasePath ? BasePath[Method] : never;
}>;
type MergePaths<Base, Extra> = Simplify<{
    [Path in keyof Base | keyof Extra]: Path extends keyof Extra ? Path extends keyof Base ? MergePathMethods<Base[Path], Extra[Path]> : Extra[Path] : Path extends keyof Base ? Base[Path] : never;
}>;

type RequestBodyFor<Operation> = Operation extends {
    requestBody: infer RequestBody;
} ? RequestBody : Operation extends {
    requestBody?: infer RequestBody;
} ? RequestBody : never;
type ContentFor<RequestBody> = RequestBody extends {
    content: infer Content;
} ? Content : never;
type JsonMediaTypeKeys<Content> = Extract<keyof Content, 'application/json' | `${string}+json` | `${string}/json`>;
type JsonContent<Content> = [JsonMediaTypeKeys<Content>] extends [never] ? never : Content[JsonMediaTypeKeys<Content>];
type FormDataMediaTypeKeys<Content> = Extract<keyof Content, 'multipart/form-data'>;
type FormDataContent<Content> = [FormDataMediaTypeKeys<Content>] extends [never] ? never : Content[FormDataMediaTypeKeys<Content>];
type FormUrlEncodedMediaTypeKeys<Content> = Extract<keyof Content, 'application/x-www-form-urlencoded'>;
type FormUrlEncodedContent<Content> = [FormUrlEncodedMediaTypeKeys<Content>] extends [never] ? never : Content[FormUrlEncodedMediaTypeKeys<Content>];
type JsonRequestBody<Operation> = JsonContent<ContentFor<RequestBodyFor<Operation>>>;
type FormDataRequestBody<Operation> = FormDataContent<ContentFor<RequestBodyFor<Operation>>>;
type FormUrlEncodedRequestBody<Operation> = FormUrlEncodedContent<ContentFor<RequestBodyFor<Operation>>>;
type RequestBodyRequired<Operation> = RequestBodyFor<Operation> extends {
    content: infer _Content;
} ? true : false;
type JsonRequestBodyRequired<Operation> = [JsonRequestBody<Operation>] extends [never] ? false : RequestBodyRequired<Operation>;
type ShortcutBodyKey = 'json' | 'formData' | 'formUrlEncoded';
type ShortcutPayloadMember<Key extends ShortcutBodyKey, Value, IsRequired extends boolean> = DistributiveSimplify<MaybeProperty<Key, Value, IsRequired, true> & {
    [K in Exclude<ShortcutBodyKey, Key>]?: never;
}>;
type ShortcutRequestPayloadUnion<Operation> = ([JsonRequestBody<Operation>] extends [never] ? never : ShortcutPayloadMember<'json', JsonRequestBody<Operation>, RequestBodyRequired<Operation>>) | ([FormDataRequestBody<Operation>] extends [never] ? never : ShortcutPayloadMember<'formData', FormDataRequestBody<Operation>, RequestBodyRequired<Operation>>) | ([FormUrlEncodedRequestBody<Operation>] extends [never] ? never : ShortcutPayloadMember<'formUrlEncoded', FormUrlEncodedRequestBody<Operation>, RequestBodyRequired<Operation>>);
type ShortcutRequestPayload<Operation> = [
    ShortcutRequestPayloadUnion<Operation>
] extends [never] ? {} : ShortcutRequestPayloadUnion<Operation>;

type ResponsesFor<Operation> = Operation extends {
    responses: infer Responses;
} ? Responses : never;
type PreferredJsonStatusCode = 200 | 201 | 204;
type ResponseForStatus<Responses, Status extends PreferredJsonStatusCode> = Responses extends object ? Responses[Extract<keyof Responses, Status | `${Status}`>] : never;
type DefaultResponse<Responses> = Responses extends {
    default: infer Response;
} ? Response : never;
type JsonResponse<Response> = Response extends {
    content: infer Content;
} ? JsonContent<Content> : never;
type PreferredJsonResponse<Responses> = [JsonResponse<ResponseForStatus<Responses, 200>>] extends [never] ? [JsonResponse<ResponseForStatus<Responses, 201>>] extends [never] ? [JsonResponse<ResponseForStatus<Responses, 204>>] extends [never] ? JsonResponse<DefaultResponse<Responses>> : JsonResponse<ResponseForStatus<Responses, 204>> : JsonResponse<ResponseForStatus<Responses, 201>> : JsonResponse<ResponseForStatus<Responses, 200>>;
type InferJson<Paths extends PathsLike, Path extends PathKey<Paths>, Method extends string> = UnknownIfNever<PreferredJsonResponse<ResponsesFor<OperationFor<Paths, Path, Method>>>>;

type PathParameterValue = string | number | boolean;

type RouteParameterGroupKey = 'path' | 'query' | 'header' | 'cookie';
type TemplateParamNames<Path extends string> = Path extends `${string}{${infer Param}}${infer Rest}` ? Param | TemplateParamNames<Rest> : never;
type PathTemplateParams<Path extends string> = [TemplateParamNames<Path>] extends [never] ? never : {
    [K in TemplateParamNames<Path>]: PathParameterValue;
};
type ParametersFor<Operation> = Operation extends {
    parameters: infer Parameters;
} ? Parameters : Operation extends {
    parameters?: infer Parameters;
} ? Parameters : never;
type ParameterGroup<Parameters, Key extends RouteParameterGroupKey> = Parameters extends {
    [K in Key]: infer Value;
} ? Value : Parameters extends {
    [K in Key]?: infer Value;
} ? Value : never;
type HasWideNeverIndex<T> = T extends Record<string, infer Value> ? string extends keyof T ? [Value] extends [never] ? true : false : false : false;
type HasMeaningfulKeys<T> = [T] extends [never] ? false : T extends object ? HasWideNeverIndex<T> extends true ? false : keyof T extends never ? false : true : false;
type PathParameters<Operation> = Extract<ParameterGroup<ParametersFor<Operation>, 'path'>, object>;
type QueryParameters<Operation> = Extract<ParameterGroup<ParametersFor<Operation>, 'query'>, object>;
type HeaderParameters<Operation> = Extract<ParameterGroup<ParametersFor<Operation>, 'header'>, object>;
type CookieParameters<Operation> = Extract<ParameterGroup<ParametersFor<Operation>, 'cookie'>, object>;
type ParameterGroupRequired<Operation, Key extends RouteParameterGroupKey> = ParametersFor<Operation> extends {
    [K in Key]: infer _Group;
} ? HasMeaningfulKeys<Extract<ParameterGroup<ParametersFor<Operation>, Key>, object>> : false;
type PathParametersFor<Path extends string, Operation> = HasMeaningfulKeys<PathParameters<Operation>> extends true ? Simplify<PathParameters<Operation>> : PathTemplateParams<Path>;
type PathParametersRequired<Path extends string, Operation> = [TemplateParamNames<Path>] extends [never] ? ParameterGroupRequired<Operation, 'path'> : true;
type QueryParametersRequired<Operation> = ParameterGroupRequired<Operation, 'query'>;
type HeaderParametersRequired<Operation> = ParameterGroupRequired<Operation, 'header'>;
type CookieParametersRequired<Operation> = ParameterGroupRequired<Operation, 'cookie'>;

type NonStringInput = Exclude<Input, string>;
type SafeResponse<Json = unknown> = Awaited<ResponsePromise<Json>>;
type SafeResult<Data, Error = unknown> = {
    ok: true;
    data: Data;
    error: null;
    response: SafeResponse<Data>;
} | {
    ok: false;
    data: null;
    error: Error;
    response: SafeResponse<Data> | null;
};
type OpenApiContext<Path extends string, Method extends string> = {
    openapi?: {
        pathTemplate?: Path;
        method?: Method;
    };
};
type OpenApiContextOptions<Path extends string, Method extends string> = {
    context?: Simplify<NonNullable<Options['context']> & OpenApiContext<Path, Method>>;
};
type DirectCallRequestOptions<Path extends string, Method extends string> = Simplify<Omit<Options, 'method' | 'json' | 'searchParams' | 'context'> & OpenApiContextOptions<Path, Method>>;
type ShortcutRequestOptions<Path extends string, Method extends string> = Simplify<Omit<Options, 'method' | 'searchParams' | 'body' | 'json' | 'context'> & OpenApiContextOptions<Path, Method>>;
type OpenApiRequestOptions<Path extends string, Method extends string> = ShortcutRequestOptions<Path, Method>;
type ShortcutRequestParams<Path extends string, Operation> = Simplify<MaybeProperty<'path', PathParametersFor<Path, Operation>, PathParametersRequired<Path, Operation>, HasMeaningfulKeys<PathParametersFor<Path, Operation>>> & MaybeProperty<'query', QueryParameters<Operation>, QueryParametersRequired<Operation>, HasMeaningfulKeys<QueryParameters<Operation>>> & MaybeProperty<'cookie', CookieParameters<Operation>, CookieParametersRequired<Operation>, HasMeaningfulKeys<CookieParameters<Operation>>>>;
type ShortcutRequest<Paths extends PathsLike, Path extends PathKey<Paths>, Method extends string> = DistributiveSimplify<MaybeProperty<'params', ShortcutRequestParams<Path, OperationFor<Paths, Path, Method>>, HasRequiredKeys<ShortcutRequestParams<Path, OperationFor<Paths, Path, Method>>>, HasMeaningfulKeys<ShortcutRequestParams<Path, OperationFor<Paths, Path, Method>>>> & MaybeProperty<'headers', HeaderParameters<OperationFor<Paths, Path, Method>>, HeaderParametersRequired<OperationFor<Paths, Path, Method>>, HasMeaningfulKeys<HeaderParameters<OperationFor<Paths, Path, Method>>>> & ShortcutRequestPayload<OperationFor<Paths, Path, Method>>>;
type OpenApiRequest<Paths extends PathsLike, Path extends PathKey<Paths>, Method extends string> = ShortcutRequest<Paths, Path, Method>;
type WideShortcutRequest = DistributiveSimplify<{
    params?: {
        path?: Record<string, PathParameterValue>;
        query?: NonNullable<Options['searchParams']>;
        cookie?: Record<string, unknown>;
    };
    headers?: NonNullable<Options['headers']>;
} & ShortcutRequestPayload<{
    requestBody?: {
        content: {
            'application/json': unknown;
            'multipart/form-data': unknown;
            'application/x-www-form-urlencoded': unknown;
        };
    };
}>>;
type OpenApiOptions<Paths extends PathsLike, Path extends PathKey<Paths>, Method extends string> = Simplify<DirectCallRequestOptions<Path, Method> & MaybeProperty<'path', PathParametersFor<Path, OperationFor<Paths, Path, Method>>, PathParametersRequired<Path, OperationFor<Paths, Path, Method>>, HasMeaningfulKeys<PathParametersFor<Path, OperationFor<Paths, Path, Method>>>> & MaybeProperty<'searchParams', QueryParameters<OperationFor<Paths, Path, Method>>, QueryParametersRequired<OperationFor<Paths, Path, Method>>, HasMeaningfulKeys<QueryParameters<OperationFor<Paths, Path, Method>>>> & MaybeProperty<'json', JsonRequestBody<OperationFor<Paths, Path, Method>>, JsonRequestBodyRequired<OperationFor<Paths, Path, Method>>, [
    JsonRequestBody<OperationFor<Paths, Path, Method>>
] extends [never] ? false : true>>;
type PathKeysWithMethod<Paths extends PathsLike, Method extends string> = {
    [Path in PathKey<Paths>]: Method extends keyof Paths[Path] ? Path : never;
}[PathKey<Paths>];
type MethodKeysForPath<Paths extends PathsLike, Path extends PathKey<Paths>> = Extract<keyof Paths[Path], CallableMethod>;
type TypedShortcutArguments<Paths extends PathsLike, Path extends PathKey<Paths>, Method extends string> = [
    url: Path,
    request: ShortcutRequest<Paths, Path, Method>,
    options?: ShortcutRequestOptions<Path, Method>
];
type UntypedShortcutPath<Paths extends PathsLike, Method extends string, Url extends string> = Url extends PathKeysWithMethod<Paths, Method> ? never : Url;
type WideShortcutMethodArguments<Paths extends PathsLike, Method extends string, Url extends string> = [
    url: UntypedShortcutPath<Paths, Method, Url>,
    request: WideShortcutRequest,
    options?: ShortcutRequestOptions<Url, Method>
];
type TypedGetArguments<Paths extends PathsLike, Path extends PathKey<Paths>> = HasRequiredKeys<OpenApiOptions<Paths, Path, 'get'>> extends true ? [url: Path, options: OpenApiOptions<Paths, Path, 'get'>] : [url: Path, options?: OpenApiOptions<Paths, Path, 'get'>];
type DirectCallOptions<Paths extends PathsLike, Path extends PathKey<Paths>, Method extends MethodKeysForPath<Paths, Path>> = Simplify<OpenApiOptions<Paths, Path, Method> & {
    method: Method | Uppercase<Method>;
}>;
type DirectCallArguments<Paths extends PathsLike, Path extends PathKey<Paths>, Method extends MethodKeysForPath<Paths, Path>> = HasRequiredKeys<DirectCallOptions<Paths, Path, Method>> extends true ? [url: Path, options: DirectCallOptions<Paths, Path, Method>] : [url: Path, options?: DirectCallOptions<Paths, Path, Method>];
type TypedShortcutMethod<Paths extends PathsLike, Method extends ShortcutMethod> = {
    <Path extends PathKeysWithMethod<Paths, Method>>(...args: TypedShortcutArguments<Paths, Path, Method>): ResponsePromise<InferJson<Paths, Path, Method>>;
    <Url extends string, Json = unknown>(...args: WideShortcutMethodArguments<Paths, Method, Url>): ResponsePromise<Json>;
    <Json = unknown>(url: NonStringInput, options?: Options): ResponsePromise<Json>;
};
type SafeTypedShortcutMethod<Paths extends PathsLike, Method extends ShortcutMethod> = {
    <Path extends PathKeysWithMethod<Paths, Method>>(...args: TypedShortcutArguments<Paths, Path, Method>): Promise<SafeResult<InferJson<Paths, Path, Method>>>;
    <Url extends string, Json = unknown>(...args: WideShortcutMethodArguments<Paths, Method, Url>): Promise<SafeResult<Json>>;
    <Json = unknown>(url: NonStringInput, options?: Options): Promise<SafeResult<Json>>;
};
type TypedCallable<Paths extends PathsLike> = {
    <Path extends PathKeysWithMethod<Paths, 'get'>>(...args: TypedGetArguments<Paths, Path>): ResponsePromise<InferJson<Paths, Path, 'get'>>;
    <Path extends PathKey<Paths>, Method extends MethodKeysForPath<Paths, Path>>(...args: DirectCallArguments<Paths, Path, Method>): ResponsePromise<InferJson<Paths, Path, Method>>;
    <Json = unknown>(url: Input, options?: Options): ResponsePromise<Json>;
};
type SafeTypedCallable<Paths extends PathsLike> = {
    <Path extends PathKeysWithMethod<Paths, 'get'>>(...args: TypedGetArguments<Paths, Path>): Promise<SafeResult<InferJson<Paths, Path, 'get'>>>;
    <Path extends PathKey<Paths>, Method extends MethodKeysForPath<Paths, Path>>(...args: DirectCallArguments<Paths, Path, Method>): Promise<SafeResult<InferJson<Paths, Path, Method>>>;
    <Json = unknown>(url: Input, options?: Options): Promise<SafeResult<Json>>;
};
type FetcherSafe<Paths extends PathsLike> = SafeTypedCallable<Paths> & {
    get: SafeTypedShortcutMethod<Paths, 'get'>;
    post: SafeTypedShortcutMethod<Paths, 'post'>;
    put: SafeTypedShortcutMethod<Paths, 'put'>;
    patch: SafeTypedShortcutMethod<Paths, 'patch'>;
    delete: SafeTypedShortcutMethod<Paths, 'delete'>;
};
type Fetcher<Paths extends PathsLike> = TypedCallable<Paths> & Omit<KyInstance, 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'create' | 'extend'> & {
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

declare function createFetcher<Paths extends PathsLike>(): Fetcher<Paths>;
declare function createFetcher<Paths extends PathsLike>(defaultOptions: Options): Fetcher<Paths>;
declare function createFetcher<Paths extends PathsLike>(instance: KyInstance): Fetcher<Paths>;

export { type Fetcher as F, type InferJson as I, type MergePaths as M, type OpenApiContext as O, type PathTemplateParams as P, type SafeResult as S, type OpenApiHttpMethod as a, type OpenApiOptions as b, type OpenApiRequest as c, createFetcher, type OpenApiRequestOptions as d, type PathsLike as e };

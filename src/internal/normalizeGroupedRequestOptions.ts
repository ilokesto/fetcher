import type { Options } from 'ky';
import type { PathParameterValue, RuntimeOptions } from './runtime';

type RuntimeSearchParams = NonNullable<Options['searchParams']>;
type RuntimeHeaders = NonNullable<Options['headers']>;

export type GroupedRequestParams = {
  /** URL template substitutions, encoded individually before transport. */
  path?: Record<string, PathParameterValue>;
  /** Query values forwarded to ky's searchParams option. */
  query?: RuntimeSearchParams;
  /** Type-only cookie parameters; this facade does not serialize cookies. */
  cookie?: Record<string, unknown>;
};

export type GroupedRequest = {
  /** Path, query and type-only cookie groups. */
  params?: GroupedRequestParams;
  /** Request headers merged beneath explicitly supplied ky headers. */
  headers?: RuntimeHeaders;
  /** JSON body, shallowly merged with explicit JSON when both are plain objects. */
  json?: unknown;
  /** FormData or a plain object converted to multipart fields. */
  formData?: unknown;
  /** URLSearchParams or a plain object converted to URL-encoded fields. */
  formUrlEncoded?: unknown;
};

const hasOwn = <Key extends PropertyKey>(value: object, key: Key): value is Record<Key, unknown> =>
  Object.prototype.hasOwnProperty.call(value, key);

const isStrictPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};

const applyHeaders = (headers: Headers, source?: RuntimeHeaders): void => {
  if (!source) {
    return;
  }

  if (source instanceof Headers) {
    source.forEach((value, key) => {
      headers.set(key, value);
    });

    return;
  }

  if (Array.isArray(source)) {
    source.forEach(([key, value]) => {
      headers.set(key, String(value));
    });

    return;
  }

  Object.entries(source).forEach(([key, value]) => {
    // ky interprets "undefined" in Headers as a deletion, including inherited defaults.
    headers.set(key, String(value));
  });
};

const mergeHeaders = (
  requestHeaders?: RuntimeHeaders,
  explicitHeaders?: RuntimeHeaders,
): RuntimeHeaders | undefined => {
  if (!requestHeaders && !explicitHeaders) {
    return undefined;
  }

  const mergedHeaders = new Headers();

  applyHeaders(mergedHeaders, requestHeaders);
  applyHeaders(mergedHeaders, explicitHeaders);

  return mergedHeaders;
};

const appendFormDataValue = (formData: FormData, key: string, value: unknown): void => {
  if (value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      appendFormDataValue(formData, key, item);
    });

    return;
  }

  if (value instanceof Blob) {
    formData.append(key, value);
    return;
  }

  formData.append(key, String(value));
};

const toFormDataBody = (value: unknown): FormData => {
  if (value instanceof FormData) {
    return value;
  }

  const formData = new FormData();

  if (!isStrictPlainObject(value)) {
    return formData;
  }

  Object.entries(value).forEach(([key, entryValue]) => {
    appendFormDataValue(formData, key, entryValue);
  });

  return formData;
};

const appendUrlSearchParamsValue = (
  searchParams: URLSearchParams,
  key: string,
  value: unknown,
): void => {
  if (value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      appendUrlSearchParamsValue(searchParams, key, item);
    });

    return;
  }

  searchParams.append(key, String(value));
};

const toUrlSearchParamsBody = (value: unknown): URLSearchParams => {
  if (value instanceof URLSearchParams) {
    return value;
  }

  const searchParams = new URLSearchParams();

  if (!isStrictPlainObject(value)) {
    return searchParams;
  }

  Object.entries(value).forEach(([key, entryValue]) => {
    appendUrlSearchParamsValue(searchParams, key, entryValue);
  });

  return searchParams;
};

const resolveJson = (requestJson: unknown, explicitJson: unknown): unknown => {
  if (requestJson === undefined) {
    return explicitJson;
  }

  if (explicitJson === undefined) {
    return requestJson;
  }

  if (isStrictPlainObject(requestJson) && isStrictPlainObject(explicitJson)) {
    return {
      ...requestJson,
      ...explicitJson,
    };
  }

  return explicitJson;
};

/**
 * @description Merges grouped request data with ky options; grouped query parameters replace explicit searchParams.
 * Explicit headers override grouped headers. Explicit body wins; otherwise explicit JSON
 * overrides form conversion. Plain JSON objects merge shallowly with explicit fields winning.
 * Cookie parameters are type-only and are not serialized.
 * @param {{ request?: GroupedRequest; options?: Options }} settings - Grouped data and explicit options.
 * @param {GroupedRequest} [settings.request] - Grouped request values.
 * @param {GroupedRequestParams} [settings.request.params] - Parameter groups.
 * @param {Record<string, PathParameterValue>} [settings.request.params.path] - URL template substitutions.
 * @param {RuntimeSearchParams} [settings.request.params.query] - Query parameters replacing ky searchParams.
 * @param {Record<string, unknown>} [settings.request.params.cookie] - Type-only cookie parameters.
 * @param {RuntimeHeaders} [settings.request.headers] - Headers merged beneath explicit headers.
 * @param {unknown} [settings.request.json] - JSON body to merge or replace.
 * @param {unknown} [settings.request.formData] - Multipart body or plain object to serialize.
 * @param {unknown} [settings.request.formUrlEncoded] - URL-encoded body or plain object to serialize.
 * @param {Options} [settings.options] - Explicit ky transport options.
 * @returns {RuntimeOptions | undefined} Normalized options, or undefined when both inputs are absent.
 * - path `Record<string, PathParameterValue> | undefined` - Deferred path substitutions.
 * - cookie `Record<string, unknown> | undefined` - Internal cookie field copied from explicit runtime options, if present.
 * - context `RuntimeContext | undefined` - Caller context preserved from explicit options.
 * : context.openapi `Record<string, unknown> | undefined` - Existing OpenAPI metadata.
 * @example
 * normalizeGroupedRequestOptions({
 *   request: { params: { path: { id: '42' }, query: { page: 1 } }, json: { name: 'Ada' } },
 *   options: { headers: { authorization: 'Bearer token' } },
 * });
 */
export const normalizeGroupedRequestOptions = ({
  request,
  options,
}: {
  request?: GroupedRequest;
  options?: Options;
}): RuntimeOptions | undefined => {
  if (!request && !options) {
    return undefined;
  }

  const runtimeOptions: RuntimeOptions = options ? ({ ...options } as RuntimeOptions) : {};
  const requestParams = request?.params;

  if (requestParams?.path) {
    runtimeOptions.path = requestParams.path;
  }

  if (requestParams && hasOwn(requestParams, 'query')) {
    runtimeOptions.searchParams = requestParams.query as RuntimeSearchParams | undefined;
  }

  const mergedHeaders = mergeHeaders(request?.headers, options?.headers);

  if (mergedHeaders) {
    runtimeOptions.headers = mergedHeaders;
  } else {
    delete runtimeOptions.headers;
  }

  delete runtimeOptions.json;
  delete runtimeOptions.body;

  if (options?.body !== undefined) {
    runtimeOptions.body = options.body;
    return runtimeOptions;
  }

  if (request && hasOwn(request, 'formData')) {
    if (options?.json !== undefined) {
      runtimeOptions.json = options.json;
    } else {
      runtimeOptions.body = toFormDataBody(request.formData);
    }

    return runtimeOptions;
  }

  if (request && hasOwn(request, 'formUrlEncoded')) {
    if (options?.json !== undefined) {
      runtimeOptions.json = options.json;
    } else {
      runtimeOptions.body = toUrlSearchParamsBody(request.formUrlEncoded);
    }

    return runtimeOptions;
  }

  if (request && hasOwn(request, 'json')) {
    const resolvedJson = resolveJson(request.json, options?.json);

    if (resolvedJson !== undefined) {
      runtimeOptions.json = resolvedJson;
    }

    return runtimeOptions;
  }

  if (options?.json !== undefined) {
    runtimeOptions.json = options.json;
  }

  return runtimeOptions;
};

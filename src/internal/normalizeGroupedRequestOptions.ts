import type { Options } from 'ky';
import type { PathParameterValue, RuntimeOptions } from './runtime';

type RuntimeSearchParams = NonNullable<Options['searchParams']>;
type RuntimeHeaders = NonNullable<Options['headers']>;

export type GroupedRequestParams = {
  path?: Record<string, PathParameterValue>;
  query?: RuntimeSearchParams;
  cookie?: Record<string, unknown>;
};

export type GroupedRequest = {
  params?: GroupedRequestParams;
  headers?: RuntimeHeaders;
  json?: unknown;
  formData?: unknown;
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

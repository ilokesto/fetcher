import type { Input, Options } from 'ky';

export type PathParameterValue = string | number | boolean;
type RuntimeSearchParams = NonNullable<Options['searchParams']>;
type RuntimeHeaders = NonNullable<Options['headers']>;

const KY_PREFIX_URL_LEADING_SLASH_ERROR =
  '`input` must not begin with a slash when using `prefixUrl`';

type RuntimeContext = Record<string, unknown> & {
  openapi?: Record<string, unknown>;
};

type RuntimeOptions = Options & {
  path?: Record<string, PathParameterValue>;
  context?: RuntimeContext;
};

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
};

const PATH_TOKEN_PATTERN = /\{([^}]+)\}/g;

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
      if (value !== undefined) {
        headers.set(key, value);
      }
    });

    return;
  }

  Object.entries(source).forEach(([key, value]) => {
    if (value !== undefined) {
      headers.set(key, value);
    }
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

  if (request && hasOwn(request, 'formData')) {
    if (options?.body !== undefined) {
      runtimeOptions.body = options.body;
    } else if (options?.json !== undefined) {
      runtimeOptions.json = options.json;
    } else {
      runtimeOptions.body = toFormDataBody(request.formData);
    }

    return runtimeOptions;
  }

  if (request && hasOwn(request, 'json')) {
    if (options?.body !== undefined) {
      runtimeOptions.body = options.body;
      return runtimeOptions;
    }

    const resolvedJson = resolveJson(request.json, options?.json);

    if (resolvedJson !== undefined) {
      runtimeOptions.json = resolvedJson;
    }

    return runtimeOptions;
  }

  if (options?.body !== undefined) {
    runtimeOptions.body = options.body;
  }

  if (options?.json !== undefined) {
    runtimeOptions.json = options.json;
  }

  return runtimeOptions;
};

const readOpenApiContext = (context: RuntimeContext | undefined): Record<string, unknown> => {
  const openapi = context?.openapi;

  if (openapi && typeof openapi === 'object' && !Array.isArray(openapi)) {
    return openapi;
  }

  return {};
};

export const toOpenApiMethod = (method?: string): string => (method ?? 'GET').toLowerCase();

export const interpolatePathTemplate = (
  template: string,
  path?: Record<string, PathParameterValue>,
): string => {
  const matches = [...template.matchAll(PATH_TOKEN_PATTERN)];

  if (matches.length === 0) {
    return template;
  }

  if (!path) {
    throw new Error(`Missing path parameters for template: ${template}`);
  }

  return template.replace(PATH_TOKEN_PATTERN, (_match, rawKey: string) => {
    const key = rawKey.trim();
    const value = path[key];

    if (value === undefined) {
      throw new Error(`Missing path parameter "${key}" for template: ${template}`);
    }

    return encodeURIComponent(String(value));
  });
};

export const isKyPrefixUrlLeadingSlashError = (error: unknown): error is Error =>
  error instanceof Error && error.message === KY_PREFIX_URL_LEADING_SLASH_ERROR;

export const stripLeadingSlash = (input: Input): Input => {
  if (typeof input !== 'string' || !input.startsWith('/')) {
    return input;
  }

  return input.slice(1);
};

export const prepareKyRequest = ({
  input,
  method,
  options,
}: {
  input: Input;
  method: string;
  options?: Options;
}): { input: Input; options: Options | undefined } => {
  const runtimeOptions = options ? ({ ...options } as RuntimeOptions) : undefined;
  const path = runtimeOptions?.path;

  if (path && typeof input !== 'string') {
    throw new Error('The OpenAPI path option can only be used with string URL templates.');
  }

  const interpolatedInput = typeof input === 'string' ? interpolatePathTemplate(input, path) : input;

  if (!runtimeOptions) {
    if (typeof input !== 'string') {
      return { input: interpolatedInput, options: undefined };
    }

    return {
      input: interpolatedInput,
      options: {
        context: {
          openapi: {
            method,
            pathTemplate: input,
          },
        },
      },
    };
  }

  delete runtimeOptions.path;

  runtimeOptions.context = {
    ...runtimeOptions.context,
    openapi: {
      ...readOpenApiContext(runtimeOptions.context),
      method,
      ...(typeof input === 'string' ? { pathTemplate: input } : {}),
    },
  };

  return {
    input: interpolatedInput,
    options: runtimeOptions,
  };
};

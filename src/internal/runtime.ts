import type { Input, Options } from 'ky';

export { normalizeGroupedRequestOptions } from './normalizeGroupedRequestOptions';
export type { GroupedRequestParams, GroupedRequest } from './normalizeGroupedRequestOptions';

export type PathParameterValue = string | number | boolean;

const KY_PREFIX_URL_ERROR_PREFIX = 'prefixUrl';
const KY_LEADING_SLASH_ERROR_PATTERN = /slash|begins?|starts?/i;

type RuntimeContext = Record<string, unknown> & {
  openapi?: Record<string, unknown>;
};

export type RuntimeOptions = Options & {
  path?: Record<string, PathParameterValue>;
  cookie?: Record<string, unknown>;
  context?: RuntimeContext;
};

const PATH_TOKEN_PATTERN = /\{([^}]+)\}/g;

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
  error instanceof Error &&
  error.message.includes(KY_PREFIX_URL_ERROR_PREFIX) &&
  KY_LEADING_SLASH_ERROR_PATTERN.test(error.message);

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
  const runtimeOptions: RuntimeOptions = options ? { ...options } : {};
  const path = runtimeOptions.path;

  if (path && typeof input !== 'string') {
    throw new Error('The OpenAPI path option can only be used with string URL templates.');
  }

  const interpolatedInput = typeof input === 'string' ? interpolatePathTemplate(input, path) : input;

  delete runtimeOptions.path;
  delete runtimeOptions.cookie;

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

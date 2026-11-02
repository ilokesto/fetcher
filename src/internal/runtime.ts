import type { Input, Options } from 'ky';

export { normalizeGroupedRequestOptions } from './normalizeGroupedRequestOptions';
export type { GroupedRequestParams, GroupedRequest } from './normalizeGroupedRequestOptions';

export type PathParameterValue = string | number | boolean;

const KY_PREFIX_URL_ERROR_PREFIX = 'prefixUrl';
const KY_LEADING_SLASH_ERROR_PATTERN = /slash|begins?|starts?/i;

type RuntimeContext = Record<string, unknown> & {
  /** OpenAPI metadata merged with the method and original path template. */
  openapi?: Record<string, unknown>;
};

export type RuntimeOptions = Options & {
  /** Values substituted into brace-delimited URL path tokens. */
  path?: Record<string, PathParameterValue>;
  /** Type-only cookie parameters; never serialized into request headers. */
  cookie?: Record<string, unknown>;
  /** Caller context retained alongside generated OpenAPI metadata. */
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

/**
 * @description Lowercases an HTTP method for OpenAPI context, defaulting to GET.
 * @param {string} [method] - HTTP method to normalize.
 * @returns {string} Lowercase method, or "get" when omitted.
 * @example
 * toOpenApiMethod('POST'); // 'post'
 */
export const toOpenApiMethod = (method?: string): string => (method ?? 'GET').toLowerCase();

/**
 * @description Substitutes URL-encoded path values into brace-delimited tokens.
 * Throws when a template token has no supplied value; URLs without tokens pass through.
 * @param {string} template - URL template containing tokens such as "{id}".
 * @param {Record<string, PathParameterValue>} [path] - Values indexed by trimmed token names.
 * @returns {string} Template with every token replaced by its encoded value.
 * @example
 * interpolatePathTemplate('/users/{id}', { id: 'a/b' }); // '/users/a%2Fb'
 */
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

/**
 * @description Identifies synchronous ky prefixUrl errors caused by a leading slash.
 * @param {unknown} error - Thrown value to inspect.
 * @returns {boolean} Whether the value is an Error with ky's prefixUrl slash diagnostic.
 * @example
 * isKyPrefixUrlLeadingSlashError(new Error('prefixUrl input must not begin with a slash'));
 */
export const isKyPrefixUrlLeadingSlashError = (error: unknown): error is Error =>
  error instanceof Error &&
  error.message.includes(KY_PREFIX_URL_ERROR_PREFIX) &&
  KY_LEADING_SLASH_ERROR_PATTERN.test(error.message);

/**
 * @description Removes one leading slash from string input while preserving URL and Request objects.
 * @param {Input} input - ky-compatible request input.
 * @returns {Input} Input without its first slash, or the original input when no string slash exists.
 * @example
 * stripLeadingSlash('/users'); // 'users'
 */
export const stripLeadingSlash = (input: Input): Input => {
  if (typeof input !== 'string' || !input.startsWith('/')) {
    return input;
  }

  return input.slice(1);
};

/**
 * @description Interpolates path tokens and attaches OpenAPI context before passing options to ky.
 * Removes facade-only path and cookie options. Path values require string input.
 * @param {{ input: Input; method: string; options?: Options }} request - Request preparation arguments.
 * @param {Input} request.input - URL template, URL object or Request.
 * @param {string} request.method - Method stored in OpenAPI context.
 * @param {Options} [request.options] - ky options, possibly carrying internal facade path values.
 * @returns {{ input: Input; options: Options | undefined }} Prepared transport arguments.
 * - input `Input` - Original input or interpolated string URL.
 * - options `Options | undefined` - Copied options with facade fields removed and context merged.
 * @example
 * prepareKyRequest({ input: '/users', method: 'get', options: { headers: { accept: 'application/json' } } });
 */
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

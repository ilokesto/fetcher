import ky, { type Input, type KyInstance, type Options, type ResponsePromise } from 'ky';
import {
  isKyPrefixUrlLeadingSlashError,
  normalizeGroupedRequestOptions,
  prepareKyRequest,
  stripLeadingSlash,
  toOpenApiMethod,
  type GroupedRequest,
} from '../internal/runtime';
import type { PathsLike, SafeResult, Fetcher } from '../openapi/types';

type ShortcutMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
type SafeShortcutMethod = ShortcutMethod;
type SafeResponse<Json = unknown> = Awaited<ResponsePromise<Json>>;

const executeKyCall = <Result>(
  input: Input,
  options: Options | undefined,
  runner: (nextInput: Input, nextOptions: Options | undefined) => Result,
): Result => {
  try {
    return runner(input, options);
  } catch (error) {
    if (isKyPrefixUrlLeadingSlashError(error) && typeof input === 'string' && input.startsWith('/')) {
      return runner(stripLeadingSlash(input), options);
    }

    throw error;
  }
};

const readResponseFromError = <Json>(error: unknown): SafeResponse<Json> | null => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    error.response instanceof Response
  ) {
    return error.response as SafeResponse<Json>;
  }

  return null;
};

const resolveSafeResult = async <Json>(
  runner: () => ResponsePromise<Json>,
): Promise<SafeResult<Json>> => {
  let response: SafeResponse<Json> | null = null;

  try {
    const responsePromise = runner();
    const dataPromise = responsePromise.json<Json>();
    void dataPromise.catch(() => {});

    response = await responsePromise;

    return {
      ok: true,
      data: await dataPromise,
      error: null,
      response,
    };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error,
      response: response ?? readResponseFromError<Json>(error),
    };
  }
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readCompatibilityParams = (value: Record<string, unknown>): GroupedRequest['params'] | undefined => {
  const params: NonNullable<GroupedRequest['params']> = {};

  if ('path' in value) {
    params.path = value.path as NonNullable<GroupedRequest['params']>['path'];
  }

  if ('query' in value) {
    params.query = value.query as NonNullable<GroupedRequest['params']>['query'];
  }

  if ('cookie' in value) {
    params.cookie = value.cookie as NonNullable<GroupedRequest['params']>['cookie'];
  }

  return Object.keys(params).length > 0 ? params : undefined;
};

const toGroupedRequest = (value: unknown): GroupedRequest | undefined => {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  const compatibilityParams = readCompatibilityParams(value);
  const compatibilityHeaders =
    'header' in value ? (value.header as GroupedRequest['headers']) : undefined;
  const groupedRequest: GroupedRequest = {};
  let hasGroupedRequest = false;

  if ('params' in value) {
    groupedRequest.params = value.params as GroupedRequest['params'];
    hasGroupedRequest = true;
  } else if (compatibilityParams) {
    groupedRequest.params = compatibilityParams;
    hasGroupedRequest = true;
  }

  if ('headers' in value) {
    groupedRequest.headers = value.headers as GroupedRequest['headers'];
    hasGroupedRequest = true;
  } else if (compatibilityHeaders) {
    groupedRequest.headers = compatibilityHeaders;
    hasGroupedRequest = true;
  }

  if ('json' in value) {
    groupedRequest.json = value.json;
    hasGroupedRequest = true;
  }

  if ('formData' in value) {
    groupedRequest.formData = value.formData;
    hasGroupedRequest = true;
  }

  if ('formUrlEncoded' in value) {
    groupedRequest.formUrlEncoded = value.formUrlEncoded;
    hasGroupedRequest = true;
  }

  return hasGroupedRequest ? groupedRequest : undefined;
};

const prepareShortcutRequest = ({
  input,
  method,
  request,
  options,
}: {
  input: Input;
  method: string;
  request?: unknown;
  options?: Options;
}) => {
  const runtimeOptions =
    typeof input === 'string'
      ? normalizeGroupedRequestOptions({
          request: toGroupedRequest(request),
          options,
        })
      : (request as Options | undefined);

  return prepareKyRequest({
    input,
    method,
    options: runtimeOptions,
  });
};

const bindShortcutMethod = <Paths extends PathsLike, Method extends ShortcutMethod>(
  instance: KyInstance,
  method: Method,
): Fetcher<Paths>[Method] => {
  return ((input: Input, request?: unknown, options?: Options) => {
    const preparedRequest = prepareShortcutRequest({
      input,
      method,
      request,
      options,
    });

    return executeKyCall(preparedRequest.input, preparedRequest.options, (nextInput, nextOptions) =>
      instance[method](nextInput, nextOptions),
    );
  }) as Fetcher<Paths>[Method];
};

const bindHeadMethod = <Paths extends PathsLike>(instance: KyInstance): Fetcher<Paths>['head'] => {
  return ((input: Input, request?: unknown, options?: Options) => {
    const usesGroupedRequest = isObjectRecord(request) && ('params' in request || options !== undefined);
    const runtimeOptions = usesGroupedRequest
      ? normalizeGroupedRequestOptions({ request: toGroupedRequest(request), options })
      : (request as Options | undefined);
    const preparedRequest = prepareKyRequest({
      input,
      method: 'head',
      options: runtimeOptions,
    });

    return executeKyCall(preparedRequest.input, preparedRequest.options, (nextInput, nextOptions) =>
      instance.head(nextInput, nextOptions),
    );
  }) as Fetcher<Paths>['head'];
};

const bindSafeShortcutMethod = <Paths extends PathsLike, Method extends SafeShortcutMethod>(
  instance: KyInstance,
  method: Method,
): Fetcher<Paths>['safe'][Method] => {
  return (async (input: Input, request?: unknown, options?: Options) => {
    return resolveSafeResult(() => {
      const preparedRequest = prepareShortcutRequest({
        input,
        method,
        request,
        options,
      });

      return executeKyCall(preparedRequest.input, preparedRequest.options, (nextInput, nextOptions) =>
        instance[method](nextInput, nextOptions),
      );
    });
  }) as Fetcher<Paths>['safe'][Method];
};

const decorateKyInstance = <Paths extends PathsLike>(instance: KyInstance): Fetcher<Paths> => {
  let defaultOptions: Options = {};
  // The extend callback is ky's public access to defaults, including wrapped instances.
  instance.extend((defaults) => {
    defaultOptions = defaults;
    return {};
  });

  const call = (input: Input, options?: Options) => {
    const method = options && Object.hasOwn(options, 'method') ? options.method : defaultOptions.method;
    const request = prepareKyRequest({
      input,
      method: toOpenApiMethod(method ?? (input instanceof Request ? input.method : undefined)),
      options,
    });

    return executeKyCall(request.input, request.options, (nextInput, nextOptions) =>
      instance(nextInput, nextOptions),
    );
  };
  const fetcher = call as Fetcher<Paths>;

  fetcher.safe = ((input: Input, options?: Options) => {
    return resolveSafeResult(() => call(input, options));
  }) as Fetcher<Paths>['safe'];

  fetcher.safe.get = bindSafeShortcutMethod<Paths, 'get'>(instance, 'get');
  fetcher.safe.post = bindSafeShortcutMethod<Paths, 'post'>(instance, 'post');
  fetcher.safe.put = bindSafeShortcutMethod<Paths, 'put'>(instance, 'put');
  fetcher.safe.patch = bindSafeShortcutMethod<Paths, 'patch'>(instance, 'patch');
  fetcher.safe.delete = bindSafeShortcutMethod<Paths, 'delete'>(instance, 'delete');

  fetcher.get = bindShortcutMethod<Paths, 'get'>(instance, 'get');
  fetcher.post = bindShortcutMethod<Paths, 'post'>(instance, 'post');
  fetcher.put = bindShortcutMethod<Paths, 'put'>(instance, 'put');
  fetcher.patch = bindShortcutMethod<Paths, 'patch'>(instance, 'patch');
  fetcher.delete = bindShortcutMethod<Paths, 'delete'>(instance, 'delete');
  fetcher.head = bindHeadMethod<Paths>(instance);
  Object.defineProperty(fetcher, 'stop', {
    value: instance.stop,
    enumerable: true,
    configurable: true,
    writable: false,
  });
  Object.defineProperty(fetcher, 'retry', {
    value: instance.retry,
    enumerable: true,
    configurable: true,
    writable: false,
  });

  fetcher.create = ((defaultOptions?: Options) => {
    return decorateKyInstance<Paths>(instance.create(defaultOptions));
  }) as Fetcher<Paths>['create'];

  fetcher.extend = ((defaultOptions: Parameters<KyInstance['extend']>[0]) => {
    return decorateKyInstance<Paths>(instance.extend(defaultOptions));
  }) as Fetcher<Paths>['extend'];

  return fetcher;
};

/**
 * @description Creates an OpenAPI-aware ky facade from defaults or an existing ky instance.
 * Requests preserve ky's lazy response parsing; safe requests eagerly parse JSON and
 * capture preparation, transport and parsing errors. Derived clients keep the facade.
 * Registered typed paths require an explicit method on callable and safe callable requests,
 * even with GET defaults; shortcuts select their own method.
 * @param {Options} defaultOptions - Defaults passed to ky.create when using the options overload.
 * @param {KyInstance} instance - Existing ky instance to wrap without replacing its defaults.
 * @returns {Fetcher<Paths>} A callable client with typed routes and these owned controls.
 * - safe `FetcherSafe<Paths>` - Eager JSON requests returning a discriminated SafeResult without throwing.
 * : safe.get `SafeTypedShortcutMethod<Paths, 'get'>` - Performs a safe grouped GET request.
 * : safe.post `SafeTypedShortcutMethod<Paths, 'post'>` - Performs a safe grouped POST request.
 * : safe.put `SafeTypedShortcutMethod<Paths, 'put'>` - Performs a safe grouped PUT request.
 * : safe.patch `SafeTypedShortcutMethod<Paths, 'patch'>` - Performs a safe grouped PATCH request.
 * : safe.delete `SafeTypedShortcutMethod<Paths, 'delete'>` - Performs a safe grouped DELETE request.
 * - get `TypedShortcutMethod<Paths, 'get'>` - Starts a grouped GET request and returns a ResponsePromise with deferred body parsing.
 * - post `TypedShortcutMethod<Paths, 'post'>` - Starts a grouped POST request and returns a ResponsePromise with deferred body parsing.
 * - put `TypedShortcutMethod<Paths, 'put'>` - Starts a grouped PUT request and returns a ResponsePromise with deferred body parsing.
 * - patch `TypedShortcutMethod<Paths, 'patch'>` - Starts a grouped PATCH request and returns a ResponsePromise with deferred body parsing.
 * - delete `TypedShortcutMethod<Paths, 'delete'>` - Starts a grouped DELETE request and returns a ResponsePromise with deferred body parsing.
 * - head `TypedHeadMethod<Paths>` - Starts a HEAD request and returns a ResponsePromise; no safe HEAD shortcut is provided.
 * - create `(defaultOptions?: Options) => Fetcher<Paths>` - Creates a facade with replacement defaults.
 * - extend `(defaultOptions: Parameters<KyInstance['extend']>[0]) => Fetcher<Paths>` - Creates a facade with merged defaults.
 * @example
 * ```ts
 * const api = createFetcher({ prefixUrl: 'https://api.example.com' });
 * const user = await api.get('/users/{id}', { params: { path: { id: '42' } } }).json();
 * const result = await api.safe.get('/users', {});
 * if (result.ok) console.log(result.data);
 * ```
 */
export function createFetcher<Paths extends PathsLike>(): Fetcher<Paths>;
export function createFetcher<Paths extends PathsLike>(defaultOptions: Options): Fetcher<Paths>;
export function createFetcher<Paths extends PathsLike>(instance: KyInstance): Fetcher<Paths>;
export function createFetcher<Paths extends PathsLike>(input?: Options | KyInstance): Fetcher<Paths> {
  const instance = typeof input === 'function' ? input : ky.create(input);

  return decorateKyInstance<Paths>(instance);
}

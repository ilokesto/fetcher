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

type ShortcutMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head';
type SafeShortcutMethod = Exclude<ShortcutMethod, 'head'>;
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

const toCompatibilityGroupedRequest = (value: Record<string, unknown>): GroupedRequest => {
  const groupedRequest: GroupedRequest = {};
  const params = readCompatibilityParams(value);

  if (params) {
    groupedRequest.params = params;
  }

  if ('header' in value) {
    groupedRequest.headers = value.header as GroupedRequest['headers'];
  }

  return groupedRequest;
};

const toGroupedRequest = (value: unknown): GroupedRequest | undefined => {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  const compatibilityRequest = toCompatibilityGroupedRequest(value);
  const groupedRequest: GroupedRequest = {};
  let hasGroupedRequest = false;

  if ('params' in value) {
    groupedRequest.params = value.params as GroupedRequest['params'];
    hasGroupedRequest = true;
  } else if (compatibilityRequest.params) {
    groupedRequest.params = compatibilityRequest.params;
    hasGroupedRequest = true;
  }

  if ('headers' in value) {
    groupedRequest.headers = value.headers as GroupedRequest['headers'];
    hasGroupedRequest = true;
  } else if (compatibilityRequest.headers) {
    groupedRequest.headers = compatibilityRequest.headers;
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

const bindShortcutMethod = (instance: KyInstance, method: ShortcutMethod): Fetcher<PathsLike>[ShortcutMethod] => {
  return ((input: Input, request?: unknown, options?: Options) => {
    if (method === 'head') {
      const preparedRequest = prepareKyRequest({
        input,
        method: 'head',
        options: request as Options | undefined,
      });

      return executeKyCall(preparedRequest.input, preparedRequest.options, (nextInput, nextOptions) =>
        instance.head(nextInput, nextOptions),
      );
    }

    const preparedRequest = prepareShortcutRequest({
      input,
      method,
      request,
      options,
    });

    return executeKyCall(preparedRequest.input, preparedRequest.options, (nextInput, nextOptions) =>
      instance[method](nextInput, nextOptions),
    );
  }) as Fetcher<PathsLike>[ShortcutMethod];
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
  const fetcher = ((input: Input, options?: Options) => {
    const request = prepareKyRequest({
      input,
      method: toOpenApiMethod(options?.method),
      options,
    });

    return executeKyCall(request.input, request.options, (nextInput, nextOptions) =>
      instance(nextInput, nextOptions),
    );
  }) as Fetcher<Paths>;

  fetcher.safe = (async (input: Input, options?: Options) => {
    return resolveSafeResult(() => {
      const request = prepareKyRequest({
        input,
        method: toOpenApiMethod(options?.method),
        options,
      });

      return executeKyCall(request.input, request.options, (nextInput, nextOptions) =>
        instance(nextInput, nextOptions),
      );
    });
  }) as Fetcher<Paths>['safe'];

  fetcher.safe.get = bindSafeShortcutMethod<Paths, 'get'>(instance, 'get');
  fetcher.safe.post = bindSafeShortcutMethod<Paths, 'post'>(instance, 'post');
  fetcher.safe.put = bindSafeShortcutMethod<Paths, 'put'>(instance, 'put');
  fetcher.safe.patch = bindSafeShortcutMethod<Paths, 'patch'>(instance, 'patch');
  fetcher.safe.delete = bindSafeShortcutMethod<Paths, 'delete'>(instance, 'delete');

  fetcher.get = bindShortcutMethod(instance, 'get') as Fetcher<Paths>['get'];
  fetcher.post = bindShortcutMethod(instance, 'post') as Fetcher<Paths>['post'];
  fetcher.put = bindShortcutMethod(instance, 'put') as Fetcher<Paths>['put'];
  fetcher.patch = bindShortcutMethod(instance, 'patch') as Fetcher<Paths>['patch'];
  fetcher.delete = bindShortcutMethod(instance, 'delete') as Fetcher<Paths>['delete'];
  fetcher.head = bindShortcutMethod(instance, 'head') as Fetcher<Paths>['head'];
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

export function createFetcher<Paths extends PathsLike>(): Fetcher<Paths>;
export function createFetcher<Paths extends PathsLike>(defaultOptions: Options): Fetcher<Paths>;
export function createFetcher<Paths extends PathsLike>(instance: KyInstance): Fetcher<Paths>;
export function createFetcher<Paths extends PathsLike>(input?: Options | KyInstance): Fetcher<Paths> {
  const instance = typeof input === 'function' ? input : ky.create(input);

  return decorateKyInstance<Paths>(instance);
}

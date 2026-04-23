import ky, { type Input, type KyInstance, type Options, type ResponsePromise } from 'ky';
import {
  isKyPrefixUrlLeadingSlashError,
  normalizeGroupedRequestOptions,
  prepareKyRequest,
  stripLeadingSlash,
  toOpenApiMethod,
  type GroupedRequest,
} from '../internal/runtime';
import type { PathsLike, SafeResult, TypedKy } from '../openapi/types';

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

const toGroupedRequest = (value: unknown): GroupedRequest | undefined => {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  const groupedRequest: GroupedRequest = {};
  let hasGroupedRequest = false;

  if ('params' in value) {
    groupedRequest.params = value.params as GroupedRequest['params'];
    hasGroupedRequest = true;
  } else {
    const params: NonNullable<GroupedRequest['params']> = {};

    if ('path' in value) {
      params.path = value.path as NonNullable<GroupedRequest['params']>['path'];
      hasGroupedRequest = true;
    }

    if ('query' in value) {
      params.query = value.query as NonNullable<GroupedRequest['params']>['query'];
      hasGroupedRequest = true;
    }

    if ('cookie' in value) {
      params.cookie = value.cookie as NonNullable<GroupedRequest['params']>['cookie'];
      hasGroupedRequest = true;
    }

    if (Object.keys(params).length > 0) {
      groupedRequest.params = params;
    }
  }

  if ('headers' in value) {
    groupedRequest.headers = value.headers as GroupedRequest['headers'];
    hasGroupedRequest = true;
  } else if ('header' in value) {
    groupedRequest.headers = value.header as GroupedRequest['headers'];
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

const bindShortcutMethod = (instance: KyInstance, method: ShortcutMethod): TypedKy<PathsLike>[ShortcutMethod] => {
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
  }) as TypedKy<PathsLike>[ShortcutMethod];
};

const bindSafeShortcutMethod = <Paths extends PathsLike, Method extends SafeShortcutMethod>(
  instance: KyInstance,
  method: Method,
): TypedKy<Paths>['safe'][Method] => {
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
  }) as TypedKy<Paths>['safe'][Method];
};

const decorateKyInstance = <Paths extends PathsLike>(instance: KyInstance): TypedKy<Paths> => {
  const typedKy = ((input: Input, options?: Options) => {
    const request = prepareKyRequest({
      input,
      method: toOpenApiMethod(options?.method),
      options,
    });

    return executeKyCall(request.input, request.options, (nextInput, nextOptions) =>
      instance(nextInput, nextOptions),
    );
  }) as TypedKy<Paths>;

  typedKy.safe = (async (input: Input, options?: Options) => {
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
  }) as TypedKy<Paths>['safe'];

  typedKy.safe.get = bindSafeShortcutMethod<Paths, 'get'>(instance, 'get');
  typedKy.safe.post = bindSafeShortcutMethod<Paths, 'post'>(instance, 'post');
  typedKy.safe.put = bindSafeShortcutMethod<Paths, 'put'>(instance, 'put');
  typedKy.safe.patch = bindSafeShortcutMethod<Paths, 'patch'>(instance, 'patch');
  typedKy.safe.delete = bindSafeShortcutMethod<Paths, 'delete'>(instance, 'delete');

  typedKy.get = bindShortcutMethod(instance, 'get') as TypedKy<Paths>['get'];
  typedKy.post = bindShortcutMethod(instance, 'post') as TypedKy<Paths>['post'];
  typedKy.put = bindShortcutMethod(instance, 'put') as TypedKy<Paths>['put'];
  typedKy.patch = bindShortcutMethod(instance, 'patch') as TypedKy<Paths>['patch'];
  typedKy.delete = bindShortcutMethod(instance, 'delete') as TypedKy<Paths>['delete'];
  typedKy.head = bindShortcutMethod(instance, 'head') as TypedKy<Paths>['head'];
  Object.defineProperty(typedKy, 'stop', {
    value: instance.stop,
    enumerable: true,
    configurable: true,
    writable: false,
  });
  Object.defineProperty(typedKy, 'retry', {
    value: instance.retry,
    enumerable: true,
    configurable: true,
    writable: false,
  });

  typedKy.create = ((defaultOptions?: Options) => {
    return decorateKyInstance<Paths>(instance.create(defaultOptions));
  }) as TypedKy<Paths>['create'];

  typedKy.extend = ((defaultOptions: Parameters<KyInstance['extend']>[0]) => {
    return decorateKyInstance<Paths>(instance.extend(defaultOptions));
  }) as TypedKy<Paths>['extend'];

  return typedKy;
};

export function createTypedKy<Paths extends PathsLike>(): TypedKy<Paths>;
export function createTypedKy<Paths extends PathsLike>(defaultOptions: Options): TypedKy<Paths>;
export function createTypedKy<Paths extends PathsLike>(instance: KyInstance): TypedKy<Paths>;
export function createTypedKy<Paths extends PathsLike>(input?: Options | KyInstance): TypedKy<Paths> {
  const instance = typeof input === 'function' ? input : ky.create(input);

  return decorateKyInstance<Paths>(instance);
}

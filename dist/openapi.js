// src/core/createFetcher.ts
import ky from "ky";

// src/internal/runtime.ts
var KY_PREFIX_URL_LEADING_SLASH_ERROR = "`input` must not begin with a slash when using `prefixUrl`";
var PATH_TOKEN_PATTERN = /\{([^}]+)\}/g;
var hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
var isStrictPlainObject = (value) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
var applyHeaders = (headers, source) => {
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
      if (value !== void 0) {
        headers.set(key, value);
      }
    });
    return;
  }
  Object.entries(source).forEach(([key, value]) => {
    if (value !== void 0) {
      headers.set(key, value);
    }
  });
};
var mergeHeaders = (requestHeaders, explicitHeaders) => {
  if (!requestHeaders && !explicitHeaders) {
    return void 0;
  }
  const mergedHeaders = new Headers();
  applyHeaders(mergedHeaders, requestHeaders);
  applyHeaders(mergedHeaders, explicitHeaders);
  return mergedHeaders;
};
var appendFormDataValue = (formData, key, value) => {
  if (value === void 0) {
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
var toFormDataBody = (value) => {
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
var resolveJson = (requestJson, explicitJson) => {
  if (requestJson === void 0) {
    return explicitJson;
  }
  if (explicitJson === void 0) {
    return requestJson;
  }
  if (isStrictPlainObject(requestJson) && isStrictPlainObject(explicitJson)) {
    return {
      ...requestJson,
      ...explicitJson
    };
  }
  return explicitJson;
};
var normalizeGroupedRequestOptions = ({
  request,
  options
}) => {
  if (!request && !options) {
    return void 0;
  }
  const runtimeOptions = options ? { ...options } : {};
  const requestParams = request?.params;
  if (requestParams?.path) {
    runtimeOptions.path = requestParams.path;
  }
  if (requestParams && hasOwn(requestParams, "query")) {
    runtimeOptions.searchParams = requestParams.query;
  }
  const mergedHeaders = mergeHeaders(request?.headers, options?.headers);
  if (mergedHeaders) {
    runtimeOptions.headers = mergedHeaders;
  } else {
    delete runtimeOptions.headers;
  }
  delete runtimeOptions.json;
  delete runtimeOptions.body;
  if (request && hasOwn(request, "formData")) {
    if (options?.body !== void 0) {
      runtimeOptions.body = options.body;
    } else if (options?.json !== void 0) {
      runtimeOptions.json = options.json;
    } else {
      runtimeOptions.body = toFormDataBody(request.formData);
    }
    return runtimeOptions;
  }
  if (request && hasOwn(request, "json")) {
    if (options?.body !== void 0) {
      runtimeOptions.body = options.body;
      return runtimeOptions;
    }
    const resolvedJson = resolveJson(request.json, options?.json);
    if (resolvedJson !== void 0) {
      runtimeOptions.json = resolvedJson;
    }
    return runtimeOptions;
  }
  if (options?.body !== void 0) {
    runtimeOptions.body = options.body;
  }
  if (options?.json !== void 0) {
    runtimeOptions.json = options.json;
  }
  return runtimeOptions;
};
var readOpenApiContext = (context) => {
  const openapi = context?.openapi;
  if (openapi && typeof openapi === "object" && !Array.isArray(openapi)) {
    return openapi;
  }
  return {};
};
var toOpenApiMethod = (method) => (method ?? "GET").toLowerCase();
var interpolatePathTemplate = (template, path) => {
  const matches = [...template.matchAll(PATH_TOKEN_PATTERN)];
  if (matches.length === 0) {
    return template;
  }
  if (!path) {
    throw new Error(`Missing path parameters for template: ${template}`);
  }
  return template.replace(PATH_TOKEN_PATTERN, (_match, rawKey) => {
    const key = rawKey.trim();
    const value = path[key];
    if (value === void 0) {
      throw new Error(`Missing path parameter "${key}" for template: ${template}`);
    }
    return encodeURIComponent(String(value));
  });
};
var isKyPrefixUrlLeadingSlashError = (error) => error instanceof Error && error.message === KY_PREFIX_URL_LEADING_SLASH_ERROR;
var stripLeadingSlash = (input) => {
  if (typeof input !== "string" || !input.startsWith("/")) {
    return input;
  }
  return input.slice(1);
};
var prepareKyRequest = ({
  input,
  method,
  options
}) => {
  const runtimeOptions = options ? { ...options } : void 0;
  const path = runtimeOptions?.path;
  if (path && typeof input !== "string") {
    throw new Error("The OpenAPI path option can only be used with string URL templates.");
  }
  const interpolatedInput = typeof input === "string" ? interpolatePathTemplate(input, path) : input;
  if (!runtimeOptions) {
    if (typeof input !== "string") {
      return { input: interpolatedInput, options: void 0 };
    }
    return {
      input: interpolatedInput,
      options: {
        context: {
          openapi: {
            method,
            pathTemplate: input
          }
        }
      }
    };
  }
  delete runtimeOptions.path;
  runtimeOptions.context = {
    ...runtimeOptions.context,
    openapi: {
      ...readOpenApiContext(runtimeOptions.context),
      method,
      ...typeof input === "string" ? { pathTemplate: input } : {}
    }
  };
  return {
    input: interpolatedInput,
    options: runtimeOptions
  };
};

// src/core/createFetcher.ts
var executeKyCall = (input, options, runner) => {
  try {
    return runner(input, options);
  } catch (error) {
    if (isKyPrefixUrlLeadingSlashError(error) && typeof input === "string" && input.startsWith("/")) {
      return runner(stripLeadingSlash(input), options);
    }
    throw error;
  }
};
var readResponseFromError = (error) => {
  if (typeof error === "object" && error !== null && "response" in error && error.response instanceof Response) {
    return error.response;
  }
  return null;
};
var resolveSafeResult = async (runner) => {
  let response = null;
  try {
    const responsePromise = runner();
    const dataPromise = responsePromise.json();
    void dataPromise.catch(() => {
    });
    response = await responsePromise;
    return {
      ok: true,
      data: await dataPromise,
      error: null,
      response
    };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error,
      response: response ?? readResponseFromError(error)
    };
  }
};
var isObjectRecord = (value) => typeof value === "object" && value !== null;
var toGroupedRequest = (value) => {
  if (!isObjectRecord(value)) {
    return void 0;
  }
  const groupedRequest = {};
  let hasGroupedRequest = false;
  if ("params" in value) {
    groupedRequest.params = value.params;
    hasGroupedRequest = true;
  } else {
    const params = {};
    if ("path" in value) {
      params.path = value.path;
      hasGroupedRequest = true;
    }
    if ("query" in value) {
      params.query = value.query;
      hasGroupedRequest = true;
    }
    if ("cookie" in value) {
      params.cookie = value.cookie;
      hasGroupedRequest = true;
    }
    if (Object.keys(params).length > 0) {
      groupedRequest.params = params;
    }
  }
  if ("headers" in value) {
    groupedRequest.headers = value.headers;
    hasGroupedRequest = true;
  } else if ("header" in value) {
    groupedRequest.headers = value.header;
    hasGroupedRequest = true;
  }
  if ("json" in value) {
    groupedRequest.json = value.json;
    hasGroupedRequest = true;
  }
  if ("formData" in value) {
    groupedRequest.formData = value.formData;
    hasGroupedRequest = true;
  }
  return hasGroupedRequest ? groupedRequest : void 0;
};
var prepareShortcutRequest = ({
  input,
  method,
  request,
  options
}) => {
  const runtimeOptions = typeof input === "string" ? normalizeGroupedRequestOptions({
    request: toGroupedRequest(request),
    options
  }) : request;
  return prepareKyRequest({
    input,
    method,
    options: runtimeOptions
  });
};
var prepareHeadRequest = ({
  input,
  request
}) => {
  return prepareKyRequest({
    input,
    method: "head",
    options: request
  });
};
var bindShortcutMethod = (instance, method) => {
  return ((input, request, options) => {
    if (method === "head") {
      const preparedRequest2 = prepareHeadRequest({
        input,
        request
      });
      return executeKyCall(
        preparedRequest2.input,
        preparedRequest2.options,
        (nextInput, nextOptions) => instance.head(nextInput, nextOptions)
      );
    }
    const preparedRequest = prepareShortcutRequest({
      input,
      method,
      request,
      options
    });
    return executeKyCall(
      preparedRequest.input,
      preparedRequest.options,
      (nextInput, nextOptions) => instance[method](nextInput, nextOptions)
    );
  });
};
var bindSafeShortcutMethod = (instance, method) => {
  return (async (input, request, options) => {
    return resolveSafeResult(() => {
      const preparedRequest = prepareShortcutRequest({
        input,
        method,
        request,
        options
      });
      return executeKyCall(
        preparedRequest.input,
        preparedRequest.options,
        (nextInput, nextOptions) => instance[method](nextInput, nextOptions)
      );
    });
  });
};
var decorateKyInstance = (instance) => {
  const fetcher = ((input, options) => {
    const request = prepareKyRequest({
      input,
      method: toOpenApiMethod(options?.method),
      options
    });
    return executeKyCall(
      request.input,
      request.options,
      (nextInput, nextOptions) => instance(nextInput, nextOptions)
    );
  });
  fetcher.safe = (async (input, options) => {
    return resolveSafeResult(() => {
      const request = prepareKyRequest({
        input,
        method: toOpenApiMethod(options?.method),
        options
      });
      return executeKyCall(
        request.input,
        request.options,
        (nextInput, nextOptions) => instance(nextInput, nextOptions)
      );
    });
  });
  fetcher.safe.get = bindSafeShortcutMethod(instance, "get");
  fetcher.safe.post = bindSafeShortcutMethod(instance, "post");
  fetcher.safe.put = bindSafeShortcutMethod(instance, "put");
  fetcher.safe.patch = bindSafeShortcutMethod(instance, "patch");
  fetcher.safe.delete = bindSafeShortcutMethod(instance, "delete");
  fetcher.get = bindShortcutMethod(instance, "get");
  fetcher.post = bindShortcutMethod(instance, "post");
  fetcher.put = bindShortcutMethod(instance, "put");
  fetcher.patch = bindShortcutMethod(instance, "patch");
  fetcher.delete = bindShortcutMethod(instance, "delete");
  fetcher.head = bindShortcutMethod(instance, "head");
  Object.defineProperty(fetcher, "stop", {
    value: instance.stop,
    enumerable: true,
    configurable: true,
    writable: false
  });
  Object.defineProperty(fetcher, "retry", {
    value: instance.retry,
    enumerable: true,
    configurable: true,
    writable: false
  });
  fetcher.create = ((defaultOptions) => {
    return decorateKyInstance(instance.create(defaultOptions));
  });
  fetcher.extend = ((defaultOptions) => {
    return decorateKyInstance(instance.extend(defaultOptions));
  });
  return fetcher;
};
function createFetcher(input) {
  const instance = typeof input === "function" ? input : ky.create(input);
  return decorateKyInstance(instance);
}
export {
  createFetcher
};
//# sourceMappingURL=openapi.js.map
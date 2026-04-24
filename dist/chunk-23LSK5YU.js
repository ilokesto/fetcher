// src/core/createFetcher.ts
import ky from "ky";

// src/internal/runtime.ts
var KY_PREFIX_URL_ERROR_PREFIX = "prefixUrl";
var KY_LEADING_SLASH_ERROR_PATTERN = /slash|begins?|starts?/i;
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
var appendUrlSearchParamsValue = (searchParams, key, value) => {
  if (value === void 0) {
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
var toUrlSearchParamsBody = (value) => {
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
  if (options?.body !== void 0) {
    runtimeOptions.body = options.body;
    return runtimeOptions;
  }
  if (request && hasOwn(request, "formData")) {
    if (options?.json !== void 0) {
      runtimeOptions.json = options.json;
    } else {
      runtimeOptions.body = toFormDataBody(request.formData);
    }
    return runtimeOptions;
  }
  if (request && hasOwn(request, "formUrlEncoded")) {
    if (options?.json !== void 0) {
      runtimeOptions.json = options.json;
    } else {
      runtimeOptions.body = toUrlSearchParamsBody(request.formUrlEncoded);
    }
    return runtimeOptions;
  }
  if (request && hasOwn(request, "json")) {
    const resolvedJson = resolveJson(request.json, options?.json);
    if (resolvedJson !== void 0) {
      runtimeOptions.json = resolvedJson;
    }
    return runtimeOptions;
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
var isKyPrefixUrlLeadingSlashError = (error) => error instanceof Error && error.message.includes(KY_PREFIX_URL_ERROR_PREFIX) && KY_LEADING_SLASH_ERROR_PATTERN.test(error.message);
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
var readCompatibilityParams = (value) => {
  const params = {};
  if ("path" in value) {
    params.path = value.path;
  }
  if ("query" in value) {
    params.query = value.query;
  }
  if ("cookie" in value) {
    params.cookie = value.cookie;
  }
  return Object.keys(params).length > 0 ? params : void 0;
};
var toCompatibilityGroupedRequest = (value) => {
  const groupedRequest = {};
  const params = readCompatibilityParams(value);
  if (params) {
    groupedRequest.params = params;
  }
  if ("header" in value) {
    groupedRequest.headers = value.header;
  }
  return groupedRequest;
};
var toGroupedRequest = (value) => {
  if (!isObjectRecord(value)) {
    return void 0;
  }
  const compatibilityRequest = toCompatibilityGroupedRequest(value);
  const groupedRequest = {};
  let hasGroupedRequest = false;
  if ("params" in value) {
    groupedRequest.params = value.params;
    hasGroupedRequest = true;
  } else if (compatibilityRequest.params) {
    groupedRequest.params = compatibilityRequest.params;
    hasGroupedRequest = true;
  }
  if ("headers" in value) {
    groupedRequest.headers = value.headers;
    hasGroupedRequest = true;
  } else if (compatibilityRequest.headers) {
    groupedRequest.headers = compatibilityRequest.headers;
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
  if ("formUrlEncoded" in value) {
    groupedRequest.formUrlEncoded = value.formUrlEncoded;
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
var bindShortcutMethod = (instance, method) => {
  return ((input, request, options) => {
    if (method === "head") {
      const preparedRequest2 = prepareKyRequest({
        input,
        method: "head",
        options: request
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
//# sourceMappingURL=chunk-23LSK5YU.js.map
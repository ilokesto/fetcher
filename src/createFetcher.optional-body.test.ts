import { describe, expectTypeOf, it } from 'vitest';
import type { Fetcher, OpenApiOptions, OpenApiRequest } from './openapi';
import type { RequestBodyRequired } from './openapi/bodies';

type Payload = { name: string };
type JsonBody = { content: { 'application/json': Payload } };
type MultipartBody = { content: { 'multipart/form-data': Payload } };
type UrlEncodedBody = { content: { 'application/x-www-form-urlencoded': Payload } };
type MultipleBody = {
  content: JsonBody['content'] & MultipartBody['content'] & UrlEncodedBody['content'];
};
type OptionalBodyPaths = {
  '/optional/json': { post: { requestBody?: JsonBody } };
  '/required/json': { post: { requestBody: JsonBody } };
  '/optional/multipart': { post: { requestBody?: MultipartBody } };
  '/required/multipart': { post: { requestBody: MultipartBody } };
  '/optional/urlencoded': { post: { requestBody?: UrlEncodedBody } };
  '/required/urlencoded': { post: { requestBody: UrlEncodedBody } };
  '/optional/multiple': { post: { requestBody?: MultipleBody } };
  '/required/multiple': { post: { requestBody: MultipleBody } };
};

type RequestFor<Path extends keyof OptionalBodyPaths> = OpenApiRequest<
  OptionalBodyPaths,
  Path,
  'post'
>;

describe('optional OpenAPI request bodies', () => {
  it('RequestBodyRequired: original optional property -> body remains optional', () => {
    expectTypeOf<RequestBodyRequired<{ requestBody?: JsonBody }>>().toEqualTypeOf<false>();
    expectTypeOf<RequestBodyRequired<{ requestBody?: MultipartBody }>>().toEqualTypeOf<false>();
    expectTypeOf<RequestBodyRequired<{ requestBody?: UrlEncodedBody }>>().toEqualTypeOf<false>();
    expectTypeOf<RequestBodyRequired<{ requestBody: JsonBody }>>().toEqualTypeOf<true>();
    expectTypeOf<RequestBodyRequired<{ requestBody: MultipartBody }>>().toEqualTypeOf<true>();
    expectTypeOf<RequestBodyRequired<{ requestBody: UrlEncodedBody }>>().toEqualTypeOf<true>();
    expectTypeOf<RequestBodyRequired<{}>>().toEqualTypeOf<false>();
  });

  it('OpenApiRequest: optional body media types -> empty requests and matching payloads accepted', () => {
    expectTypeOf<{}>().toMatchTypeOf<RequestFor<'/optional/json'>>();
    expectTypeOf<{}>().toMatchTypeOf<RequestFor<'/optional/multipart'>>();
    expectTypeOf<{}>().toMatchTypeOf<RequestFor<'/optional/urlencoded'>>();
    expectTypeOf<{ json: Payload }>().toMatchTypeOf<RequestFor<'/optional/json'>>();
    expectTypeOf<{ formData: Payload }>().toMatchTypeOf<RequestFor<'/optional/multipart'>>();
    expectTypeOf<{ formUrlEncoded: Payload }>().toMatchTypeOf<RequestFor<'/optional/urlencoded'>>();
    expectTypeOf<{ json: { name: number } }>().not.toMatchTypeOf<RequestFor<'/optional/json'>>();
    expectTypeOf<{ formData: { name: number } }>().not.toMatchTypeOf<
      RequestFor<'/optional/multipart'>
    >();
    expectTypeOf<{ formUrlEncoded: { name: number } }>().not.toMatchTypeOf<
      RequestFor<'/optional/urlencoded'>
    >();
  });

  it('OpenApiRequest: required body media types -> missing payloads rejected', () => {
    expectTypeOf<{}>().not.toMatchTypeOf<RequestFor<'/required/json'>>();
    expectTypeOf<{}>().not.toMatchTypeOf<RequestFor<'/required/multipart'>>();
    expectTypeOf<{}>().not.toMatchTypeOf<RequestFor<'/required/urlencoded'>>();
    expectTypeOf<{ json: Payload }>().toMatchTypeOf<RequestFor<'/required/json'>>();
    expectTypeOf<{ formData: Payload }>().toMatchTypeOf<RequestFor<'/required/multipart'>>();
    expectTypeOf<{ formUrlEncoded: Payload }>().toMatchTypeOf<RequestFor<'/required/urlencoded'>>();
  });

  it('OpenApiRequest: multiple body media types -> exactly one supplied payload accepted', () => {
    expectTypeOf<{}>().toMatchTypeOf<RequestFor<'/optional/multiple'>>();
    expectTypeOf<{}>().not.toMatchTypeOf<RequestFor<'/required/multiple'>>();
    expectTypeOf<{ json: Payload }>().toMatchTypeOf<RequestFor<'/optional/multiple'>>();
    expectTypeOf<{ formData: Payload }>().toMatchTypeOf<RequestFor<'/optional/multiple'>>();
    expectTypeOf<{ formUrlEncoded: Payload }>().toMatchTypeOf<RequestFor<'/optional/multiple'>>();
    expectTypeOf<{ json: Payload }>().toMatchTypeOf<RequestFor<'/required/multiple'>>();
    expectTypeOf<{ formData: Payload }>().toMatchTypeOf<RequestFor<'/required/multiple'>>();
    expectTypeOf<{ formUrlEncoded: Payload }>().toMatchTypeOf<RequestFor<'/required/multiple'>>();
    expectTypeOf<{ json: Payload; formData: Payload }>().not.toMatchTypeOf<
      RequestFor<'/optional/multiple'>
    >();
    expectTypeOf<{ json: Payload; formUrlEncoded: Payload }>().not.toMatchTypeOf<
      RequestFor<'/optional/multiple'>
    >();
    expectTypeOf<{ formData: Payload; formUrlEncoded: Payload }>().not.toMatchTypeOf<
      RequestFor<'/optional/multiple'>
    >();
    expectTypeOf<{ json: Payload; formData: Payload }>().not.toMatchTypeOf<
      RequestFor<'/required/multiple'>
    >();
    expectTypeOf<{ json: Payload; formUrlEncoded: Payload }>().not.toMatchTypeOf<
      RequestFor<'/required/multiple'>
    >();
    expectTypeOf<{ formData: Payload; formUrlEncoded: Payload }>().not.toMatchTypeOf<
      RequestFor<'/required/multiple'>
    >();
  });

  it('OpenApiOptions: callable JSON body -> original property controls requiredness', () => {
    expectTypeOf<{}>().toMatchTypeOf<
      OpenApiOptions<OptionalBodyPaths, '/optional/json', 'post'>
    >();
    expectTypeOf<{}>().not.toMatchTypeOf<
      OpenApiOptions<OptionalBodyPaths, '/required/json', 'post'>
    >();
  });

  it('Fetcher: optional and required bodies -> shortcut, callable and safe calls typecheck', () => {
    expectTypeOf((api: Fetcher<OptionalBodyPaths>) => {
      api.post('/optional/json', {});
      api.post('/optional/multipart', {});
      api.post('/optional/urlencoded', {});
      api.post('/optional/json', { json: { name: 'example' } });
      api.post('/optional/multipart', { formData: { name: 'example' } });
      api.post('/optional/urlencoded', { formUrlEncoded: { name: 'example' } });
      api.post('/required/json', { json: { name: 'example' } });
      api.post('/required/multipart', { formData: { name: 'example' } });
      api.post('/required/urlencoded', { formUrlEncoded: { name: 'example' } });
      api('/optional/json', { method: 'POST' });
      api('/required/json', { method: 'POST', json: { name: 'example' } });
      api.safe.post('/optional/json', {});
      api.safe.post('/optional/multipart', {});
      api.safe.post('/optional/urlencoded', {});
      api.safe.post('/required/json', { json: { name: 'example' } });
      api.safe.post('/required/multipart', { formData: { name: 'example' } });
      api.safe.post('/required/urlencoded', { formUrlEncoded: { name: 'example' } });
      api.safe('/optional/json', { method: 'POST' });
      api.safe('/required/json', { method: 'POST', json: { name: 'example' } });
    }).toBeFunction();
  });
});

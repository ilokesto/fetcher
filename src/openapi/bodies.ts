import type {
  DistributiveSimplify,
  MaybeProperty,
} from './shared';

export type RequestBodyFor<Operation> = Operation extends { requestBody: infer RequestBody }
  ? RequestBody
  : Operation extends { requestBody?: infer RequestBody }
    ? RequestBody
    : never;

type ContentFor<RequestBody> = RequestBody extends { content: infer Content } ? Content : never;

type JsonMediaTypeKeys<Content> = Extract<
  keyof Content,
  'application/json' | `${string}+json` | `${string}/json`
>;

export type JsonContent<Content> = [JsonMediaTypeKeys<Content>] extends [never]
  ? never
  : Content[JsonMediaTypeKeys<Content>];

type FormDataMediaTypeKeys<Content> = Extract<
  keyof Content,
  'multipart/form-data'
>;

type FormDataContent<Content> = [FormDataMediaTypeKeys<Content>] extends [never]
  ? never
  : Content[FormDataMediaTypeKeys<Content>];

type FormUrlEncodedMediaTypeKeys<Content> = Extract<
  keyof Content,
  'application/x-www-form-urlencoded'
>;

type FormUrlEncodedContent<Content> = [FormUrlEncodedMediaTypeKeys<Content>] extends [never]
  ? never
  : Content[FormUrlEncodedMediaTypeKeys<Content>];

export type JsonRequestBody<Operation> = JsonContent<ContentFor<RequestBodyFor<Operation>>>;
export type FormDataRequestBody<Operation> = FormDataContent<ContentFor<RequestBodyFor<Operation>>>;
export type FormUrlEncodedRequestBody<Operation> = FormUrlEncodedContent<
  ContentFor<RequestBodyFor<Operation>>
>;

export type RequestBodyRequired<Operation> = RequestBodyFor<Operation> extends {
  content: infer _Content;
}
  ? true
  : false;

export type JsonRequestBodyRequired<Operation> = [JsonRequestBody<Operation>] extends [never]
  ? false
  : RequestBodyRequired<Operation>;

type ShortcutBodyKey = 'json' | 'formData' | 'formUrlEncoded';

type ShortcutPayloadMember<
  Key extends ShortcutBodyKey,
  Value,
  IsRequired extends boolean,
> = DistributiveSimplify<
  MaybeProperty<Key, Value, IsRequired, true> & {
    [K in Exclude<ShortcutBodyKey, Key>]?: never;
  }
>;

type ShortcutRequestPayloadUnion<Operation> =
  | ([JsonRequestBody<Operation>] extends [never]
      ? never
      : ShortcutPayloadMember<'json', JsonRequestBody<Operation>, RequestBodyRequired<Operation>>)
  | ([FormDataRequestBody<Operation>] extends [never]
      ? never
      : ShortcutPayloadMember<
          'formData',
          FormDataRequestBody<Operation>,
          RequestBodyRequired<Operation>
        >)
  | ([FormUrlEncodedRequestBody<Operation>] extends [never]
      ? never
      : ShortcutPayloadMember<
          'formUrlEncoded',
          FormUrlEncodedRequestBody<Operation>,
          RequestBodyRequired<Operation>
        >);

export type ShortcutRequestPayload<Operation> =
  [ShortcutRequestPayloadUnion<Operation>] extends [never]
    ? {}
    : ShortcutRequestPayloadUnion<Operation>;

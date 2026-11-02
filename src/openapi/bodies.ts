import type {
  DistributiveSimplify,
  MaybeProperty,
} from './shared';

/** Extracts an operation's required or optional request body declaration. */
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

/** Unions JSON-compatible media schemas, including structured +json media types. */
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

/** JSON payload schema, or never when the operation declares no JSON content. */
export type JsonRequestBody<Operation> = JsonContent<ContentFor<RequestBodyFor<Operation>>>;
/** Multipart payload schema, or never when that format is not declared. */
export type FormDataRequestBody<Operation> = FormDataContent<ContentFor<RequestBodyFor<Operation>>>;
/** URL-encoded payload schema, or never when that format is not declared. */
export type FormUrlEncodedRequestBody<Operation> = FormUrlEncodedContent<
  ContentFor<RequestBodyFor<Operation>>
>;

/** Whether the operation requires a requestBody with declared content. */
export type RequestBodyRequired<Operation> = Operation extends {
  requestBody: { content: infer _Content };
}
  ? true
  : false;

/** Whether JSON content exists and its request body is required. */
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

/** Mutually exclusive supported body formats, or an empty object for bodyless operations. */
export type ShortcutRequestPayload<Operation> =
  [ShortcutRequestPayloadUnion<Operation>] extends [never]
    ? {}
    : ShortcutRequestPayloadUnion<Operation>;

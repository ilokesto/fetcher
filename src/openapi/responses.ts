import type { JsonContent } from './bodies';
import type {
  OperationFor,
  PathKey,
  PathsLike,
  UnknownIfNever,
} from './shared';

type ResponsesFor<Operation> = Operation extends { responses: infer Responses } ? Responses : never;

type PreferredJsonStatusCode = 200 | 201 | 204;

type ResponseForStatus<Responses, Status extends PreferredJsonStatusCode> = Responses extends object
  ? Responses[Extract<keyof Responses, Status | `${Status}`>]
  : never;

type DefaultResponse<Responses> = Responses extends { default: infer Response } ? Response : never;
type JsonResponse<Response> = Response extends { content: infer Content } ? JsonContent<Content> : never;

type PreferredJsonResponse<Responses> = [JsonResponse<ResponseForStatus<Responses, 200>>] extends [never]
  ? [JsonResponse<ResponseForStatus<Responses, 201>>] extends [never]
    ? [JsonResponse<ResponseForStatus<Responses, 204>>] extends [never]
      ? JsonResponse<DefaultResponse<Responses>>
      : JsonResponse<ResponseForStatus<Responses, 204>>
    : JsonResponse<ResponseForStatus<Responses, 201>>
  : JsonResponse<ResponseForStatus<Responses, 200>>;

export type InferJson<
  Paths extends PathsLike,
  Path extends PathKey<Paths>,
  Method extends string,
> = UnknownIfNever<PreferredJsonResponse<ResponsesFor<OperationFor<Paths, Path, Method>>>>;

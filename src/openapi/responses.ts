import type { JsonContent } from './bodies';
import type {
  OperationFor,
  PathKey,
  PathsLike,
  UnknownIfNever,
} from './shared';

type ResponsesFor<Operation> = Operation extends { responses: infer Responses } ? Responses : never;

type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type SuccessStatusCode = `2${Digit}${Digit}`;

type ResponseForStatus<Responses, Status extends SuccessStatusCode> = Responses extends object
  ? Status extends keyof Responses
    ? Responses[Status]
    : Status extends `${infer NumericStatus extends number}`
      ? NumericStatus extends keyof Responses
        ? Responses[NumericStatus]
        : Responses extends { '2XX': infer Response }
          ? Response
          : never
      : never
  : never;

type DefaultResponse<Responses> = Responses extends { default: infer Response } ? Response : never;
type JsonResponse<Response> = Response extends { content: infer Content } ? JsonContent<Content> : never;

type SuccessJsonResponse<Responses> = JsonResponse<{
  [Status in SuccessStatusCode]: ResponseForStatus<Responses, Status>;
}[SuccessStatusCode]>;

type InferredJsonResponse<Responses> = [SuccessJsonResponse<Responses>] extends [never]
  ? JsonResponse<DefaultResponse<Responses>>
  : SuccessJsonResponse<Responses>;

/** Unions JSON from 200-299 responses (including 2XX), then falls back to default JSON or unknown. */
export type InferJson<
  Paths extends PathsLike,
  Path extends PathKey<Paths>,
  Method extends string,
> = UnknownIfNever<InferredJsonResponse<ResponsesFor<OperationFor<Paths, Path, Method>>>>;

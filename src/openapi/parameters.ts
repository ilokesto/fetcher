import type { PathParameterValue } from '../internal/runtime';
import type { Simplify } from './shared';

type RouteParameterGroupKey = 'path' | 'query' | 'header' | 'cookie';

type TemplateParamNames<Path extends string> = Path extends `${string}{${infer Param}}${infer Rest}`
  ? Param | TemplateParamNames<Rest>
  : never;

/** Required path fields inferred from brace-delimited route tokens; never for a tokenless route. */
export type PathTemplateParams<Path extends string> = [TemplateParamNames<Path>] extends [never]
  ? never
  : { [K in TemplateParamNames<Path>]: PathParameterValue };

/** Extracts required or optional OpenAPI parameter groups from an operation. */
export type ParametersFor<Operation> = Operation extends { parameters: infer Parameters }
  ? Parameters
  : Operation extends { parameters?: infer Parameters }
    ? Parameters
    : never;

type ParameterGroup<Parameters, Key extends RouteParameterGroupKey> = Parameters extends {
  [K in Key]: infer Value;
}
  ? Value
  : Parameters extends {
        [K in Key]?: infer Value;
      }
    ? Value
    : never;

type HasWideNeverIndex<T> = T extends Record<string, infer Value>
  ? string extends keyof T
    ? [Value] extends [never]
      ? true
      : false
    : false
  : false;

/** Rejects never, empty objects and generated open indexes whose values are never. */
export type HasMeaningfulKeys<T> = [T] extends [never]
  ? false
  : T extends object
    ? HasWideNeverIndex<T> extends true
      ? false
      : keyof T extends never
        ? false
        : true
    : false;

/** Object-shaped path parameters declared by the operation. */
export type PathParameters<Operation> = Extract<ParameterGroup<ParametersFor<Operation>, 'path'>, object>;
/** Object-shaped query parameters declared by the operation. */
export type QueryParameters<Operation> = Extract<ParameterGroup<ParametersFor<Operation>, 'query'>, object>;
/** Object-shaped request headers declared by the operation. */
export type HeaderParameters<Operation> = Extract<ParameterGroup<ParametersFor<Operation>, 'header'>, object>;
/** Cookie parameter shapes checked at compile time only, without runtime serialization. */
export type CookieParameters<Operation> = Extract<ParameterGroup<ParametersFor<Operation>, 'cookie'>, object>;

type ParameterGroupRequired<Operation, Key extends RouteParameterGroupKey> = ParametersFor<Operation> extends {
  [K in Key]: infer _Group;
}
  ? HasMeaningfulKeys<Extract<ParameterGroup<ParametersFor<Operation>, Key>, object>>
  : false;

/** Uses declared path fields when meaningful, otherwise infers them from the route template. */
export type PathParametersFor<Path extends string, Operation> = HasMeaningfulKeys<PathParameters<Operation>> extends true
  ? Simplify<PathParameters<Operation>>
  : PathTemplateParams<Path>;

/** Requires path values for every route token or an explicitly required meaningful path group. */
export type PathParametersRequired<Path extends string, Operation> = [TemplateParamNames<Path>] extends [never]
  ? ParameterGroupRequired<Operation, 'path'>
  : true;

/** Whether the operation requires a meaningful query group. */
export type QueryParametersRequired<Operation> = ParameterGroupRequired<Operation, 'query'>;
/** Whether the operation requires a meaningful header group. */
export type HeaderParametersRequired<Operation> = ParameterGroupRequired<Operation, 'header'>;
/** Whether the operation requires a meaningful compile-time cookie group. */
export type CookieParametersRequired<Operation> = ParameterGroupRequired<Operation, 'cookie'>;

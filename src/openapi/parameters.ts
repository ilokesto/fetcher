import type { PathParameterValue } from '../internal/runtime';
import type { Simplify } from './shared';

type RouteParameterGroupKey = 'path' | 'query' | 'header' | 'cookie';

type TemplateParamNames<Path extends string> = Path extends `${string}{${infer Param}}${infer Rest}`
  ? Param | TemplateParamNames<Rest>
  : never;

export type PathTemplateParams<Path extends string> = [TemplateParamNames<Path>] extends [never]
  ? never
  : { [K in TemplateParamNames<Path>]: PathParameterValue };

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

export type HasMeaningfulKeys<T> = [T] extends [never]
  ? false
  : T extends object
    ? HasWideNeverIndex<T> extends true
      ? false
      : keyof T extends never
        ? false
        : true
    : false;

export type PathParameters<Operation> = Extract<ParameterGroup<ParametersFor<Operation>, 'path'>, object>;
export type QueryParameters<Operation> = Extract<ParameterGroup<ParametersFor<Operation>, 'query'>, object>;
export type HeaderParameters<Operation> = Extract<ParameterGroup<ParametersFor<Operation>, 'header'>, object>;
export type CookieParameters<Operation> = Extract<ParameterGroup<ParametersFor<Operation>, 'cookie'>, object>;

type ParameterGroupRequired<Operation, Key extends RouteParameterGroupKey> = ParametersFor<Operation> extends {
  [K in Key]: infer _Group;
}
  ? HasMeaningfulKeys<Extract<ParameterGroup<ParametersFor<Operation>, Key>, object>>
  : false;

export type PathParametersFor<Path extends string, Operation> = HasMeaningfulKeys<PathParameters<Operation>> extends true
  ? Simplify<PathParameters<Operation>>
  : PathTemplateParams<Path>;

export type PathParametersRequired<Path extends string, Operation> = [TemplateParamNames<Path>] extends [never]
  ? ParameterGroupRequired<Operation, 'path'>
  : true;

export type QueryParametersRequired<Operation> = ParameterGroupRequired<Operation, 'query'>;
export type HeaderParametersRequired<Operation> = ParameterGroupRequired<Operation, 'header'>;
export type CookieParametersRequired<Operation> = ParameterGroupRequired<Operation, 'cookie'>;

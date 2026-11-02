/** Lowercase HTTP operation names understood by the facade. */
export type OpenApiHttpMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'patch'
  | 'delete'
  | 'head'
  | 'options';

/** Structural bound accepting generated OpenAPI path maps, including interfaces. */
export type PathsLike = object;

/** Named HTTP shortcuts; OPTIONS is available through direct calls only. */
export type ShortcutMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head';
/** HTTP methods supported by direct calls. */
export type CallableMethod = ShortcutMethod | 'options';
/** String route keys extracted from a generated path map. */
export type PathKey<Paths extends PathsLike> = Extract<keyof Paths, string>;
/** Flattens an intersection's visible fields without changing their types. */
export type Simplify<T> = { [K in keyof T]: T[K] } & {};
/** Flattens each union member independently, retaining mutually exclusive payloads. */
export type DistributiveSimplify<T> = T extends unknown ? Simplify<T> : never;
/** Keys whose presence is required by an object type. */
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];
/** Whether a request shape contains any required keys. */
export type HasRequiredKeys<T> = [RequiredKeys<T>] extends [never] ? false : true;
/** Replaces an absent inferred schema with unknown. */
export type UnknownIfNever<T> = [T] extends [never] ? unknown : T;

/** Conditionally includes a field while preserving its required or optional status. */
export type MaybeProperty<
  Key extends PropertyKey,
  Value,
  IsRequired extends boolean,
  Include extends boolean,
> = Include extends true
  ? IsRequired extends true
    ? { [K in Key]-?: Value }
    : { [K in Key]?: Value }
  : {};

/** Looks up an operation for an exact route and method, returning never when absent. */
export type OperationFor<
  Paths extends PathsLike,
  Path extends PathKey<Paths>,
  Method extends string,
> = Method extends keyof Paths[Path] ? Paths[Path][Method] : never;

type MergePathMethods<BasePath, ExtraPath> = Simplify<{
  [Method in keyof BasePath | keyof ExtraPath]: Method extends keyof ExtraPath
    ? ExtraPath[Method]
    : Method extends keyof BasePath
      ? BasePath[Method]
      : never;
}>;

/** Merges path maps and their methods; Extra overrides matching operations without removing others. */
export type MergePaths<Base, Extra> = Simplify<{
  [Path in keyof Base | keyof Extra]: Path extends keyof Extra
    ? Path extends keyof Base
      ? MergePathMethods<Base[Path], Extra[Path]>
      : Extra[Path]
    : Path extends keyof Base
      ? Base[Path]
      : never;
}>;

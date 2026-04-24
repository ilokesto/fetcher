export type OpenApiHttpMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'patch'
  | 'delete'
  | 'head'
  | 'options';

export type PathsLike = Record<string, Partial<Record<OpenApiHttpMethod, unknown>>>;

export type ShortcutMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
export type CallableMethod = ShortcutMethod | 'head';
export type PathKey<Paths extends PathsLike> = Extract<keyof Paths, string>;
export type Simplify<T> = { [K in keyof T]: T[K] } & {};
export type DistributiveSimplify<T> = T extends unknown ? Simplify<T> : never;
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];
export type HasRequiredKeys<T> = [RequiredKeys<T>] extends [never] ? false : true;
export type UnknownIfNever<T> = [T] extends [never] ? unknown : T;

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

export type MergePaths<Base, Extra> = Simplify<{
  [Path in keyof Base | keyof Extra]: Path extends keyof Extra
    ? Path extends keyof Base
      ? MergePathMethods<Base[Path], Extra[Path]>
      : Extra[Path]
    : Path extends keyof Base
      ? Base[Path]
      : never;
}>;

/// <reference types="react" />
/// <reference types="react-dom" />

declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

declare module "clsx" {
  export type ClassValue =
    | string
    | number
    | boolean
    | undefined
    | null
    | Record<string, boolean | undefined | null>
    | ClassValue[];
  export function clsx(...inputs: ClassValue[]): string;
  export default clsx;
}

declare module "tailwind-merge" {
  export type ClassNameValue =
    | string
    | number
    | boolean
    | undefined
    | null
    | ClassNameValue[];
  export function twMerge(...classLists: ClassNameValue[]): string;
  export function twJoin(...classLists: ClassNameValue[]): string;
}

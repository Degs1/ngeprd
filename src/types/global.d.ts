declare module "*.css" {
  const content: Record<string, string>;
  export default content;
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

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

declare module "next/server.js" {
  export { NextRequest } from "next/dist/server/web/spec-extension/request";
  export { NextResponse } from "next/dist/server/web/spec-extension/response";
}

declare module "ai" {
  export function generateText(options: any): Promise<any>;
  export function streamText(options: any): any;
  export type CoreMessage = any;
  export type LanguageModel = any;
}

declare module "@xyflow/react" {
  import type { ComponentType, FC, ReactNode, CSSProperties } from "react";

  export const ReactFlow: ComponentType<any>;
  export const ReactFlowProvider: ComponentType<{ children?: ReactNode }>;
  export const Background: ComponentType<any>;
  export enum BackgroundVariant {
    Lines = "lines",
    Dots = "dots",
    Cross = "cross",
  }
  export const Controls: ComponentType<any>;
  export interface MiniMapProps {
    nodeColor?: (node: Node) => string;
    nodeStrokeColor?: (node: Node) => string;
    nodeClassName?: (node: Node) => string;
    nodeBorderRadius?: number;
    maskColor?: string;
    className?: string;
  }
  export const MiniMap: ComponentType<MiniMapProps>;
  export function useReactFlow(): any;
  export type NodeTypes = Record<string, ComponentType<any>>;
  export const Handle: ComponentType<any>;
  export enum Position {
    Top = "top",
    Right = "right",
    Bottom = "bottom",
    Left = "left",
  }
  export type NodeProps<T = any> = {
    id: string;
    data: T;
    selected?: boolean;
    [key: string]: any;
  };
  export type Node<T = any> = {
    id: string;
    type?: string;
    position: { x: number; y: number };
    data: T;
    style?: CSSProperties;
    [key: string]: any;
  };
  export type Edge<T = any> = {
    id: string;
    source: string;
    target: string;
    animated?: boolean;
    style?: CSSProperties;
    data?: T;
    [key: string]: any;
  };
  export type OnNodesChange<T = any> = (changes: any[]) => void;
  export type OnEdgesChange<T = any> = (changes: any[]) => void;
  export type Connection = {
    source: string | null;
    target: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  };
  export function applyNodeChanges(changes: any[], nodes: any[]): any[];
  export function applyEdgeChanges(changes: any[], edges: any[]): any[];
  export function addEdge(edgeParams: any, edges: any[]): any[];
}

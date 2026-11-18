// Tipos del módulo compartido figura.js (sólo datos de la figura anatómica).
export type Vista = 'frente' | 'espalda';
export declare const REGIONES: Record<Vista, Record<string, string[]>>;
export declare const SILUETA: Record<Vista, string[]>;
export declare const vistaDe: (musculo: string) => Vista;
export declare function figura(principal: string, secundarios?: string[], vista?: Vista): { vista: Vista; silueta: string[]; principal: string[]; secundarios: string[] };
export declare function encuadre(musculo: string): [number, number, number, number];

// Tipos laxos del módulo compartido biblioteca.js.
export declare const BUCKET: string;
export declare const TEMAS: Record<string, string>;
export declare const FORMATOS: Record<string, string>;
export declare const TAM_MAX: number;
export declare const ESTADOS: Record<string, string>;
export declare class BibliotecaError extends Error { code?: string }
export declare const formatoDe: (nombre: string) => string | null;
export declare function sugerirDeNombre(nombre: string): { autor: string | null; titulo: string };
export declare const libros: any;
export declare const subirLibro: any;
export declare const editarLibro: any;
export declare const borrarLibro: any;
export declare const recuperarLibro: any;
export declare const reprocesar: any;
export declare const buscar: any;
export declare const portada: any;
export declare const consultas: any;
export declare function cita(f: any): string;

// Tipos mínimos dos módulos Node usados no Worker (nodejs_compat), sem puxar @types/node inteiro.
declare module 'node:events' {
  export class EventEmitter {
    on(event: string, fn: (...args: unknown[]) => void): this;
    once(event: string, fn: (...args: unknown[]) => void): this;
    emit(event: string, ...args: unknown[]): boolean;
    removeListener(event: string, fn: (...args: unknown[]) => void): this;
    removeAllListeners(event?: string): this;
  }
}
declare module 'node:buffer' {
  export const Buffer: { from(data: Uint8Array): Uint8Array };
}

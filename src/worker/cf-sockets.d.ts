// Para o typecheck dos testes (tipos do Node): o módulo só existe no runtime do Workers.
declare module 'cloudflare:sockets' {
  export function connect(address: { hostname: string; port: number }, options?: { secureTransport?: string; allowHalfOpen?: boolean }): Socket;
  export interface Socket {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
    closed: Promise<void>;
    startTls(): Socket;
  }
}

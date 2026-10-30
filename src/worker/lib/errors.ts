/** Erro com mensagem segura para o usuário (pt-BR). Nunca inclua detalhes internos aqui. */
export class AppError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 410 | 422 | 429 | 503,
    message: string,
    public code = 'ERROR',
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, code = 'BAD_REQUEST', details?: unknown) => new AppError(400, msg, code, details);
export const notFound = (msg = 'Não encontrado.') => new AppError(404, msg, 'NOT_FOUND');
export const conflict = (msg: string, code = 'CONFLICT', details?: unknown) => new AppError(409, msg, code, details);
export const unauthorized = (msg = 'Faça login para continuar.', code = 'UNAUTHORIZED') => new AppError(401, msg, code);
export const forbidden = (msg = 'Acesso negado.', code = 'FORBIDDEN') => new AppError(403, msg, code);
export const tooMany = (msg = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.') => new AppError(429, msg, 'RATE_LIMITED');
export const unavailable = (msg: string, code = 'UNAVAILABLE') => new AppError(503, msg, code);

/** Código do PostgreSQL para violação da constraint de exclusão (sobreposição). */
export const PG_EXCLUSION_VIOLATION = '23P01';
export const PG_UNIQUE_VIOLATION = '23505';

export function pgCode(err: unknown): string | undefined {
  return typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : undefined;
}

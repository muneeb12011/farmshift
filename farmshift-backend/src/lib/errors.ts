export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'UNPROCESSABLE'
  | 'UPSTREAM_UNAVAILABLE'
  | 'INTERNAL';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static validation(message: string, details?: unknown) {
    return new AppError('VALIDATION_ERROR', 400, message, details);
  }
  static unauthorized(message = 'Authentication required') {
    return new AppError('UNAUTHORIZED', 401, message);
  }
  static forbidden(message = 'You do not have access to this resource') {
    return new AppError('FORBIDDEN', 403, message);
  }
  static notFound(what = 'Resource') {
    return new AppError('NOT_FOUND', 404, `${what} not found`);
  }
  static conflict(message: string) {
    return new AppError('CONFLICT', 409, message);
  }
  static unprocessable(message: string, details?: unknown) {
    return new AppError('UNPROCESSABLE', 422, message, details);
  }
  static upstream(message: string, details?: unknown) {
    return new AppError('UPSTREAM_UNAVAILABLE', 502, message, details);
  }
}

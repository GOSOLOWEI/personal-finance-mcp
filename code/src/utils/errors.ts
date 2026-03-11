export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUDGET_EXCEEDED'
  | 'CATEGORY_DEPTH_EXCEEDED'
  | 'ACCOUNT_HAS_TRANSACTIONS'
  | 'PRESET_CATEGORY_DELETE'
  | 'INVALID_TRANSFER'
  | 'AMORTIZATION_MONTHS_TOO_FEW'
  | 'AMORTIZATION_NOT_EXPENSE'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR';

export interface AppError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export function errorResponse(code: ErrorCode, message: string, details?: unknown): AppError {
  return {
    success: false,
    error: { code, message, details },
  };
}

export class FinanceError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'FinanceError';
  }
}

export function isFinanceError(err: unknown): err is FinanceError {
  return err instanceof FinanceError;
}

export function handleError(err: unknown): AppError {
  if (isFinanceError(err)) {
    return errorResponse(err.code, err.message, err.details);
  }

  const errMsg = err instanceof Error ? err.message : String(err);

  // 不暴露数据库连接信息
  if (errMsg.includes('password') || errMsg.includes('host') || errMsg.includes('connect')) {
    return errorResponse('DATABASE_ERROR', '数据库连接失败，请稍后重试');
  }

  return errorResponse('INTERNAL_ERROR', '服务内部错误，请稍后重试');
}

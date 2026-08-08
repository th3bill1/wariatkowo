export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'INTERNAL_ERROR';
export type ApiSuccessResponse<T> = { data: T };
export type ApiErrorResponse = { error: { code: ApiErrorCode; message: string } };

export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "DUPLICATE",
  "UNAUTHORIZED",
  "RATE_LIMITED",
  "NOT_FOUND",
  "METHOD_NOT_ALLOWED",
  "SERVICE_UNAVAILABLE",
  "NOT_CONFIGURED",
  "FORBIDDEN",
  "CONFLICT",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
export type ApiSuccessResponse<T> = { data: T };
export type ApiErrorResponse = {
  error: { code: ApiErrorCode; message: string };
};

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "DUPLICATE"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "SERVICE_UNAVAILABLE"
  | "NOT_CONFIGURED"
  | "INTERNAL_ERROR";
export type ApiSuccessResponse<T> = { data: T };
export type ApiErrorResponse = {
  error: { code: ApiErrorCode; message: string };
};

import type { ApiErrorResponse, ApiSuccessResponse } from '../../shared/api';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function readErrorMessage(payload: unknown, fallback: string): { code: string; message: string } {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    payload.error &&
    typeof payload.error === 'object'
  ) {
    const error = (payload as ApiErrorResponse).error;
    return {
      code: error.code,
      message: error.message,
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    message: fallback,
  };
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => undefined)) as ApiSuccessResponse<T> | ApiErrorResponse | undefined;

  if (!response.ok) {
    const error = readErrorMessage(payload, 'Wystąpił błąd podczas pobierania danych.');
    throw new ApiError(error.message, response.status, error.code);
  }

  if (!payload || !('data' in payload)) {
    throw new ApiError('Odpowiedź serwera była niepoprawna.', response.status, 'INTERNAL_ERROR');
  }

  return payload.data;
}

export async function requestVoid(input: RequestInfo | URL, init?: RequestInit): Promise<void> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as ApiErrorResponse | undefined;
    const error = readErrorMessage(payload, 'Wystąpił błąd podczas wykonywania operacji.');
    throw new ApiError(error.message, response.status, error.code);
  }
}

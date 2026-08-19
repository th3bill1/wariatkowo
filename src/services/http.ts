import {
  API_ERROR_CODES,
  type ApiErrorCode,
  type ApiErrorResponse,
  type ApiSuccessResponse,
} from "../../shared/api";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ApiErrorCode,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const apiErrorCodes = new Set<ApiErrorCode>(API_ERROR_CODES);

function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === "string" && apiErrorCodes.has(value as ApiErrorCode);
}

function readErrorMessage(
  payload: unknown,
  fallback: string,
): { code: ApiErrorCode; message: string } {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "code" in payload.error &&
    isApiErrorCode(payload.error.code) &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return {
      code: payload.error.code,
      message: payload.error.message,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: fallback,
  };
}

async function fetchApi<T = unknown>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  errorFallback: string,
): Promise<{
  response: Response;
  payload: ApiSuccessResponse<T> | ApiErrorResponse | undefined;
}> {
  const response = await fetch(input, init);
  const payload = response.status === 204
    ? undefined
    : ((await response.json().catch(() => undefined)) as
        | ApiSuccessResponse<T>
        | ApiErrorResponse
        | undefined);

  if (!response.ok) {
    const apiError = readErrorMessage(
      payload,
      errorFallback,
    );
    throw new ApiError(apiError.message, response.status, apiError.code);
  }

  return { response, payload };
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const { response, payload } = await fetchApi<T>(
    input,
    init,
    "Wystąpił błąd podczas pobierania danych.",
  );
  if (response.status === 204) {
    return undefined as T;
  }

  if (!payload || !("data" in payload)) {
    throw new ApiError(
      "Odpowiedź serwera była niepoprawna.",
      response.status,
      "INTERNAL_ERROR",
    );
  }

  return payload.data;
}

export function requestJsonBody<T>(
  input: RequestInfo | URL,
  method: "POST" | "PUT" | "PATCH",
  body: unknown,
): Promise<T> {
  return requestJson<T>(input, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function requestVoid(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<void> {
  await fetchApi(
    input,
    init,
    "Wystąpił błąd podczas wykonywania operacji.",
  );
}

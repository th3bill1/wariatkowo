import type {
  CalendarEvent,
  CalendarSource,
  CreateCalendarEventInput,
  CreateShoppingItemInput,
  CreateTaskInput,
  GoogleCalendarConnectionStatus,
  HomeStatus,
  HouseholdMember,
  MobileReleaseStatus,
  ShoppingItem,
  ShoppingProduct,
  Task,
  TaskStats,
  UpdateCalendarEventInput,
  UpdateShoppingItemInput,
  UpdateTaskInput,
} from "../../../shared/models";
import {
  API_ERROR_CODES,
  type ApiErrorCode,
  type ApiErrorResponse,
  type ApiSuccessResponse,
} from "../../../shared/api";

export type TokenStore = {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
};
export type ApiClientOptions = {
  baseUrl: string;
  tokenStore?: TokenStore;
  fetch?: typeof globalThis.fetch;
  onUnauthorized?: () => void;
};
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
const codes = new Set<ApiErrorCode>(API_ERROR_CODES);

export function createApiClient(options: ApiClientOptions) {
  const fetcher = options.fetch ?? globalThis.fetch;
  const url = (path: string) => `${options.baseUrl.replace(/\/$/, "")}${path}`;
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await options.tokenStore?.get();
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    let response: Response;
    try {
      response = await fetcher(url(path), { ...init, headers });
    } catch {
      throw new ApiError(
        "Brak połączenia z Wariatkowem.",
        0,
        "SERVICE_UNAVAILABLE",
      );
    }
    const payload =
      response.status === 204
        ? undefined
        : ((await response.json().catch(() => undefined)) as
            ApiSuccessResponse<T> | ApiErrorResponse | undefined);
    if (!response.ok) {
      const error = payload && "error" in payload ? payload.error : undefined;
      const code =
        error && codes.has(error.code) ? error.code : "INTERNAL_ERROR";
      if (response.status === 401) options.onUnauthorized?.();
      throw new ApiError(
        error?.message ?? "Nie udało się wykonać operacji.",
        response.status,
        code,
      );
    }
    if (response.status === 204) return undefined as T;
    if (!payload || !("data" in payload))
      throw new ApiError(
        "Niepoprawna odpowiedź serwera.",
        response.status,
        "INTERNAL_ERROR",
      );
    return payload.data;
  }
  const body = (value: unknown) => JSON.stringify(value);
  return {
    auth: {
      session: () => request<HouseholdMember | null>("/api/auth/session"),
      exchange: (code: string) =>
        request<{ token: string; member: HouseholdMember; expiresAt: string }>(
          "/api/auth/mobile/exchange",
          { method: "POST", body: body({ code }) },
        ),
      logout: () => request<void>("/api/auth/logout", { method: "POST" }),
    },
    mobile: {
      latest: () => request<MobileReleaseStatus>("/api/mobile/latest"),
    },
    tasks: {
      list: () => request<Task[]>("/api/tasks"),
      create: (input: CreateTaskInput) =>
        request<Task>("/api/tasks", { method: "POST", body: body(input) }),
      update: (id: string, input: UpdateTaskInput) =>
        request<Task>(`/api/tasks/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: body(input),
        }),
      remove: (id: string) =>
        request<void>(`/api/tasks/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }),
      stats: (days = 7) => request<TaskStats>(`/api/task-stats?days=${days}`),
    },
    shopping: {
      list: () => request<ShoppingItem[]>("/api/shopping"),
      create: (input: CreateShoppingItemInput) =>
        request<ShoppingItem>("/api/shopping", {
          method: "POST",
          body: body(input),
        }),
      update: (id: string, input: UpdateShoppingItemInput) =>
        request<ShoppingItem>(`/api/shopping/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: body(input),
        }),
      remove: (id: string) =>
        request<void>(`/api/shopping/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }),
      clearCompleted: () =>
        request<void>("/api/shopping/completed", { method: "DELETE" }),
      products: (query = "", sort: "frequency" | "recent" = "frequency") =>
        request<ShoppingProduct[]>(
          `/api/shopping/products?q=${encodeURIComponent(query)}&sort=${sort}`,
        ),
      suggestions: (query = "", excludeActive = false, limit = 8) =>
        request<ShoppingProduct[]>(
          `/api/shopping/products/suggestions?q=${encodeURIComponent(query)}&excludeActive=${excludeActive}&limit=${limit}`,
        ),
      removeProduct: (id: string) =>
        request<void>(`/api/shopping/products/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }),
    },
    calendar: {
      list: (from: string, to: string) =>
        request<CalendarEvent[]>(
          `/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        ),
      create: (input: CreateCalendarEventInput) =>
        request<CalendarEvent>("/api/calendar", {
          method: "POST",
          body: body(input),
        }),
      update: (id: string, input: UpdateCalendarEventInput) =>
        request<CalendarEvent>(`/api/calendar/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: body(input),
        }),
      remove: (id: string) =>
        request<void>(`/api/calendar/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }),
      sources: () => request<CalendarSource[]>("/api/calendar/calendars"),
      googleStatus: () =>
        request<GoogleCalendarConnectionStatus>(
          "/api/integrations/google-calendar/status",
        ),
      sync: () =>
        request<{ synchronized: number; errors: number }>(
          "/api/integrations/google-calendar/sync",
          { method: "POST" },
        ),
      disconnectGoogle: () =>
        request<{ disconnected: boolean }>(
          "/api/integrations/google-calendar/disconnect",
          { method: "POST" },
        ),
    },
    home: {
      status: () => request<HomeStatus>("/api/home/status"),
      lightPower: (id: string, on: boolean) =>
        request<{ updated: true }>(
          `/api/home/lights/${encodeURIComponent(id)}/${on ? "on" : "off"}`,
          { method: "POST" },
        ),
      lightSettings: (id: string, input: object) =>
        request<{ updated: true }>(
          `/api/home/lights/${encodeURIComponent(id)}/settings`,
          { method: "POST", body: body(input) },
        ),
      acPower: (on: boolean) =>
        request<{ updated: true }>(`/api/home/ac/${on ? "on" : "off"}`, {
          method: "POST",
        }),
      acTemperature: (temperature: number) =>
        request<{ updated: true }>("/api/home/ac/temperature", {
          method: "POST",
          body: body({ temperature }),
        }),
      acMode: (mode: string) =>
        request<{ updated: true }>("/api/home/ac/mode", {
          method: "POST",
          body: body({ mode }),
        }),
      acFan: (fan: string) =>
        request<{ updated: true }>("/api/home/ac/fan", {
          method: "POST",
          body: body({ fan }),
        }),
      acSwing: (swing: string) =>
        request<{ updated: true }>("/api/home/ac/swing", {
          method: "POST",
          body: body({ swing }),
        }),
      acHorizontalSwing: (swing: string) =>
        request<{ updated: true }>("/api/home/ac/horizontal-swing", {
          method: "POST",
          body: body({ swing }),
        }),
      acSwitch: (id: string, enabled: boolean) =>
        request<{ updated: true }>(
          `/api/home/ac/switches/${encodeURIComponent(id)}`,
          { method: "POST", body: body({ enabled }) },
        ),
      acSelect: (id: string, option: string) =>
        request<{ updated: true }>(
          `/api/home/ac/selects/${encodeURIComponent(id)}`,
          { method: "POST", body: body({ option }) },
        ),
      acNumber: (id: string, value: number) =>
        request<{ updated: true }>(
          `/api/home/ac/numbers/${encodeURIComponent(id)}`,
          { method: "POST", body: body({ value }) },
        ),
      mediaPower: (kind: "tv" | "xbox", on: boolean) =>
        request<{ updated: true }>(`/api/home/${kind}/${on ? "on" : "off"}`, {
          method: "POST",
        }),
      tvVolume: (volume: number) =>
        request<{ updated: true }>("/api/home/tv/volume", {
          method: "POST",
          body: body({ volume }),
        }),
      tvMute: (muted: boolean) =>
        request<{ updated: true }>("/api/home/tv/mute", {
          method: "POST",
          body: body({ muted }),
        }),
      tvSource: (source: string) =>
        request<{ updated: true }>("/api/home/tv/source", {
          method: "POST",
          body: body({ source }),
        }),
      tvCommand: (command: string) =>
        request<{ updated: true }>("/api/home/tv/command", {
          method: "POST",
          body: body({ command }),
        }),
      scene: (id: string) =>
        request<{ updated: true }>(
          `/api/home/scenes/${encodeURIComponent(id)}/activate`,
          { method: "POST" },
        ),
    },
  };
}
export type WariatkowoApiClient = ReturnType<typeof createApiClient>;

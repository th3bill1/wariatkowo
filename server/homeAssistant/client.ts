import type { HomeAssistantConfig } from "./config";

export type HomeAssistantState = {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
};

export type HomeAssistantErrorKind =
  | "not-configured"
  | "unauthorized"
  | "not-found"
  | "unavailable"
  | "invalid-response";

export class HomeAssistantError extends Error {
  constructor(
    readonly kind: HomeAssistantErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "HomeAssistantError";
  }
}

export class HomeAssistantClient {
  constructor(private readonly config: HomeAssistantConfig) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.config.url || !this.config.token) {
      throw new HomeAssistantError(
        "not-configured",
        "Home Assistant nie jest skonfigurowany.",
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(`${this.config.url}/api${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
      if (response.status === 401) {
        throw new HomeAssistantError(
          "unauthorized",
          "Home Assistant odrzucił token dostępu.",
        );
      }
      if (response.status === 404) {
        throw new HomeAssistantError(
          "not-found",
          "Nie znaleziono encji Home Assistant.",
        );
      }
      if (!response.ok) {
        throw new HomeAssistantError(
          "unavailable",
          `Home Assistant zwrócił błąd ${response.status}.`,
        );
      }
      try {
        return (await response.json()) as T;
      } catch {
        throw new HomeAssistantError(
          "invalid-response",
          "Home Assistant zwrócił niepoprawną odpowiedź.",
        );
      }
    } catch (error) {
      if (error instanceof HomeAssistantError) throw error;
      throw new HomeAssistantError(
        "unavailable",
        error instanceof Error && error.name === "AbortError"
          ? "Home Assistant nie odpowiedział na czas."
          : "Nie można połączyć się z Home Assistant.",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  getState(entityId: string): Promise<HomeAssistantState> {
    return this.request<HomeAssistantState>(
      `/states/${encodeURIComponent(entityId)}`,
    );
  }

  getStates(): Promise<HomeAssistantState[]> {
    return this.request<HomeAssistantState[]>("/states");
  }

  callService(
    domain: string,
    service: string,
    data: Record<string, unknown>,
  ): Promise<HomeAssistantState[]> {
    return this.request<HomeAssistantState[]>(
      `/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}`,
      { method: "POST", body: JSON.stringify(data) },
    );
  }
}

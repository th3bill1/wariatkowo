import type {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import type { Env } from "./_shared/http";

type RouteContext = {
  request: Request;
  env: Env;
  params: Record<string, string | undefined>;
};

export type WebRouteHandler = (context: RouteContext) => Promise<Response>;

function requestUrl(request: ExpressRequest): string {
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProtocol)
    ? forwardedProtocol[0]
    : (forwardedProtocol?.split(",")[0] ?? request.protocol);
  return `${protocol}://${request.get("host") ?? "localhost"}${request.originalUrl}`;
}

function webRequest(request: ExpressRequest): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  const body = Buffer.isBuffer(request.body) ? request.body : undefined;
  return new Request(requestUrl(request), {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD" || !body?.length
        ? undefined
        : body.toString("utf8"),
  });
}

async function sendWebResponse(
  response: Response,
  expressResponse: ExpressResponse,
): Promise<void> {
  expressResponse.status(response.status);
  response.headers.forEach((value, name) =>
    expressResponse.setHeader(name, value),
  );
  if (response.status === 204 || response.body === null) {
    expressResponse.end();
    return;
  }
  expressResponse.send(Buffer.from(await response.arrayBuffer()));
}

export function adaptWebHandler(handler: WebRouteHandler, env: Env) {
  return async (
    request: ExpressRequest,
    response: ExpressResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await sendWebResponse(
        await handler({
          request: webRequest(request),
          env,
          params: Object.fromEntries(
            Object.entries(request.params).map(([name, value]) => [
              name,
              Array.isArray(value) ? value[0] : value,
            ]),
          ),
        }),
        response,
      );
    } catch (error) {
      next(error);
    }
  };
}

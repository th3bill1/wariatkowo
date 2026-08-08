import { isAuthResponse, requireAuth } from '../../_shared/auth';
import { methodNotAllowed, success, type Env } from '../../_shared/http';

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const auth = await requireAuth(context.request, context.env);
  if (isAuthResponse(auth)) return auth;
  if (context.request.method !== 'DELETE') {
    return methodNotAllowed(['DELETE']);
  }

  await context.env.DB.prepare('DELETE FROM shopping_items WHERE is_checked = 1').run();
  return success({ deleted: true });
}

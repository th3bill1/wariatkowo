import { methodNotAllowed, success, type Env } from '../../_shared/http';
export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  const result = await context.env.DB.prepare(
    "SELECT id, name, slug FROM household_members ORDER BY CASE slug WHEN 'misiek' THEN 1 ELSE 2 END",
  ).all();
  return success(result.results);
}

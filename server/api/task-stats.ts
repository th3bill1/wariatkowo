import type { HouseholdMemberSlug, TaskStats } from "../../shared/models";
import { isAuthResponse, requireAuth } from "../_shared/auth";
import { error, methodNotAllowed, success, type Env } from "../_shared/http";

export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const auth = await requireAuth(context.request, context.env);
  if (isAuthResponse(auth)) return auth;
  if (context.request.method !== "GET") return methodNotAllowed(["GET"]);
  const url = new URL(context.request.url);
  const requested = Number(url.searchParams.get("days") ?? 7);
  if (!Number.isInteger(requested) || requested < 1 || requested > 90)
    return error(
      "VALIDATION_ERROR",
      "Zakres statystyk musi wynosić od 1 do 90 dni.",
    );
  const since = new Date(Date.now() - requested * 86_400_000).toISOString();
  const members = await context.env.DB.prepare(
    "SELECT m.id,m.name,m.slug,COUNT(e.id) AS count FROM household_members m LEFT JOIN task_completion_events e ON e.completed_by_member_id=m.id AND e.assignment_snapshot=m.slug AND e.completed_at>=? GROUP BY m.id,m.name,m.slug ORDER BY m.slug",
  )
    .bind(since)
    .all<{
      id: string;
      name: string;
      slug: HouseholdMemberSlug;
      count: number;
    }>();
  const shared = await context.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM task_completion_events WHERE assignment_snapshot IN ('anyone','both') AND completed_at>=?",
  )
    .bind(since)
    .first<{ count: number }>();
  const activity = await context.env.DB.prepare(
    "SELECT e.id,e.title_snapshot,e.completed_at,m.id AS member_id,m.name,m.slug FROM task_completion_events e JOIN household_members m ON m.id=e.completed_by_member_id WHERE e.completed_at>=? ORDER BY e.completed_at DESC LIMIT 5",
  )
    .bind(since)
    .all<{
      id: string;
      title_snapshot: string;
      completed_at: string;
      member_id: string;
      name: string;
      slug: HouseholdMemberSlug;
    }>();
  const data: TaskStats = {
    days: requested,
    members: members.results.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      count: Number(row.count),
    })),
    sharedCount: Number(shared?.count ?? 0),
    recentActivity: activity.results.map((row) => ({
      id: row.id,
      title: row.title_snapshot,
      completedAt: row.completed_at,
      member: { id: row.member_id, name: row.name, slug: row.slug },
    })),
  };
  return success(data);
}

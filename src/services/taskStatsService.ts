import type { TaskStats } from '../../shared/models';
import { requestJson } from './http';
export const taskStatsService={get(days=7){return requestJson<TaskStats>('/api/task-stats?days='+days);}};

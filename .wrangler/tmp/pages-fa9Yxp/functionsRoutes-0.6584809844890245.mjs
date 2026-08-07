import { onRequest as __api_shopping_completed_ts_onRequest } from "C:\\Users\\Dell\\source\\repos\\wariatkowo\\functions\\api\\shopping\\completed.ts"
import { onRequest as __api_shopping__id__ts_onRequest } from "C:\\Users\\Dell\\source\\repos\\wariatkowo\\functions\\api\\shopping\\[id].ts"
import { onRequest as __api_tasks__id__ts_onRequest } from "C:\\Users\\Dell\\source\\repos\\wariatkowo\\functions\\api\\tasks\\[id].ts"
import { onRequest as __api_shopping_index_ts_onRequest } from "C:\\Users\\Dell\\source\\repos\\wariatkowo\\functions\\api\\shopping\\index.ts"
import { onRequest as __api_tasks_index_ts_onRequest } from "C:\\Users\\Dell\\source\\repos\\wariatkowo\\functions\\api\\tasks\\index.ts"

export const routes = [
    {
      routePath: "/api/shopping/completed",
      mountPath: "/api/shopping",
      method: "",
      middlewares: [],
      modules: [__api_shopping_completed_ts_onRequest],
    },
  {
      routePath: "/api/shopping/:id",
      mountPath: "/api/shopping",
      method: "",
      middlewares: [],
      modules: [__api_shopping__id__ts_onRequest],
    },
  {
      routePath: "/api/tasks/:id",
      mountPath: "/api/tasks",
      method: "",
      middlewares: [],
      modules: [__api_tasks__id__ts_onRequest],
    },
  {
      routePath: "/api/shopping",
      mountPath: "/api/shopping",
      method: "",
      middlewares: [],
      modules: [__api_shopping_index_ts_onRequest],
    },
  {
      routePath: "/api/tasks",
      mountPath: "/api/tasks",
      method: "",
      middlewares: [],
      modules: [__api_tasks_index_ts_onRequest],
    },
  ]
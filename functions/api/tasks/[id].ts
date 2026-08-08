import type { TaskRecurrence, UpdateTaskInput } from '../../../shared/models';
import { isAuthResponse, requireAuth } from '../../_shared/auth';
import { error, isNonEmptyString, methodNotAllowed, nowIso, parseOptionalIsoDate, parseOptionalNumber, parseOptionalString, parseTrimmedString, readJsonBody, success, type Env } from '../../_shared/http';
import { calculateNextDueDate, isCompletionTransition, isTaskAssignment, parseRecurrence, TASK_COLUMNS, toTask, type TaskRow } from '../../_shared/tasks';

const MAX_TITLE_LENGTH=180, MAX_NOTES_LENGTH=1500;
async function loadTask(env:Env,id:string):Promise<TaskRow|null>{
 return env.DB.prepare('SELECT '+TASK_COLUMNS+' FROM tasks WHERE id = ?').bind(id).first<TaskRow>();
}
async function updateTask(env:Env,id:string,body:unknown,memberId:string):Promise<Response>{
 const current=await loadTask(env,id);
 if(!current) return error('NOT_FOUND','Zadanie nie istnieje.',404);
 const input=body as Partial<UpdateTaskInput>;
 const title=input.title===undefined?current.title:parseTrimmedString(input.title);
 const notes=input.notes===undefined?current.notes:parseOptionalString(input.notes);
 const dueDate=input.dueDate===undefined?current.due_date:parseOptionalIsoDate(input.dueDate);
 const completed=input.completed===undefined?current.is_completed===1:Boolean(input.completed);
 const sortOrder=input.sortOrder===undefined?current.sort_order:parseOptionalNumber(input.sortOrder);
 const assignment=input.assignment===undefined?current.assignment:input.assignment;
 const recurrence:TaskRecurrence|null|undefined=input.recurrence===undefined
   ? (current.recurrence_unit&&current.recurrence_interval?{unit:current.recurrence_unit,interval:current.recurrence_interval}:null)
   : parseRecurrence(input.recurrence);

 if(!isNonEmptyString(title)) return error('VALIDATION_ERROR','Nazwa zadania jest wymagana.');
 if(title.length>MAX_TITLE_LENGTH) return error('VALIDATION_ERROR','Nazwa zadania jest za długa.');
 if(notes!==undefined&&notes!==null&&notes.length>MAX_NOTES_LENGTH) return error('VALIDATION_ERROR','Notatka jest za długa.');
 if(input.dueDate!==undefined&&dueDate===undefined) return error('VALIDATION_ERROR','Termin ma niepoprawny format.');
 if(input.sortOrder!==undefined&&sortOrder===undefined) return error('VALIDATION_ERROR','Kolejność musi być liczbą.');
 if(!isTaskAssignment(assignment)) return error('VALIDATION_ERROR','Niepoprawne przypisanie zadania.');
 if(input.recurrence!==undefined&&recurrence===undefined) return error('VALIDATION_ERROR','Niepoprawna częstotliwość powtarzania.');
 if(recurrence&&!dueDate) return error('VALIDATION_ERROR','Powtarzalne zadanie musi mieć termin.');

 const becomingComplete=isCompletionTransition(current.is_completed===1,completed);
 const becomingIncomplete=current.is_completed===1&&!completed;
 const timestamp=nowIso();
 const completedAt=becomingComplete?timestamp:becomingIncomplete?null:current.completed_at;
 const seriesId=recurrence?(current.recurrence_series_id??crypto.randomUUID()):null;
 const update=contextStatement(env,
   'UPDATE tasks SET title=?,notes=?,due_date=?,is_completed=?,completed_at=?,sort_order=?,assignment=?,recurrence_unit=?,recurrence_interval=?,recurrence_series_id=?,updated_at=? WHERE id=?',
   [title,notes??null,dueDate??null,completed?1:0,completedAt,sortOrder??current.sort_order,assignment,recurrence?.unit??null,recurrence?.interval??null,seriesId,timestamp,id],
 );
 const statements=[update];

 if(becomingComplete){
   statements.push(contextStatement(env,
     'INSERT OR IGNORE INTO task_completion_events (id,task_id,completed_by_member_id,completed_at,assignment_snapshot,title_snapshot) VALUES (?,?,?,?,?,?)',
     [crypto.randomUUID(),id,memberId,timestamp,assignment,title],
   ));
   if(recurrence&&dueDate){
     const maxSort=await env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) AS value FROM tasks').first<{value:number}>();
     statements.push(contextStatement(env,
       'INSERT OR IGNORE INTO tasks (id,title,notes,due_date,is_completed,completed_at,sort_order,assignment,recurrence_unit,recurrence_interval,recurrence_series_id,generated_from_task_id,created_at,updated_at) VALUES (?,?,?,?,0,NULL,?,?,?,?,?,?,?,?)',
       [crypto.randomUUID(),title,notes??null,calculateNextDueDate(dueDate,recurrence),(maxSort?.value??-1)+1,assignment,recurrence.unit,recurrence.interval,seriesId,id,timestamp,timestamp],
     ));
   }
 }
 await env.DB.batch(statements);
 const updated=await loadTask(env,id);
 return updated?success(toTask(updated)):error('INTERNAL_ERROR','Nie udało się zaktualizować zadania.',500);
}
function contextStatement(env:Env,sql:string,values:unknown[]):D1PreparedStatement{
 return env.DB.prepare(sql).bind(...values);
}
export async function onRequest(context:{request:Request;env:Env;params:{id?:string}}):Promise<Response>{
 const auth=await requireAuth(context.request,context.env); if(isAuthResponse(auth)) return auth;
 const id=context.params.id;
 if(!id) return error('VALIDATION_ERROR','Brak identyfikatora zadania.');
 if(context.request.method==='PATCH'){
   try{return await updateTask(context.env,id,await readJsonBody(context.request),auth.member.id);}
   catch{return error('VALIDATION_ERROR','Nie udało się zaktualizować zadania.');}
 }
 if(context.request.method==='DELETE'){
   if(!await loadTask(context.env,id)) return error('NOT_FOUND','Zadanie nie istnieje.',404);
   await context.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
   return success({deleted:true});
 }
 return methodNotAllowed(['PATCH','DELETE']);
}

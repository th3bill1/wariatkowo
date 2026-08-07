var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// _shared/http.ts
function jsonHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8"
  };
}
__name(jsonHeaders, "jsonHeaders");
function success(data, init) {
  const body = { data };
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...jsonHeaders(),
      ...init?.headers ?? {}
    }
  });
}
__name(success, "success");
function error(code, message, status = 400) {
  const body = {
    error: {
      code,
      message
    }
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders()
  });
}
__name(error, "error");
function methodNotAllowed(allowedMethods) {
  return error("METHOD_NOT_ALLOWED", "Metoda nie jest obs\u0142ugiwana.", 405);
}
__name(methodNotAllowed, "methodNotAllowed");
async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("INVALID_JSON");
  }
}
__name(readJsonBody, "readJsonBody");
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
__name(nowIso, "nowIso");
function parseTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}
__name(parseTrimmedString, "parseTrimmedString");
function parseOptionalString(value) {
  if (value === void 0) {
    return void 0;
  }
  if (value === null) {
    return null;
  }
  return typeof value === "string" ? value.trim() : void 0;
}
__name(parseOptionalString, "parseOptionalString");
function parseOptionalNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return void 0;
}
__name(parseOptionalNumber, "parseOptionalNumber");
function parseOptionalIsoDate(value) {
  if (value === void 0) {
    return void 0;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return void 0;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return void 0;
  }
  return new Date(parsed).toISOString();
}
__name(parseOptionalIsoDate, "parseOptionalIsoDate");
function isNonEmptyString(value) {
  return value.trim().length > 0;
}
__name(isNonEmptyString, "isNonEmptyString");

// api/shopping/completed.ts
async function onRequest(context) {
  if (context.request.method !== "DELETE") {
    return methodNotAllowed(["DELETE"]);
  }
  await context.env.DB.prepare("DELETE FROM shopping_items WHERE is_checked = 1").run();
  return success({ deleted: true });
}
__name(onRequest, "onRequest");

// _shared/shopping.ts
function toShoppingItem(row) {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    category: row.category,
    checked: row.is_checked === 1,
    checkedAt: row.checked_at,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
__name(toShoppingItem, "toShoppingItem");

// api/shopping/[id].ts
var MAX_NAME_LENGTH = 180;
var MAX_QUANTITY_LENGTH = 60;
var MAX_CATEGORY_LENGTH = 100;
async function loadItem(env, id) {
  return env.DB.prepare(
    `SELECT id, name, quantity, category, is_checked, checked_at, sort_order, created_at, updated_at
     FROM shopping_items
     WHERE id = ?`
  ).bind(id).first();
}
__name(loadItem, "loadItem");
async function updateItem(env, id, body) {
  const current = await loadItem(env, id);
  if (!current) {
    return error("NOT_FOUND", "Pozycja zakup\xF3w nie istnieje.", 404);
  }
  const input = body;
  const nextName = input.name === void 0 ? current.name : parseTrimmedString(input.name);
  const nextQuantity = input.quantity === void 0 ? current.quantity : parseOptionalString(input.quantity);
  const nextCategory = input.category === void 0 ? current.category : parseOptionalString(input.category);
  const nextChecked = input.checked === void 0 ? current.is_checked === 1 : Boolean(input.checked);
  const nextSortOrder = input.sortOrder === void 0 ? current.sort_order : parseOptionalNumber(input.sortOrder);
  if (!isNonEmptyString(nextName)) {
    return error("VALIDATION_ERROR", "Nazwa produktu jest wymagana.");
  }
  if (nextName.length > MAX_NAME_LENGTH) {
    return error("VALIDATION_ERROR", "Nazwa produktu jest za d\u0142uga.");
  }
  if (nextQuantity !== void 0 && nextQuantity !== null && nextQuantity.length > MAX_QUANTITY_LENGTH) {
    return error("VALIDATION_ERROR", "Ilo\u015B\u0107 jest za d\u0142uga.");
  }
  if (nextCategory !== void 0 && nextCategory !== null && nextCategory.length > MAX_CATEGORY_LENGTH) {
    return error("VALIDATION_ERROR", "Kategoria jest za d\u0142uga.");
  }
  if (input.sortOrder !== void 0 && nextSortOrder === void 0) {
    return error("VALIDATION_ERROR", "Kolejno\u015B\u0107 musi by\u0107 liczb\u0105.");
  }
  const changedToChecked = current.is_checked === 0 && nextChecked;
  const changedToUnchecked = current.is_checked === 1 && !nextChecked;
  const nextCheckedAt = changedToChecked ? nowIso() : changedToUnchecked ? null : current.checked_at;
  const timestamp = nowIso();
  await env.DB.prepare(
    `UPDATE shopping_items
     SET name = ?,
         quantity = ?,
         category = ?,
         is_checked = ?,
         checked_at = ?,
         sort_order = ?,
         updated_at = ?
     WHERE id = ?`
  ).bind(
    nextName,
    nextQuantity ?? null,
    nextCategory ?? null,
    nextChecked ? 1 : 0,
    nextCheckedAt,
    nextSortOrder ?? current.sort_order,
    timestamp,
    id
  ).run();
  const updated = await loadItem(env, id);
  if (!updated) {
    return error("INTERNAL_ERROR", "Nie uda\u0142o si\u0119 zaktualizowa\u0107 pozycji zakup\xF3w.", 500);
  }
  return success(toShoppingItem(updated));
}
__name(updateItem, "updateItem");
async function onRequest2(context) {
  const id = context.params.id;
  if (!id) {
    return error("VALIDATION_ERROR", "Brak identyfikatora pozycji.");
  }
  if (context.request.method === "PATCH") {
    try {
      const body = await readJsonBody(context.request);
      return await updateItem(context.env, id, body);
    } catch {
      return error("VALIDATION_ERROR", "Tre\u015B\u0107 \u017C\u0105dania nie jest poprawnym JSON-em.");
    }
  }
  if (context.request.method === "DELETE") {
    const existing = await loadItem(context.env, id);
    if (!existing) {
      return error("NOT_FOUND", "Pozycja zakup\xF3w nie istnieje.", 404);
    }
    await context.env.DB.prepare("DELETE FROM shopping_items WHERE id = ?").bind(id).run();
    return success({ deleted: true });
  }
  return methodNotAllowed(["PATCH", "DELETE"]);
}
__name(onRequest2, "onRequest");

// _shared/tasks.ts
function toTask(row) {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueDate: row.due_date,
    completed: row.is_completed === 1,
    completedAt: row.completed_at,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
__name(toTask, "toTask");

// api/tasks/[id].ts
var MAX_TITLE_LENGTH = 180;
var MAX_NOTES_LENGTH = 1500;
async function loadTask(env, id) {
  return env.DB.prepare(
    `SELECT id, title, notes, due_date, is_completed, completed_at, sort_order, created_at, updated_at
     FROM tasks
     WHERE id = ?`
  ).bind(id).first();
}
__name(loadTask, "loadTask");
async function updateTask(env, id, body) {
  const current = await loadTask(env, id);
  if (!current) {
    return error("NOT_FOUND", "Zadanie nie istnieje.", 404);
  }
  const input = body;
  const nextTitle = input.title === void 0 ? current.title : parseTrimmedString(input.title);
  const nextNotes = input.notes === void 0 ? current.notes : parseOptionalString(input.notes);
  const nextDueDate = input.dueDate === void 0 ? current.due_date : parseOptionalIsoDate(input.dueDate);
  const nextCompleted = input.completed === void 0 ? current.is_completed === 1 : Boolean(input.completed);
  const nextSortOrder = input.sortOrder === void 0 ? current.sort_order : parseOptionalNumber(input.sortOrder);
  if (!isNonEmptyString(nextTitle)) {
    return error("VALIDATION_ERROR", "Nazwa zadania jest wymagana.");
  }
  if (nextTitle.length > MAX_TITLE_LENGTH) {
    return error("VALIDATION_ERROR", "Nazwa zadania jest za d\u0142uga.");
  }
  if (nextNotes !== void 0 && nextNotes !== null && nextNotes.length > MAX_NOTES_LENGTH) {
    return error("VALIDATION_ERROR", "Notatka jest za d\u0142uga.");
  }
  if (input.dueDate !== void 0 && nextDueDate === void 0) {
    return error("VALIDATION_ERROR", "Termin ma niepoprawny format.");
  }
  if (input.sortOrder !== void 0 && nextSortOrder === void 0) {
    return error("VALIDATION_ERROR", "Kolejno\u015B\u0107 musi by\u0107 liczb\u0105.");
  }
  const changedFromIncompleteToComplete = current.is_completed === 0 && nextCompleted;
  const changedFromCompleteToIncomplete = current.is_completed === 1 && !nextCompleted;
  const nextCompletedAt = changedFromIncompleteToComplete ? nowIso() : changedFromCompleteToIncomplete ? null : current.completed_at;
  const timestamp = nowIso();
  await env.DB.prepare(
    `UPDATE tasks
     SET title = ?,
         notes = ?,
         due_date = ?,
         is_completed = ?,
         completed_at = ?,
         sort_order = ?,
         updated_at = ?
     WHERE id = ?`
  ).bind(
    nextTitle,
    nextNotes ?? null,
    nextDueDate ?? null,
    nextCompleted ? 1 : 0,
    nextCompletedAt,
    nextSortOrder ?? current.sort_order,
    timestamp,
    id
  ).run();
  const updated = await loadTask(env, id);
  if (!updated) {
    return error("INTERNAL_ERROR", "Nie uda\u0142o si\u0119 zaktualizowa\u0107 zadania.", 500);
  }
  return success(toTask(updated));
}
__name(updateTask, "updateTask");
async function onRequest3(context) {
  const id = context.params.id;
  if (!id) {
    return error("VALIDATION_ERROR", "Brak identyfikatora zadania.");
  }
  if (context.request.method === "PATCH") {
    try {
      const body = await readJsonBody(context.request);
      return await updateTask(context.env, id, body);
    } catch {
      return error("VALIDATION_ERROR", "Tre\u015B\u0107 \u017C\u0105dania nie jest poprawnym JSON-em.");
    }
  }
  if (context.request.method === "DELETE") {
    const existing = await loadTask(context.env, id);
    if (!existing) {
      return error("NOT_FOUND", "Zadanie nie istnieje.", 404);
    }
    await context.env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
    return success({ deleted: true });
  }
  return methodNotAllowed(["PATCH", "DELETE"]);
}
__name(onRequest3, "onRequest");

// api/shopping/index.ts
var MAX_NAME_LENGTH2 = 180;
var MAX_QUANTITY_LENGTH2 = 60;
var MAX_CATEGORY_LENGTH2 = 100;
async function getShoppingItems(env) {
  const result = await env.DB.prepare(
    `SELECT id, name, quantity, category, is_checked, checked_at, sort_order, created_at, updated_at
     FROM shopping_items
     ORDER BY
       is_checked ASC,
       sort_order ASC,
       created_at ASC`
  ).all();
  return result.results.map(toShoppingItem);
}
__name(getShoppingItems, "getShoppingItems");
async function createShoppingItem(env, body) {
  const input = body;
  const name = parseTrimmedString(input.name);
  const quantity = parseOptionalString(input.quantity);
  const category = parseOptionalString(input.category);
  if (!isNonEmptyString(name)) {
    return error("VALIDATION_ERROR", "Nazwa produktu jest wymagana.");
  }
  if (name.length > MAX_NAME_LENGTH2) {
    return error("VALIDATION_ERROR", "Nazwa produktu jest za d\u0142uga.");
  }
  if (quantity !== void 0 && quantity !== null && quantity.length > MAX_QUANTITY_LENGTH2) {
    return error("VALIDATION_ERROR", "Ilo\u015B\u0107 jest za d\u0142uga.");
  }
  if (category !== void 0 && category !== null && category.length > MAX_CATEGORY_LENGTH2) {
    return error("VALIDATION_ERROR", "Kategoria jest za d\u0142uga.");
  }
  const maxSort = await env.DB.prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_sort_order FROM shopping_items").first();
  const id = crypto.randomUUID();
  const timestamp = nowIso();
  const sortOrder = (maxSort?.max_sort_order ?? -1) + 1;
  await env.DB.prepare(
    `INSERT INTO shopping_items (id, name, quantity, category, is_checked, checked_at, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, NULL, ?, ?, ?)`
  ).bind(id, name, quantity ?? null, category ?? null, sortOrder, timestamp, timestamp).run();
  const created = await env.DB.prepare(
    `SELECT id, name, quantity, category, is_checked, checked_at, sort_order, created_at, updated_at
     FROM shopping_items
     WHERE id = ?`
  ).bind(id).first();
  if (!created) {
    return error("INTERNAL_ERROR", "Nie uda\u0142o si\u0119 utworzy\u0107 pozycji zakup\xF3w.", 500);
  }
  return success(toShoppingItem(created), { status: 201 });
}
__name(createShoppingItem, "createShoppingItem");
async function onRequest4(context) {
  if (context.request.method === "GET") {
    const items = await getShoppingItems(context.env);
    return success(items);
  }
  if (context.request.method === "POST") {
    try {
      const body = await readJsonBody(context.request);
      return await createShoppingItem(context.env, body);
    } catch {
      return error("VALIDATION_ERROR", "Tre\u015B\u0107 \u017C\u0105dania nie jest poprawnym JSON-em.");
    }
  }
  return methodNotAllowed(["GET", "POST"]);
}
__name(onRequest4, "onRequest");

// api/tasks/index.ts
var MAX_TITLE_LENGTH2 = 180;
var MAX_NOTES_LENGTH2 = 1500;
async function getTasks(env) {
  const result = await env.DB.prepare(
    `SELECT id, title, notes, due_date, is_completed, completed_at, sort_order, created_at, updated_at
     FROM tasks
     ORDER BY
       is_completed ASC,
       CASE WHEN due_date IS NULL THEN 1 ELSE 0 END ASC,
       due_date ASC,
       sort_order ASC,
       created_at ASC`
  ).all();
  return result.results.map(toTask);
}
__name(getTasks, "getTasks");
async function createTask(env, body) {
  const input = body;
  const title = parseTrimmedString(input.title);
  const notes = parseOptionalString(input.notes);
  const dueDate = parseOptionalIsoDate(input.dueDate);
  if (!isNonEmptyString(title)) {
    return error("VALIDATION_ERROR", "Nazwa zadania jest wymagana.");
  }
  if (title.length > MAX_TITLE_LENGTH2) {
    return error("VALIDATION_ERROR", "Nazwa zadania jest za d\u0142uga.");
  }
  if (notes !== void 0 && notes !== null && notes.length > MAX_NOTES_LENGTH2) {
    return error("VALIDATION_ERROR", "Notatka jest za d\u0142uga.");
  }
  if (input.dueDate !== void 0 && dueDate === void 0) {
    return error("VALIDATION_ERROR", "Termin ma niepoprawny format.");
  }
  const maxSort = await env.DB.prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_sort_order FROM tasks").first();
  const id = crypto.randomUUID();
  const timestamp = nowIso();
  const sortOrder = (maxSort?.max_sort_order ?? -1) + 1;
  await env.DB.prepare(
    `INSERT INTO tasks (id, title, notes, due_date, is_completed, completed_at, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, NULL, ?, ?, ?)`
  ).bind(id, title, notes ?? null, dueDate ?? null, sortOrder, timestamp, timestamp).run();
  const created = await env.DB.prepare(
    `SELECT id, title, notes, due_date, is_completed, completed_at, sort_order, created_at, updated_at
     FROM tasks
     WHERE id = ?`
  ).bind(id).first();
  if (!created) {
    return error("INTERNAL_ERROR", "Nie uda\u0142o si\u0119 utworzy\u0107 zadania.", 500);
  }
  return success(toTask(created), { status: 201 });
}
__name(createTask, "createTask");
async function onRequest5(context) {
  if (context.request.method === "GET") {
    const tasks = await getTasks(context.env);
    return success(tasks);
  }
  if (context.request.method === "POST") {
    try {
      const body = await readJsonBody(context.request);
      return await createTask(context.env, body);
    } catch {
      return error("VALIDATION_ERROR", "Tre\u015B\u0107 \u017C\u0105dania nie jest poprawnym JSON-em.");
    }
  }
  return methodNotAllowed(["GET", "POST"]);
}
__name(onRequest5, "onRequest");

// ../.wrangler/tmp/pages-fa9Yxp/functionsRoutes-0.6584809844890245.mjs
var routes = [
  {
    routePath: "/api/shopping/completed",
    mountPath: "/api/shopping",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/shopping/:id",
    mountPath: "/api/shopping",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/tasks/:id",
    mountPath: "/api/tasks",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  },
  {
    routePath: "/api/shopping",
    mountPath: "/api/shopping",
    method: "",
    middlewares: [],
    modules: [onRequest4]
  },
  {
    routePath: "/api/tasks",
    mountPath: "/api/tasks",
    method: "",
    middlewares: [],
    modules: [onRequest5]
  }
];

// ../node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error2) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error2;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};

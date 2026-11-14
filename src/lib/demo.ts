import type { Bug, Question, Scan } from "./contract";

// Demo data mirroring the planted bugs in dq-demo-app. Replaced by MongoDB (lib/mongo.ts) later.
const BUG_PAGINATION = `export function getPage(todos: Todo[], page: number, pageSize: number) {
  // pages are numbered from 1
  if (pageSize <= 0) return [];
  const start = page * pageSize;
  const end = start + pageSize;
  return todos.slice(start, end);
}`;
const BUG_NULL = `export function summarize(todo: Todo) {
  const id = todo.id;
  const title = todo.title;
  const notes = todo.description.trim();
  const done = todo.done ? "done" : "open";
  return \`\${id}: \${title} (\${done}) \${notes}\`;
}`;
const BUG_ASYNC = `export async function addTodo(db: Db, title: string) {
  const todo = { id: nextId(), title, done: false };
  db.save(todo);
  return todo;
}`;

export const DEMO_BUGS: Bug[] = [
  {
    id: "demo-1", scanId: "demo", file: "src/todos.ts", lineStart: 12, lineEnd: 18,
    category: "off-by-one", severity: "high",
    originalCode: BUG_PAGINATION,
    fixedCode: BUG_PAGINATION.replace("page * pageSize", "(page - 1) * pageSize"),
    explainSimple: "Pages start at 1, but the code multiplied the page number by the page size, so page 1 skipped the first 10 todos. Subtracting 1 first makes page 1 start at the very beginning.",
    explainDeep: "start = page * pageSize treats page as zero-indexed while the API contract is one-indexed, producing an off-by-one-page window. (page - 1) * pageSize restores the slice bounds.",
    sources: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice"],
    locked: true,
  },
  {
    id: "demo-2", scanId: "demo", file: "src/summary.ts", lineStart: 4, lineEnd: 9,
    category: "null-check", severity: "medium",
    originalCode: BUG_NULL,
    fixedCode: BUG_NULL.replace("todo.description.trim()", 'todo.description?.trim() ?? ""'),
    explainSimple: "The description is optional, so it can be missing. Calling .trim() on something that is missing crashes the program. The ?. check skips the call safely and ?? gives an empty note instead.",
    explainDeep: "description is typed string | undefined; dereferencing without optional chaining throws a TypeError at runtime. Optional chaining plus nullish coalescing handles absence without masking empty strings.",
    sources: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining"],
    locked: true,
  },
  {
    id: "demo-3", scanId: "demo", file: "src/db.ts", lineStart: 21, lineEnd: 25,
    category: "async", severity: "high",
    originalCode: BUG_ASYNC,
    fixedCode: BUG_ASYNC.replace("  db.save(todo);", "  await db.save(todo);"),
    explainSimple: "Saving to the database takes time and returns a promise. Without await, the function returns before the save finishes, so the next read can miss the new todo.",
    explainDeep: "db.save returns a Promise that is neither awaited nor returned, so the write races subsequent reads and any rejection becomes unhandled. Awaiting sequences the write and propagates errors.",
    sources: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function"],
    locked: true,
  },
];

export function demoScan(): Omit<Scan, "bugs"> {
  return {
    id: "demo", repoUrl: "https://github.com/thai8899/dq-demo-app", status: "done",
    fixBranch: "debug-quest/fix-demo", prUrl: "https://github.com/thai8899/dq-demo-app/pull/1",
    testsBefore: { pass: 6, fail: 4 }, testsAfter: { pass: 10, fail: 0 },
  };
}

const q = (type: Question["type"], prompt: string, code: string, options: string[], answerIndex: number, hint: string, whyCorrect: string): Question =>
  ({ type, prompt, code, options, answerIndex, hint, whyCorrect });

// Hand-written fallback quizzes so the demo never depends on Gemini being up.
export const CANNED_QUIZZES: Record<string, Question[]> = {
  "demo-1": [
    q("spot-the-line", "Which line has the bug?", BUG_PAGINATION, BUG_PAGINATION.split("\n"), 3,
      "Think about which page number should show the first todo.", "Page 1 should start at index 0, but page * pageSize starts at pageSize."),
    q("predict", "With 25 todos, what does getPage(todos, 1, 10) return?", BUG_PAGINATION,
      ["Todos 1 to 10", "Todos 11 to 20", "An empty list", "Todos 0 to 9, then an error"], 1,
      "Work out start and end for page = 1 and pageSize = 10.", "start = 1 * 10 = 10, so the slice begins at the 11th todo and the first 10 are skipped."),
    q("pick-the-fix", "Which change fixes it?", BUG_PAGINATION,
      ["const start = (page - 1) * pageSize;", "const start = page * pageSize - 1;", "const end = start + pageSize + 1;"], 0,
      "Which option makes page 1 start at index 0?", "(page - 1) * pageSize gives 0 for page 1; the others still skip or overshoot."),
  ],
  "demo-2": [
    q("spot-the-line", "Which line can crash?", BUG_NULL, BUG_NULL.split("\n"), 3,
      "One of these properties is optional.", "description is optional, so calling .trim() on it can throw."),
    q("predict", "What happens when summarize gets a todo with no description?", BUG_NULL,
      ["It returns the text with an empty note", "It throws a TypeError", "It returns undefined", "It prints 'undefined' inside the text"], 1,
      "What does .trim() do on something that is not there?", "Reading .trim from undefined throws a TypeError before the string is built."),
    q("pick-the-fix", "Which change fixes it?", BUG_NULL,
      ['const notes = todo.description?.trim() ?? "";', 'const notes = todo.description.trim() || "";', "const notes = String(todo.description).trim();"], 0,
      "Which option never calls .trim() on a missing value, and gives a clean result?", "Optional chaining skips the call, and ?? supplies an empty note. The || version still throws; String() turns it into the text 'undefined'."),
  ],
  "demo-3": [
    q("spot-the-line", "Which line is the bug?", BUG_ASYNC, BUG_ASYNC.split("\n"), 2,
      "Which line starts slow work but never waits for it?", "db.save returns a promise that nobody waits for."),
    q("predict", "A test calls addTodo and immediately reads the database. What can happen?", BUG_ASYNC,
      ["The read can run before the save finishes and miss the todo", "The function throws because save is async", "Nothing, JavaScript waits automatically", "The todo is saved twice"], 0,
      "Does JavaScript pause on a promise by itself?", "Without await, the save runs in the background while the function returns right away."),
    q("pick-the-fix", "Which change fixes it?", BUG_ASYNC,
      ["await db.save(todo);", "db.save(todo).then();", "setTimeout(() => db.save(todo), 0);"], 0,
      "You need the function to wait for the save to finish.", "await pauses until the save completes. .then() with no handler and setTimeout both still let the function return early."),
  ],
};

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { login, logout, requireUser } from "./auth";
import { pingDatabase } from "./database";
import { AppError } from "./errors";
import { toPublicUser } from "./entity";
import {
  createDraft,
  getAudit,
  getRecord,
  listRecords,
  reviewAsFinance,
  reviewAsManager,
  submitEmr,
  updateFigures,
} from "./emr";
import { listTapRecords, saveTapRecord } from "./tap";
import { createCashier, listCashiers } from "./users";
import { listFacilities } from "./repository";

interface RouteContext {
  req: IncomingMessage;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
}

interface RouteResult {
  status: number;
  body: unknown;
}

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: (context: RouteContext) => Promise<RouteResult>;
}

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PATCH, PUT, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "cache-control": "no-store",
};

function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = path
    .split("/")
    .map((part) => {
      if (part.startsWith(":")) {
        keys.push(part.slice(1));
        return "([^/]+)";
      }

      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");

  return { pattern: new RegExp(`^${source}$`), keys };
}

function route(
  method: string,
  path: string,
  handler: Route["handler"],
): Route {
  const compiled = compile(path);
  return { method, ...compiled, handler };
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    const finish = (value: unknown) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(value);
    };

    const fail = (error: unknown) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    };

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;

      if (size > 1_000_000) {
        fail(new AppError(413, "Request body is too large."));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        finish({});
        return;
      }

      try {
        finish(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        fail(new AppError(400, "Request body must be JSON."));
      }
    });

    req.on("error", fail);
  });
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...corsHeaders,
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

const routes: Route[] = [
  route("GET", "/api/health", async () => {
    await pingDatabase();
    return { status: 200, body: { ok: true } };
  }),

  route("POST", "/api/auth/login", async ({ body }) => {
    return { status: 200, body: await login(body) };
  }),

  route("POST", "/api/auth/logout", async ({ req }) => {
    await logout(req);
    return { status: 200, body: { ok: true } };
  }),

  route("GET", "/api/auth/me", async ({ req }) => {
    const user = await requireUser(req);
    return { status: 200, body: { user: toPublicUser(user) } };
  }),

  route("GET", "/api/facilities", async ({ req }) => {
    const user = await requireUser(req);
    const facilities = await listFacilities(user.facilityIds);
    return {
      status: 200,
      body: {
        facilities: facilities.map((facility) => ({
          id: facility._id,
          name: facility.name,
        })),
      },
    };
  }),

  route("POST", "/api/users", async ({ req, body }) => {
    const user = await requireUser(req);
    return { status: 201, body: await createCashier(user, body) };
  }),

  route("GET", "/api/users", async ({ req }) => {
    const user = await requireUser(req);
    return { status: 200, body: { users: await listCashiers(user) } };
  }),

  route("PUT", "/api/tap", async ({ req, body }) => {
    const user = await requireUser(req);
    return { status: 200, body: await saveTapRecord(user, body) };
  }),

  route("GET", "/api/tap", async ({ req, query }) => {
    const user = await requireUser(req);
    return {
      status: 200,
      body: {
        tapRecords: await listTapRecords(user, {
          facilityId: query.get("facilityId"),
          date: query.get("date"),
        }),
      },
    };
  }),

  route("POST", "/api/emr", async ({ req, body }) => {
    const user = await requireUser(req);
    return { status: 201, body: await createDraft(user, body) };
  }),

  route("GET", "/api/emr", async ({ req, query }) => {
    const user = await requireUser(req);
    return {
      status: 200,
      body: {
        records: await listRecords(user, {
          facilityId: query.get("facilityId"),
          date: query.get("date"),
        }),
      },
    };
  }),

  route("GET", "/api/emr/:id", async ({ req, params }) => {
    const user = await requireUser(req);
    return { status: 200, body: await getRecord(user, params.id) };
  }),

  route("PATCH", "/api/emr/:id", async ({ req, params, body }) => {
    const user = await requireUser(req);
    return { status: 200, body: await updateFigures(user, params.id, body) };
  }),

  route("POST", "/api/emr/:id/submit", async ({ req, params }) => {
    const user = await requireUser(req);
    return { status: 200, body: await submitEmr(user, params.id) };
  }),

  route("POST", "/api/emr/:id/manager-review", async ({ req, params, body }) => {
    const user = await requireUser(req);
    return {
      status: 200,
      body: await reviewAsManager(user, params.id, body),
    };
  }),

  route("POST", "/api/emr/:id/finance-review", async ({ req, params, body }) => {
    const user = await requireUser(req);
    return {
      status: 200,
      body: await reviewAsFinance(user, params.id, body),
    };
  }),

  route("GET", "/api/emr/:id/audit", async ({ req, params }) => {
    const user = await requireUser(req);
    return { status: 200, body: { audit: await getAudit(user, params.id) } };
  }),
];

export function createAppServer() {
  return createServer((req, res) => {
    void handleRequest(req, res);
  });
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  let status = 500;

  try {
    const match = routes.find(
      (candidate) =>
        candidate.method === method && candidate.pattern.test(url.pathname),
    );

    if (!match) {
      status = 404;
      writeJson(res, status, { error: "Not found." });
      return;
    }

    const found = url.pathname.match(match.pattern);
    const params: Record<string, string> = {};

    match.keys.forEach((key, index) => {
      params[key] = decodeURIComponent(found?.[index + 1] ?? "");
    });

    const hasBody = method === "POST" || method === "PATCH" || method === "PUT";
    const body = hasBody ? await readBody(req) : undefined;
    const result = await match.handler({
      req,
      params,
      query: url.searchParams,
      body,
    });
    status = result.status;
    writeJson(res, status, result.body);
  } catch (error) {
    if (error instanceof URIError) {
      status = 400;
      writeJson(res, status, { error: "Invalid request path." });
      return;
    }

    if (error instanceof AppError) {
      status = error.status;
      writeJson(res, status, { error: error.message });
      return;
    }

    status = 500;
    console.error(error);
    writeJson(res, status, { error: "Something went wrong." });
  } finally {
    console.log(`${method} ${url.pathname} ${status}`);
  }
}

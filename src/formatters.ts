import { GWT_BODY_LIMIT } from "@auto-mcp/shared";
import type { CapabilityResult } from "@auto-mcp/site-adapters";

export type JiraFormat =
  | "jira.issues"
  | "jira.board_issues"
  | "jira.issue"
  | "jira.sprints"
  | "jira.projects"
  | "jira.transitions"
  | "jira.comment"
  | "jira.transition";

export const JIRA_FORMATS: readonly JiraFormat[] = [
  "jira.issues",
  "jira.board_issues",
  "jira.issue",
  "jira.sprints",
  "jira.projects",
  "jira.transitions",
  "jira.comment",
  "jira.transition",
] as const;

export function isJiraFormat(format?: string): format is JiraFormat {
  return Boolean(format && (JIRA_FORMATS as readonly string[]).includes(format));
}

/** Example defaults for docs/tests — override per site via capability args. */
export const JIRA_EXAMPLE_PROJECT_KEY = "DATA";
export const JIRA_EXAMPLE_BOARD_ID = "38";

const DEFAULT_FIELDS = [
  "summary",
  "status",
  "assignee",
  "priority",
  "issuetype",
  "updated",
  "created",
  "reporter",
  "labels",
  "parent",
] as const;

export type JiraIssueRow = {
  key: string;
  summary: string;
  status: string;
  assignee: string;
  priority: string;
  issuetype: string;
  updated: string;
  labels: string[];
  url: string;
};

export type JiraSprintRow = {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function parseBody(body: unknown): unknown {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body;
}

function requireConfirm(out: Record<string, unknown>, action: string): void {
  if (out.confirm !== true) {
    throw new Error(
      `Refusing ${action} without confirm:true. Re-call with confirm:true after user approval.`,
    );
  }
  delete out.confirm;
}

function resolveProjectKey(args: Record<string, unknown>): string | undefined {
  const raw = args.project ?? args.projectKey;
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  return s || undefined;
}

function scopeJql(jql: string, project: string): string {
  if (/\bproject\s*=/i.test(jql)) return jql;
  const order = jql.match(/\bORDER\s+BY\b[\s\S]*$/i);
  const where = order ? jql.slice(0, order.index).trim() : jql;
  const orderSql = order ? ` ${order[0].trim()}` : "";
  return where
    ? `project = ${project} AND (${where})${orderSql}`
    : `project = ${project}${orderSql}`;
}

/** Flatten Atlassian Document Format → plain text. */
export function adfToPlainText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  const obj = asRecord(node);
  if (!obj) return "";
  if (typeof obj.text === "string") return obj.text;
  const content = obj.content;
  if (!Array.isArray(content)) return "";
  const parts = content.map((c) => adfToPlainText(c));
  return parts.join(obj.type === "paragraph" ? "\n" : "");
}

export function plainTextToAdf(text: string): Record<string, unknown> {
  const lines = String(text).split(/\n/);
  return {
    type: "doc",
    version: 1,
    content: lines.map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}

function fieldName(fields: Record<string, unknown> | null, key: string): string {
  if (!fields) return "";
  const v = fields[key];
  if (v == null) return "";
  if (typeof v === "string") return v;
  const obj = asRecord(v);
  if (!obj) return String(v);
  if (typeof obj.displayName === "string") return obj.displayName;
  if (typeof obj.name === "string") return obj.name;
  if (typeof obj.value === "string") return obj.value;
  return "";
}

function issueUrl(baseOrigin: string, key: string): string {
  return `${baseOrigin.replace(/\/$/, "")}/browse/${key}`;
}

export function extractIssue(
  body: unknown,
  baseOrigin: string,
): { issue: JiraIssueRow | null; description: string; parseError?: string } {
  const data = asRecord(parseBody(body));
  if (!data) return { issue: null, description: "", parseError: "Expected JSON object" };
  const key = typeof data.key === "string" ? data.key : "";
  if (!key) return { issue: null, description: "", parseError: "Missing issue.key" };
  const fields = asRecord(data.fields) ?? {};
  const labels = Array.isArray(fields.labels) ? fields.labels.map(String) : [];
  return {
    issue: {
      key,
      summary: fieldName(fields, "summary") || String(fields.summary ?? ""),
      status: fieldName(fields, "status"),
      assignee: fieldName(fields, "assignee") || "Unassigned",
      priority: fieldName(fields, "priority"),
      issuetype: fieldName(fields, "issuetype"),
      updated: String(fields.updated ?? ""),
      labels,
      url: issueUrl(baseOrigin, key),
    },
    description: adfToPlainText(fields.description),
  };
}

/** Prefer Jira / problem+json error fields over empty tables. */
export function extractApiError(body: unknown): string | undefined {
  const data = asRecord(parseBody(body));
  if (!data) return undefined;
  if (Array.isArray(data.errorMessages) && data.errorMessages.length) {
    return data.errorMessages.map(String).join("; ");
  }
  const errors = asRecord(data.errors);
  if (errors) {
    const parts = Object.entries(errors)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .filter((s) => s.length > 2);
    if (parts.length) return parts.join("; ");
  }
  const detail = typeof data.detail === "string" ? data.detail.trim() : "";
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (detail && title) return `${title}: ${detail}`;
  if (detail) return detail;
  if (title) return title;
  if (typeof data.message === "string" && data.message.trim()) {
    return data.message.trim();
  }
  if (typeof data.errorMessage === "string" && data.errorMessage.trim()) {
    return data.errorMessage.trim();
  }
  return undefined;
}

export function extractIssues(
  body: unknown,
  baseOrigin: string,
): { issues: JiraIssueRow[]; total?: number; parseError?: string; apiError?: string } {
  const parsed = parseBody(body);
  const data = asRecord(parsed);
  if (!data) return { issues: [], parseError: "Expected JSON object" };
  const apiError = extractApiError(data);
  if (apiError) return { issues: [], apiError };
  const list = Array.isArray(data.issues) ? data.issues : null;
  if (!list) return { issues: [], parseError: "Missing issues[]" };
  const issues: JiraIssueRow[] = [];
  for (const raw of list) {
    const { issue } = extractIssue(raw, baseOrigin);
    if (issue) issues.push(issue);
  }
  const total =
    typeof data.total === "number"
      ? data.total
      : typeof data.total === "string"
        ? Number(data.total)
        : undefined;
  return { issues, total };
}

export function extractSprints(
  body: unknown,
): { sprints: JiraSprintRow[]; parseError?: string; apiError?: string } {
  const data = asRecord(parseBody(body));
  if (!data) return { sprints: [], parseError: "Expected JSON object" };
  const apiError = extractApiError(data);
  if (apiError) return { sprints: [], apiError };
  const list = Array.isArray(data.values) ? data.values : null;
  if (!list) return { sprints: [], parseError: "Missing values[]" };
  const sprints: JiraSprintRow[] = [];
  for (const raw of list) {
    const o = asRecord(raw);
    if (!o || typeof o.id !== "number") continue;
    sprints.push({
      id: o.id,
      name: String(o.name ?? ""),
      state: String(o.state ?? ""),
      startDate: typeof o.startDate === "string" ? o.startDate : undefined,
      endDate: typeof o.endDate === "string" ? o.endDate : undefined,
      goal: typeof o.goal === "string" ? o.goal : undefined,
    });
  }
  return { sprints };
}

export function extractTransitions(
  body: unknown,
): {
  transitions: { id: string; name: string; to: string }[];
  parseError?: string;
  apiError?: string;
} {
  const data = asRecord(parseBody(body));
  if (!data) return { transitions: [], parseError: "Expected JSON object" };
  const apiError = extractApiError(data);
  if (apiError) return { transitions: [], apiError };
  const list = Array.isArray(data.transitions) ? data.transitions : null;
  if (!list) return { transitions: [], parseError: "Missing transitions[]" };
  const transitions = [];
  for (const raw of list) {
    const o = asRecord(raw);
    if (!o) continue;
    const to = asRecord(o.to);
    transitions.push({
      id: String(o.id ?? ""),
      name: String(o.name ?? ""),
      to: String(to?.name ?? ""),
    });
  }
  return { transitions };
}

/**
 * Normalize agent args before replay.
 * - Multi-project: require `project` (or project in JQL) for search
 * - Multi-board: require `boardId` for board/sprint tools
 * - Write tools: require `confirm: true`
 */
export function applyJiraCapabilityArgs(
  args: Record<string, unknown>,
  format: JiraFormat,
): Record<string, unknown> {
  const out = { ...args };

  if (format === "jira.issues") {
    const project = resolveProjectKey(out);
    let jql = typeof out.jql === "string" ? out.jql.trim() : "";
    if (!jql) {
      if (!project) {
        throw new Error(
          "Missing project (or full jql with project = KEY). Example: project=\"DATA\".",
        );
      }
      jql = `project = ${project} ORDER BY updated DESC`;
    } else if (!/\bproject\s*=/i.test(jql)) {
      if (!project) {
        throw new Error(
          "JQL has no project=… — pass `project` (e.g. DATA) or include project in jql.",
        );
      }
      jql = scopeJql(jql, project);
    }
    out.jql = jql;
    if (out.maxResults === undefined) out.maxResults = 50;
    if (out.fields === undefined) out.fields = [...DEFAULT_FIELDS];
    delete out.project;
    delete out.projectKey;
    delete out.boardId;
  }

  if (format === "jira.board_issues") {
    const boardId = out.boardId != null ? String(out.boardId).trim() : "";
    if (!boardId) {
      throw new Error("Missing boardId (Agile board id, e.g. \"38\").");
    }
    out.boardId = boardId;
    const project = resolveProjectKey(out);
    if (typeof out.jql === "string" && out.jql.trim()) {
      let jql = out.jql.trim();
      if (!/\bproject\s*=/i.test(jql)) {
        if (!project) {
          throw new Error(
            "Board jql has no project=… — pass `project` or include project in jql.",
          );
        }
        jql = scopeJql(jql, project);
      }
      out.jql = jql;
    }
    if (out.maxResults === undefined) out.maxResults = 50;
    delete out.project;
    delete out.projectKey;
    delete out.fields;
  }

  if (format === "jira.sprints") {
    const boardId = out.boardId != null ? String(out.boardId).trim() : "";
    if (!boardId) {
      throw new Error("Missing boardId (Agile board id, e.g. \"38\").");
    }
    out.boardId = boardId;
  }

  if (format === "jira.comment") {
    requireConfirm(out, "add_comment");
    const text = out.text ?? out.comment;
    if (typeof text === "string" && text.trim()) {
      out.body = plainTextToAdf(text.trim());
    }
    delete out.text;
    delete out.comment;
    if (!out.body) {
      throw new Error("Missing comment text. Pass `text` (plain string).");
    }
  }

  if (format === "jira.transition") {
    requireConfirm(out, "transition_issue");
    const id = out.transitionId ?? out.transition;
    if (id === undefined || id === null || String(id).trim() === "") {
      throw new Error("Missing transitionId (from list_transitions).");
    }
    if (typeof id === "object" && id && "id" in (id as object)) {
      out.transition = id;
    } else {
      out.transition = { id: String(id).trim() };
    }
    delete out.transitionId;
  }

  if (
    (format === "jira.issue" ||
      format === "jira.comment" ||
      format === "jira.transitions" ||
      format === "jira.transition") &&
    (out.issueKey === undefined || String(out.issueKey).trim() === "")
  ) {
    throw new Error("Missing issueKey (e.g. DATA-123).");
  }

  return out;
}

function issuesTable(issues: JiraIssueRow[]): string {
  if (issues.length === 0) return "_No issues._";
  const lines = [
    "| Key | Type | Status | Assignee | Summary |",
    "|-----|------|--------|----------|---------|",
    ...issues.map(
      (i) =>
        `| [${i.key}](${i.url}) | ${i.issuetype} | ${i.status} | ${i.assignee} | ${i.summary.replace(/\|/g, "/")} |`,
    ),
  ];
  return lines.join("\n");
}

export function jiraOutputSchema(format: JiraFormat): Record<string, unknown> {
  const issueItem = {
    type: "object",
    properties: {
      key: { type: "string" },
      summary: { type: "string" },
      status: { type: "string" },
      assignee: { type: "string" },
      priority: { type: "string" },
      issuetype: { type: "string" },
      updated: { type: "string" },
      labels: { type: "array", items: { type: "string" } },
      url: { type: "string" },
    },
    required: ["key", "summary", "status", "assignee", "url"],
  };
  const base = {
    type: "object",
    properties: {
      status: { type: "number", description: "HTTP status" },
      ok: { type: "boolean" },
      capability: { type: "string" },
      count: { type: "number", description: "Rows in this page" },
      parseError: { type: "string" },
      apiError: { type: "string" },
    },
    required: ["status", "ok", "capability"],
  };
  if (format === "jira.issues" || format === "jira.board_issues") {
    return {
      ...base,
      properties: {
        ...base.properties,
        total: { type: "number", description: "Total matches when API provides it" },
        issues: { type: "array", items: issueItem },
      },
    };
  }
  if (format === "jira.issue") {
    return {
      ...base,
      properties: {
        ...base.properties,
        issue: issueItem,
        description: {
          type: "string",
          description: "Plain-text description (ADF flattened)",
        },
      },
    };
  }
  if (format === "jira.sprints") {
    return {
      ...base,
      properties: {
        ...base.properties,
        sprints: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number" },
              name: { type: "string" },
              state: { type: "string" },
              startDate: { type: "string" },
              endDate: { type: "string" },
              goal: { type: "string" },
            },
            required: ["id", "name", "state"],
          },
        },
      },
    };
  }
  if (format === "jira.transitions") {
    return {
      ...base,
      properties: {
        ...base.properties,
        transitions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              to: { type: "string", description: "Target status name" },
            },
            required: ["id", "name", "to"],
          },
        },
      },
    };
  }
  return base;
}

export function formatJiraCapability(opts: {
  format: JiraFormat;
  body: unknown;
  meta: Record<string, unknown>;
  includeRaw?: boolean;
  baseOrigin: string;
}): CapabilityResult {
  const { format, body, meta, includeRaw, baseOrigin } = opts;
  const raw = typeof body === "string" ? body : JSON.stringify(body, null, 2);
  const ok = Boolean(meta.ok);

  let text = "";
  let extra: Record<string, unknown> = {};

  if (format === "jira.issues" || format === "jira.board_issues") {
    const { issues, total, parseError, apiError } = extractIssues(body, baseOrigin);
    extra = { issues, total, count: issues.length, parseError, apiError };
    if (!ok || apiError) {
      text = [
        `${meta.capability} · HTTP ${meta.status} · failed`,
        apiError ? `API: ${apiError}` : null,
        parseError ? `parse: ${parseError}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    } else {
      text = [
        `${meta.capability} · HTTP ${meta.status} · ok · ${issues.length} issue(s)${total != null ? ` (total≈${total})` : ""}`,
        "",
        issuesTable(issues),
      ].join("\n");
    }
  } else if (format === "jira.issue") {
    const apiError = extractApiError(body);
    const { issue, description, parseError } = extractIssue(body, baseOrigin);
    extra = { issue, description, count: issue ? 1 : 0, parseError, apiError };
    if (!ok || apiError) {
      text = [
        `${meta.capability} · HTTP ${meta.status} · failed`,
        apiError ? `API: ${apiError}` : null,
        parseError ? `parse: ${parseError}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    } else {
      text = issue
        ? [
            `**${issue.key}** · ${issue.issuetype} · ${issue.status} · ${issue.assignee}`,
            issue.summary,
            issue.priority ? `Priority: ${issue.priority}` : null,
            issue.labels.length ? `Labels: ${issue.labels.join(", ")}` : null,
            issue.url,
            description ? `\n---\n${description}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        : `${meta.capability} · HTTP ${meta.status} · ${parseError ?? "no issue"}`;
    }
  } else if (format === "jira.sprints") {
    const { sprints, parseError, apiError } = extractSprints(body);
    extra = { sprints, count: sprints.length, parseError, apiError };
    if (!ok || apiError) {
      text = [
        `${meta.capability} · HTTP ${meta.status} · failed`,
        apiError ? `API: ${apiError}` : null,
        parseError ? `parse: ${parseError}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    } else {
      const rows =
        sprints.length === 0
          ? "_No sprints._"
          : [
              "| Id | State | Name | Start | End |",
              "|----|-------|------|-------|-----|",
              ...sprints.map(
                (s) =>
                  `| ${s.id} | ${s.state} | ${s.name} | ${s.startDate?.slice(0, 10) ?? ""} | ${s.endDate?.slice(0, 10) ?? ""} |`,
              ),
            ].join("\n");
      text = [`${meta.capability} · ${sprints.length} sprint(s)`, "", rows].join("\n");
    }
  } else if (format === "jira.transitions") {
    const { transitions, parseError, apiError } = extractTransitions(body);
    extra = { transitions, count: transitions.length, parseError, apiError };
    text = !ok || apiError
      ? [
          `${meta.capability} · HTTP ${meta.status} · failed`,
          apiError ? `API: ${apiError}` : null,
          parseError ? `parse: ${parseError}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : [
          `${meta.capability} · ${transitions.length} transition(s)`,
          ...transitions.map((t) => `- **${t.id}**: ${t.name} → ${t.to}`),
        ].join("\n");
  } else if (format === "jira.comment" || format === "jira.transition") {
    const apiError = extractApiError(body);
    extra = { count: ok ? 1 : 0, apiError };
    text = ok
      ? `${meta.capability} · HTTP ${meta.status} · ok`
      : [
          `${meta.capability} · HTTP ${meta.status} · failed`,
          apiError ? `API: ${apiError}` : null,
        ]
          .filter(Boolean)
          .join("\n");
  }

  return {
    content: [{ type: "text", text: text || `${meta.capability} · HTTP ${meta.status}` }],
    structuredContent: {
      ...meta,
      ...extra,
      ...(includeRaw
        ? {
            rawBody:
              raw.length > GWT_BODY_LIMIT ? raw.slice(0, GWT_BODY_LIMIT) : raw,
            rawTruncated: raw.length > GWT_BODY_LIMIT,
          }
        : {}),
    },
    ...(ok ? {} : { isError: true }),
  };
}

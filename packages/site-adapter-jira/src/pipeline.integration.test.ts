import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defToCapability, runPipeline } from "@auto-mcp/site-adapters/bound.js";
import type { AdapterContext, SiteAdapter } from "@auto-mcp/site-adapters/types.js";
import type { CapabilityDef, McpSite, ToolDef } from "@auto-mcp/shared";
import { jiraAdapter } from "./adapter.js";

describe("runPipeline (Jira pack)", () => {
  const site = {
    id: "s1",
    name: "Jira",
    baseUrl: "https://example.atlassian.net/",
    explorePath: "/",
    status: "ready",
    cursorMcpKey: "jira",
    profileDir: "/tmp",
    tools: [],
    candidates: [],
    proposedTools: [],
    capabilities: [],
    chatAgentId: null,
    chatMessages: [],
    exploreRounds: [],
    exploreFocus: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastAuthAt: null,
    lastExploreAt: null,
    replayMode: "http",
    observedActions: [],
    endpointIr: [],
  } as McpSite;

  function tool(name: string, url: string): ToolDef {
    return {
      name,
      description: name,
      method: "GET",
      url,
      inputSchema: { type: "object", properties: {} },
      outputSchema: { type: "object", properties: {} },
      annotations: {},
      captureContext: {},
      argBindings: {
        issueKey: { in: "path", key: "issueKey" },
      },
      headers: {},
      approved: true,
    };
  }

  it("runs two steps and fail-fast on first error", async () => {
    const primitives: ToolDef[] = [
      tool(
        "jira_get_issue",
        "https://example.atlassian.net/rest/api/3/issue/{issueKey}",
      ),
      tool(
        "jira_get_transitions",
        "https://example.atlassian.net/rest/api/3/issue/{issueKey}/transitions",
      ),
    ];

    let calls = 0;
    const ctx: AdapterContext = {
      site,
      auth: {
        cookies: [],
        authHeaders: {},
        authHeadersByOrigin: {},
        capturedAt: new Date().toISOString(),
        origin: "https://example.atlassian.net",
      },
      primitives,
      replay: async (_tool, _args) => {
        calls += 1;
        if (calls === 1) {
          return {
            status: 200,
            body: {
              key: "DATA-1",
              fields: {
                summary: "Hi",
                status: { name: "To Do" },
                assignee: { displayName: "A" },
                issuetype: { name: "Task" },
                labels: [],
              },
            },
          };
        }
        return {
          status: 200,
          body: {
            transitions: [{ id: "11", name: "Start", to: { name: "In Progress" } }],
          },
        };
      },
    };

    const ok = await runPipeline(ctx, {
      capability: "get_issue_with_transitions",
      steps: [
        {
          primitive: "jira_get_issue",
          args: { issueKey: "{{input.issueKey}}" },
          format: "jira.issue",
        },
        {
          primitive: "jira_get_transitions",
          args: { issueKey: "{{input.issueKey}}" },
          format: "jira.transitions",
        },
      ],
      args: { issueKey: "DATA-1" },
      adapter: jiraAdapter,
    });
    assert.equal(ok.isError, undefined);
    assert.equal(ok.structuredContent?.pipeline, true);
    assert.equal(calls, 2);

    calls = 0;
    const ctxFail: AdapterContext = {
      ...ctx,
      replay: async () => {
        calls += 1;
        return { status: 400, body: { errorMessages: ["boom"] } };
      },
    };
    const bad = await runPipeline(ctxFail, {
      capability: "get_issue_with_transitions",
      steps: [
        {
          primitive: "jira_get_issue",
          args: { issueKey: "{{input.issueKey}}" },
          format: "jira.issue",
        },
        {
          primitive: "jira_get_transitions",
          args: { issueKey: "{{input.issueKey}}" },
          format: "jira.transitions",
        },
      ],
      args: { issueKey: "DATA-1" },
      adapter: jiraAdapter,
    });
    assert.equal(bad.isError, true);
    assert.equal(bad.structuredContent?.failedStep, 0);
    assert.equal(calls, 1);
  });

  it("defToCapability builds pipeline capability", () => {
    const def: CapabilityDef = {
      name: "pipe",
      description: "p",
      inputSchema: { type: "object", properties: {} },
      bind: {
        kind: "pipeline",
        steps: [
          {
            primitive: "jira_get_issue",
            args: { issueKey: "{{input.issueKey}}" },
            format: "jira.issue",
          },
        ],
      },
      enabled: true,
      updatedAt: new Date().toISOString(),
    };
    const cap = defToCapability(def, jiraAdapter as SiteAdapter);
    assert.ok(cap);
    assert.equal(cap?.bind?.kind, "pipeline");
  });
});

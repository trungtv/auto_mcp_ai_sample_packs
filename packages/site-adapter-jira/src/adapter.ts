import { runPipeline } from "@auto-mcp/site-adapters/bound.js";
import {
  findPrimitive,
  type Capability,
  type FormatContext,
  type SiteAdapter,
} from "@auto-mcp/site-adapters/types.js";
import {
  applyJiraCapabilityArgs,
  formatJiraCapability,
  isJiraFormat,
  jiraOutputSchema,
  JIRA_FORMATS,
  type JiraFormat,
} from "./formatters.js";

function buildPipelineSeeds(
  primitives: Parameters<SiteAdapter["capabilities"]>[0]["primitives"],
): Capability[] {
  const getIssue = findPrimitive(primitives, "jira_get_issue");
  const getTransitions = findPrimitive(primitives, "jira_get_transitions");
  if (!getIssue || !getTransitions) return [];

  return [
    {
      name: "get_issue_with_transitions",
      title: "Issue + available transitions",
      description:
        "Pipeline: get_issue → list_transitions for one issueKey (deterministic two-step).",
      inputSchema: {
        type: "object",
        properties: {
          issueKey: {
            type: "string",
            description: "Jira issue key, e.g. DATA-123",
          },
          includeRaw: { type: "boolean" },
        },
        required: ["issueKey"],
        additionalProperties: false,
      },
      outputSchema: jiraOutputSchema("jira.transitions"),
      annotations: {
        title: "Issue + transitions",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      supportsMutation: false,
      bind: {
        kind: "pipeline",
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
        format: "jira.transitions",
      },
      execute: (ctx, args) =>
        runPipeline(ctx, {
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
          format: "jira.transitions",
          args,
          adapter: jiraAdapter,
        }),
    },
  ];
}

export const jiraAdapter: SiteAdapter = {
  id: "jira",
  match: (site) => {
    try {
      const host = new URL(site.baseUrl).hostname.toLowerCase();
      return host.endsWith(".atlassian.net") || host === "atlassian.net";
    } catch {
      return false;
    }
  },
  knownFormats: JIRA_FORMATS,
  supportsFormat: (format) => isJiraFormat(format),
  capabilities: ({ primitives }) => buildPipelineSeeds(primitives),
  applyArgs: (format, args) => {
    if (!isJiraFormat(format)) {
      throw new Error(`Jira pack does not own format \`${format}\``);
    }
    return applyJiraCapabilityArgs(args, format);
  },
  outputSchemaForFormat: (format) => {
    if (!isJiraFormat(format)) {
      throw new Error(`Jira pack does not own format \`${format}\``);
    }
    return jiraOutputSchema(format);
  },
  formatCapability: (ctx: FormatContext) =>
    formatJiraCapability({
      format: ctx.format as JiraFormat,
      body: ctx.body,
      meta: ctx.meta,
      includeRaw: ctx.includeRaw,
      baseOrigin: new URL(ctx.site.baseUrl).origin,
    }),
};

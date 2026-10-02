import type { CapabilityResult } from "@auto-mcp/site-adapters/types.js";
export type JiraFormat = "jira.issues" | "jira.board_issues" | "jira.issue" | "jira.sprints" | "jira.projects" | "jira.transitions" | "jira.comment" | "jira.transition";
export declare const JIRA_FORMATS: readonly JiraFormat[];
export declare function isJiraFormat(format?: string): format is JiraFormat;
/** Example defaults for docs/tests — override per site via capability args. */
export declare const JIRA_EXAMPLE_PROJECT_KEY = "DATA";
export declare const JIRA_EXAMPLE_BOARD_ID = "38";
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
/** Flatten Atlassian Document Format → plain text. */
export declare function adfToPlainText(node: unknown): string;
export declare function plainTextToAdf(text: string): Record<string, unknown>;
export declare function extractIssue(body: unknown, baseOrigin: string): {
    issue: JiraIssueRow | null;
    description: string;
    parseError?: string;
};
/** Prefer Jira / problem+json error fields over empty tables. */
export declare function extractApiError(body: unknown): string | undefined;
export declare function extractIssues(body: unknown, baseOrigin: string): {
    issues: JiraIssueRow[];
    total?: number;
    parseError?: string;
    apiError?: string;
};
export declare function extractSprints(body: unknown): {
    sprints: JiraSprintRow[];
    parseError?: string;
    apiError?: string;
};
export declare function extractTransitions(body: unknown): {
    transitions: {
        id: string;
        name: string;
        to: string;
    }[];
    parseError?: string;
    apiError?: string;
};
/**
 * Normalize agent args before replay.
 * - Multi-project: require `project` (or project in JQL) for search
 * - Multi-board: require `boardId` for board/sprint tools
 * - Write tools: require `confirm: true`
 */
export declare function applyJiraCapabilityArgs(args: Record<string, unknown>, format: JiraFormat): Record<string, unknown>;
export declare function jiraOutputSchema(format: JiraFormat): Record<string, unknown>;
export declare function formatJiraCapability(opts: {
    format: JiraFormat;
    body: unknown;
    meta: Record<string, unknown>;
    includeRaw?: boolean;
    baseOrigin: string;
}): CapabilityResult;
//# sourceMappingURL=formatters.d.ts.map
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyJiraCapabilityArgs,
  extractIssues,
  extractSprints,
  formatJiraCapability,
  plainTextToAdf,
  adfToPlainText,
} from "./formatters.js";

describe("applyJiraCapabilityArgs", () => {
  it("requires project when jql empty", () => {
    assert.throws(() => applyJiraCapabilityArgs({}, "jira.issues"), /Missing project/);
  });

  it("builds default jql from project", () => {
    const out = applyJiraCapabilityArgs({ project: "FOO" }, "jira.issues");
    assert.equal(out.jql, "project = FOO ORDER BY updated DESC");
    assert.equal(out.maxResults, 50);
    assert.equal(out.project, undefined);
    assert.equal(out.boardId, undefined);
  });

  it("scopes bare jql with project and keeps ORDER BY outside", () => {
    const out = applyJiraCapabilityArgs(
      {
        project: "DATA",
        jql: "assignee = currentUser() ORDER BY updated DESC",
      },
      "jira.issues",
    );
    assert.equal(
      out.jql,
      "project = DATA AND (assignee = currentUser()) ORDER BY updated DESC",
    );
  });

  it("requires boardId for board issues and sprints", () => {
    assert.throws(
      () => applyJiraCapabilityArgs({ maxResults: 5 }, "jira.board_issues"),
      /Missing boardId/,
    );
    assert.throws(() => applyJiraCapabilityArgs({}, "jira.sprints"), /Missing boardId/);
  });

  it("accepts boardId for board issues without forcing jql", () => {
    const out = applyJiraCapabilityArgs(
      { boardId: "38", maxResults: 10 },
      "jira.board_issues",
    );
    assert.equal(out.boardId, "38");
    assert.equal(out.jql, undefined);
    assert.equal(out.fields, undefined);
  });

  it("requires confirm:true for comment and transition", () => {
    assert.throws(
      () =>
        applyJiraCapabilityArgs(
          { issueKey: "DATA-1", text: "hi" },
          "jira.comment",
        ),
      /confirm:true/,
    );
    assert.throws(
      () =>
        applyJiraCapabilityArgs(
          { issueKey: "DATA-1", transitionId: "131" },
          "jira.transition",
        ),
      /confirm:true/,
    );
  });

  it("maps text → ADF body for comments when confirmed", () => {
    const out = applyJiraCapabilityArgs(
      { issueKey: "DATA-1", text: "hello\nworld", confirm: true },
      "jira.comment",
    );
    assert.deepEqual(out.body, plainTextToAdf("hello\nworld"));
    assert.equal(out.text, undefined);
    assert.equal(out.confirm, undefined);
  });

  it("rejects comment without text", () => {
    assert.throws(
      () =>
        applyJiraCapabilityArgs(
          { issueKey: "DATA-1", confirm: true },
          "jira.comment",
        ),
      /Missing comment text/,
    );
  });
});

describe("extractIssues / sprints", () => {
  it("extracts issue rows with site origin", () => {
    const { issues } = extractIssues(
      {
        total: 1,
        issues: [
          {
            key: "DATA-9",
            fields: {
              summary: "Fix pipeline",
              status: { name: "In Progress" },
              assignee: { displayName: "Alice" },
              priority: { name: "High" },
              issuetype: { name: "Story" },
              updated: "2026-08-10T01:00:00.000+0700",
              labels: ["data"],
            },
          },
        ],
      },
      "https://example.atlassian.net",
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.key, "DATA-9");
    assert.equal(issues[0]?.status, "In Progress");
    assert.equal(issues[0]?.assignee, "Alice");
    assert.match(issues[0]?.url ?? "", /browse\/DATA-9/);
  });

  it("surfaces apiError from errorMessages", () => {
    const { apiError, issues } = extractIssues(
      { errorMessages: ["Bad JQL"], errors: {} },
      "https://example.atlassian.net",
    );
    assert.equal(issues.length, 0);
    assert.match(apiError ?? "", /Bad JQL/);
  });

  it("surfaces apiError from problem+json title/detail", () => {
    const { apiError, issues } = extractIssues(
      {
        title: "Bad Request",
        detail: "Board id 'x' is not a number",
        status: 400,
      },
      "https://example.atlassian.net",
    );
    assert.equal(issues.length, 0);
    assert.match(apiError ?? "", /Bad Request/);
    assert.match(apiError ?? "", /not a number/);
  });

  it("surfaces apiError from errors map", () => {
    const { apiError } = extractIssues(
      { errorMessages: [], errors: { jql: "Unexpected end of JQL query" } },
      "https://example.atlassian.net",
    );
    assert.match(apiError ?? "", /jql: Unexpected/);
  });

  it("extracts sprints", () => {
    const { sprints } = extractSprints({
      values: [
        { id: 101, name: "Sprint 12", state: "active", startDate: "2026-08-01" },
      ],
    });
    assert.equal(sprints[0]?.id, 101);
    assert.equal(sprints[0]?.state, "active");
  });
});

describe("adf roundtrip", () => {
  it("plain → adf → plain", () => {
    const adf = plainTextToAdf("a\nb");
    assert.match(adfToPlainText(adf), /a/);
    assert.match(adfToPlainText(adf), /b/);
  });
});

describe("formatJiraCapability errors", () => {
  it("prefers API error text over empty issues table when !ok", () => {
    const result = formatJiraCapability({
      format: "jira.issues",
      body: {
        title: "Bad Request",
        detail: "Board id is invalid",
      },
      meta: { ok: false, status: 400, capability: "search_issues" },
      baseOrigin: "https://example.atlassian.net",
    });
    const text = result.content[0]?.type === "text" ? result.content[0].text : "";
    assert.match(text, /failed/);
    assert.match(text, /Board id is invalid/);
    assert.doesNotMatch(text, /No issues/);
    assert.equal(result.isError, true);
  });
});

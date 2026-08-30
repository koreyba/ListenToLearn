import { appendFile } from "node:fs/promises";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";

const cancelledFailureTypes = new Set([
  "cancelledByParent",
  "testAborted",
  "testTimeoutFailure",
]);

function escapeMarkdown(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replace(/([\\`*_{}\[\]()#+|])/g, "\\$1")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs)) {
    return "unknown duration";
  }
  if (durationMs < 1000) {
    return `${Math.round(durationMs)} ms`;
  }
  return `${(durationMs / 1000).toFixed(2)} s`;
}

function formatLocation(data) {
  if (!data.file) {
    return "location unavailable";
  }

  let file = data.file;
  if (file.startsWith("file:")) {
    file = fileURLToPath(file);
  }
  const repositoryPath = relative(process.cwd(), file) || file;
  const line = Number.isInteger(data.line) ? `:${data.line}` : "";
  const column = Number.isInteger(data.column) ? `:${data.column}` : "";
  return escapeMarkdown(`${repositoryPath}${line}${column}`);
}

function reason(value) {
  return typeof value === "string" && value.trim()
    ? escapeMarkdown(value)
    : "No reason provided";
}

function failureMessage(data) {
  const message = data.details?.error?.message || "No failure message provided";
  const collapsed = String(message).replace(/\s+/g, " ").trim();
  const bounded = collapsed.length > 300 ? `${collapsed.slice(0, 297)}...` : collapsed;
  return escapeMarkdown(bounded);
}

function testEntry(data) {
  return {
    location: formatLocation(data),
    name: escapeMarkdown(data.name || "Unnamed test"),
  };
}

function formatNamedSection(lines, heading, entries, renderEntry) {
  if (entries.length === 0) {
    return;
  }

  lines.push("", `### ${heading} (${entries.length})`, "");
  for (const entry of entries) {
    lines.push(renderEntry(entry));
  }
}

function formatSummary({ cancelled, failed, rootSummary, skipped, todo }) {
  const hasAuthoritativeSummary = rootSummary !== null;
  const counts = hasAuthoritativeSummary
    ? rootSummary.counts
    : {
        cancelled: cancelled.length,
        failed: failed.length,
        passed: 0,
        skipped: skipped.length,
        tests: cancelled.length + failed.length + skipped.length + todo.length,
        todo: todo.length,
      };
  const successful = hasAuthoritativeSummary && rootSummary.success;
  const status = successful
    ? "✅ Test run completed without failures"
    : hasAuthoritativeSummary
      ? "❌ Test run failed"
      : "⚠️ Test run ended without an authoritative final summary";
  const lines = [
    "## 🧪 Test results",
    "",
    `**${status}** · ${formatDuration(rootSummary?.duration_ms)}`,
    "",
    "| Total | Passed | Failed | Skipped | Todo | Cancelled |",
    "| ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${counts.tests} | ${counts.passed} | ${counts.failed} | ${counts.skipped} | ${counts.todo} | ${counts.cancelled} |`,
  ];

  const mismatches = [
    ["failed", counts.failed, failed.length],
    ["skipped", counts.skipped, skipped.length],
    ["todo", counts.todo, todo.length],
    ["cancelled", counts.cancelled, cancelled.length],
  ].filter(([, count, captured]) => count !== captured);

  if (mismatches.length > 0) {
    const details = mismatches
      .map(([kind, count, captured]) => `${kind}: runner=${count}, named=${captured}`)
      .join("; ");
    lines.push("", `> ⚠️ Name capture differs from the Node counters (${details}). The table uses the authoritative Node summary.`);
  }

  formatNamedSection(lines, "❌ Failed tests", failed, (entry) =>
    `- **${entry.name}** — ${entry.location}\n  - ${entry.message}`,
  );
  formatNamedSection(lines, "⏭️ Skipped tests", skipped, (entry) =>
    `- **${entry.name}** — ${entry.location} — ${entry.reason}`,
  );
  formatNamedSection(lines, "📝 Todo tests", todo, (entry) =>
    `- **${entry.name}** — ${entry.location} — ${entry.reason}`,
  );
  formatNamedSection(lines, "⛔ Cancelled tests", cancelled, (entry) =>
    `- **${entry.name}** — ${entry.location} — ${entry.message}`,
  );

  lines.push("");
  return { counts, markdown: lines.join("\n") };
}

export default async function* githubActionsTestReporter(source) {
  const cancelled = [];
  const failed = [];
  const skipped = [];
  const todo = [];
  let rootSummary = null;

  for await (const event of source) {
    if (event.type === "test:summary" && event.data.file === undefined) {
      rootSummary = event.data;
      continue;
    }
    if (event.type !== "test:pass" && event.type !== "test:fail") {
      continue;
    }

    const data = event.data;
    if (data.details?.type === "suite") {
      continue;
    }
    const entry = testEntry(data);

    if (data.skip !== undefined) {
      skipped.push({ ...entry, reason: reason(data.skip) });
    } else if (data.todo !== undefined) {
      todo.push({ ...entry, reason: reason(data.todo) });
    } else if (cancelledFailureTypes.has(data.details?.error?.failureType)) {
      cancelled.push({ ...entry, message: failureMessage(data) });
    } else if (
      event.type === "test:fail" &&
      data.details?.error?.failureType !== "subtestsFailed"
    ) {
      failed.push({ ...entry, message: failureMessage(data) });
    }
  }

  const { counts, markdown } = formatSummary({
    cancelled,
    failed,
    rootSummary,
    skipped,
    todo,
  });
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    await appendFile(summaryPath, markdown, "utf8");
  } else {
    yield `\n${markdown}\n`;
  }
  yield `TEST_SUMMARY total=${counts.tests} passed=${counts.passed} failed=${counts.failed} skipped=${counts.skipped} todo=${counts.todo} cancelled=${counts.cancelled}\n`;
}

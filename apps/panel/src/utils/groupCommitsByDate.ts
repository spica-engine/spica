import type {LogCommit} from "../store/api/versionControlApi";
import type {Commit} from "../types/version-control";
import {formatRelativeTime} from "./formatRelativeTime";

export function groupCommitsByDate(
  commits: LogCommit[]
): {dateLabel: string; commits: Commit[]}[] {
  const grouped = new Map<string, Commit[]>();

  for (const c of commits) {
    const date = new Date(c.date);
    const dateKey = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });

    const mapped: Commit = {
      title: c.message,
      hash: c.hash.slice(0, 7),
      author: c.author_name,
      relativeTime: formatRelativeTime(c.date)
    };

    const existing = grouped.get(dateKey);
    if (existing) {
      existing.push(mapped);
    } else {
      grouped.set(dateKey, [mapped]);
    }
  }

  return Array.from(grouped.entries()).map(([dateKey, commits]) => ({
    dateLabel: `Commits on ${dateKey}`,
    commits
  }));
}

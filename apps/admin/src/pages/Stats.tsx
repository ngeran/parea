// Privacy-friendly counters only (§7.11) — no per-user tracking anywhere.

import { useQuery } from "@tanstack/react-query";
import { api, type Stats } from "../api";

const LABELS: Array<{ key: keyof Stats; label: string }> = [
  { key: "users", label: "Users" },
  { key: "open_requests", label: "Open requests" },
  { key: "matches", label: "Active matches" },
  { key: "messages_24h", label: "Messages (24 h)" },
  { key: "plans_upcoming", label: "Upcoming plans" },
  { key: "reports_open", label: "Open reports" },
];

export function Stats({ onOpenReports }: { onOpenReports: () => void }) {
  const { data, isPending, error } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api<Stats>("/admin/stats"),
    refetchInterval: 60_000,
  });

  if (isPending) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{(error as Error).message}</p>;

  return (
    <>
      <div className="cards">
        {LABELS.map(({ key, label }) => (
          <div className="card" key={key}>
            <div className="card-value">{data![key]}</div>
            <div className="card-label">{label}</div>
            {key === "reports_open" && data![key] > 0 && (
              <button type="button" className="btn subtle" onClick={onOpenReports}>
                Review reports
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="muted">
        Counters only — no per-user analytics are collected anywhere in Together.
      </p>
    </>
  );
}

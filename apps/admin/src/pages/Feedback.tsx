// Read-only suggestion box: everything users sent from the in-app button,
// newest first. Anonymous rows are deleted accounts.

import { useQuery } from "@tanstack/react-query";
import { api, type FeedbackRow } from "../api";

export function Feedback() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["feedback"],
    queryFn: () => api<{ feedback: FeedbackRow[] }>("/admin/feedback"),
  });

  return (
    <>
      {isPending && <p className="muted">Loading…</p>}
      {isError && <p className="error">Could not load feedback.</p>}
      {data && data.feedback.length === 0 && <p className="muted">No feedback yet.</p>}

      <div className="stack">
        {data?.feedback.map((item) => (
          <div className="panel" key={item.id}>
            <div className="panel-head">
              <strong>{item.first_name ?? "Deleted account"}</strong>
              <span className="muted">{formatDateTime(item.created_at)}</span>
            </div>
            <p>{item.message}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

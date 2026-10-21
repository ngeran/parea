// Report queue. Open reports first; every action is two-step (ConfirmButton)
// because warn and disable both reach a real user. Dismiss/warn/disable map
// 1:1 to POST /admin/reports/:id/action.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ReportRow } from "../api";
import { ConfirmButton } from "./Users";

type StatusFilter = "open" | "actioned" | "dismissed";

export function Reports() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("open");
  const [error, setError] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["reports", status],
    queryFn: () => api<{ reports: ReportRow[] }>("/admin/reports", { query: { status } }),
  });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "dismiss" | "warn" | "disable" }) =>
      api(`/admin/reports/${id}/action`, { body: { action } }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) => setError((err as Error).message),
  });

  const reports = data?.reports ?? [];

  return (
    <>
      <div className="toolbar">
        {(["open", "actioned", "dismissed"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            className={status === s ? "tab active" : "tab"}
            onClick={() => setStatus(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {isPending && <p className="muted">Loading…</p>}

      {data && reports.length === 0 && <p className="muted">No {status} reports.</p>}

      <div className="stack">
        {reports.map((report) => (
          <div className="panel" key={report.id}>
            <div className="panel-head">
              <strong>
                {report.reporter_name ?? "Deleted user"} reported {report.target_name ?? "a deleted user"}
              </strong>
              <span className="muted">{formatDateTime(report.created_at)}</span>
            </div>
            <p className="reason">Reason: {report.reason}</p>
            {report.details && <p className="details">{report.details}</p>}
            {report.status === "open" && (
              <div className="actions">
                <ConfirmButton
                  className="btn subtle"
                  label="Dismiss"
                  onConfirm={() => act.mutate({ id: report.id, action: "dismiss" })}
                />
                <ConfirmButton
                  className="btn subtle"
                  label="Warn user"
                  confirmLabel="Send warning?"
                  onConfirm={() => act.mutate({ id: report.id, action: "warn" })}
                />
                <ConfirmButton
                  className="btn danger"
                  label="Disable user"
                  confirmLabel="Disable for real?"
                  onConfirm={() => act.mutate({ id: report.id, action: "disable" })}
                />
              </div>
            )}
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

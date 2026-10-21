// Volunteer applications: light vetting — read the profile, check the phone
// is verified, approve or reject. The badge is a trust mark, not a background
// check (that would need a partner organization).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type VolunteerApplication } from "../api";
import { ConfirmButton } from "./Users";

export function Volunteers() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["volunteers"],
    queryFn: () => api<{ volunteers: VolunteerApplication[] }>("/admin/volunteers"),
  });

  const act = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: "approve" | "reject" }) =>
      api(`/admin/volunteers/${id}/${verb}`, { method: "POST", body: {} }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["volunteers"] });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) => setError((err as Error).message),
  });

  const applications = data?.volunteers ?? [];

  return (
    <>
      {error && <p className="error">{error}</p>}
      {isPending && <p className="muted">Loading…</p>}
      {data && applications.length === 0 && (
        <p className="muted">No volunteer applications waiting.</p>
      )}

      <div className="stack">
        {applications.map((app) => (
          <div className="panel" key={app.id}>
            <div className="panel-head">
              <strong>
                {app.first_name}
                {app.verified === 1 ? (
                  <span className="badge">verified</span>
                ) : (
                  <span className="badge">not verified</span>
                )}
              </strong>
              <span className="muted">{formatDateTime(app.created_at)}</span>
            </div>
            <p className="muted">{app.phone}</p>
            <p>{app.about || "No 'about me' text."}</p>
            <div className="actions">
              <ConfirmButton
                className="btn primary"
                label="Approve → volunteer badge"
                confirmLabel="Confirm approval"
                onConfirm={() => act.mutate({ id: app.id, verb: "approve" })}
              />
              <ConfirmButton
                className="btn danger"
                label="Reject"
                confirmLabel="Confirm rejection"
                onConfirm={() => act.mutate({ id: app.id, verb: "reject" })}
              />
            </div>
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

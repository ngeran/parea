// Verification review: the submitted photo next to the profile photo.
// Photos load through fetchBlobUrl because /photos requires an
// Authorization header that <img src> cannot send.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, fetchBlobUrl, type VerificationRow } from "../api";
import { ConfirmButton } from "./Users";

export function Verifications() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["verifications"],
    queryFn: () =>
      api<{ verifications: VerificationRow[] }>("/admin/verifications", {
        query: { status: "pending" },
      }),
  });

  const act = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: "approve" | "reject" }) =>
      api(`/admin/verifications/${id}/${verb}`, { method: "POST", body: {} }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["verifications"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) => setError((err as Error).message),
  });

  const submissions = data?.verifications ?? [];

  return (
    <>
      {error && <p className="error">{error}</p>}
      {isPending && <p className="muted">Loading…</p>}
      {data && submissions.length === 0 && <p className="muted">Nothing waiting for review.</p>}

      <div className="stack">
        {submissions.map((sub) => (
          <div className="panel" key={sub.id}>
            <div className="panel-head">
              <strong>{sub.first_name}</strong>
              <span className="muted">{formatDateTime(sub.created_at)}</span>
            </div>
            <div className="photos">
              <figure>
                <SubmissionPhoto path={sub.photo_url} />
                <figcaption>Submitted</figcaption>
              </figure>
              <figure>
                {sub.profile_photo ? (
                  <SubmissionPhoto path={sub.profile_photo} />
                ) : (
                  <div className="photo-box muted">No profile photo</div>
                )}
                <figcaption>Profile</figcaption>
              </figure>
            </div>
            <div className="actions">
              <ConfirmButton
                className="btn primary"
                label="Approve → verified badge"
                confirmLabel="Confirm approval"
                onConfirm={() => act.mutate({ id: sub.id, verb: "approve" })}
              />
              <ConfirmButton
                className="btn danger"
                label="Reject"
                onConfirm={() => act.mutate({ id: sub.id, verb: "reject" })}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** Fetches a private photo with the session token → object URL. */
function SubmissionPhoto({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let alive = true;
    fetchBlobUrl(path)
      .then((objectUrl) => {
        if (!alive) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        revoked = objectUrl;
        setUrl(objectUrl);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [path]);

  if (failed) return <div className="photo-box muted">Could not load</div>;
  if (!url) return <div className="photo-box muted">Loading…</div>;
  return <img className="photo-box" src={url} alt="Photo" />;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

// User list: search by name or phone, page through results, verify/unverify
// and disable/enable. Admin accounts are protected server-side (400
// admin_target) — the actions are hidden for them here as well.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, api, type AdminUser } from "../api";

const PAGE_SIZE = 50;

export function Users() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState(""); // applied on submit, not per keystroke
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["users", search, offset],
    queryFn: () =>
      api<{ users: AdminUser[]; total: number }>("/admin/users", {
        query: { q: search || undefined, offset },
      }),
  });

  const action = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: string }) =>
      api(`/admin/users/${id}/${verb}`, { method: "POST", body: {} }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => setError((err as ApiError).message),
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;

  return (
    <>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setOffset(0);
          setSearch(query.trim());
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or phone…"
          aria-label="Search users"
        />
        <button className="btn primary" type="submit">
          Search
        </button>
        {(search || offset > 0) && (
          <button
            className="btn subtle"
            type="button"
            onClick={() => {
              setQuery("");
              setSearch("");
              setOffset(0);
            }}
          >
            Clear
          </button>
        )}
      </form>

      {error && <p className="error">{error}</p>}
      {isPending && <p className="muted">Loading…</p>}

      {data && (
        <>
          <table className="grid">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Verified</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className={user.status === "disabled" ? "row-disabled" : undefined}>
                  <td>
                    {user.first_name}
                    {user.role === "admin" && <span className="badge">admin</span>}
                    {user.is_volunteer === 1 && <span className="badge">volunteer</span>}
                  </td>
                  <td>{user.phone}</td>
                  <td>{user.verified === 1 ? "✔ yes" : "— no"}</td>
                  <td>{user.status}</td>
                  <td>{formatDate(user.created_at)}</td>
                  <td className="actions">
                    {user.role !== "admin" && (
                      <>
                        <ConfirmButton
                          className="btn subtle"
                          label={user.verified === 1 ? "Unverify" : "Verify"}
                          onConfirm={() => action.mutate({ id: user.id, verb: user.verified === 1 ? "unverify" : "verify" })}
                        />
                        <ConfirmButton
                          className={user.status === "active" ? "btn danger" : "btn subtle"}
                          label={user.status === "active" ? "Disable" : "Enable"}
                          onConfirm={() => action.mutate({ id: user.id, verb: user.status === "active" ? "disable" : "enable" })}
                        />
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    No users match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="pager">
            <button
              className="btn subtle"
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              ← Previous
            </button>
            <span className="muted">
              {offset + 1}–{offset + users.length} of {total}
            </span>
            <button
              className="btn subtle"
              type="button"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </>
  );
}

/** Two-step button: first click arms it, second click acts. No modals. */
export function ConfirmButton({
  label,
  confirmLabel = "Confirm?",
  className,
  onConfirm,
}: {
  label: string;
  confirmLabel?: string;
  className?: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(iso));
}

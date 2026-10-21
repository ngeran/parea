// Phone OTP login — the same flow as the app, then the profile's role is
// checked: anything but `admin` is signed straight back out. In dev
// (OTP_MOCK=1) the request response carries `dev_code`, shown as a hint.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, api, signIn, signOut, type AdminProfile } from "../api";

interface OtpRequestResult {
  ok: boolean;
  dev_code?: string;
}

interface OtpVerifyResult {
  token: string;
  is_new_user: boolean;
  profile: AdminProfile;
}

export function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("+30");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notAdmin, setNotAdmin] = useState(false);

  const request = useMutation({
    mutationFn: () => api<OtpRequestResult>("/otp/request", { body: { phone } }),
    onSuccess: (res) => {
      setError(null);
      setDevCode(res.dev_code ?? null);
    },
    onError: (err) => setError(messageOf(err)),
  });

  const verify = useMutation({
    mutationFn: async () => {
      const res = await api<OtpVerifyResult>("/otp/verify", {
        body: { phone, code },
      });
      if (res.profile.role !== "admin") {
        // Revoke the session we just created — this account has no business
        // here. The token must be stored first: api() reads it from storage.
        signIn(res.token);
        await api("/logout", { method: "POST", body: {} }).catch(() => undefined);
        signOut();
        throw new ApiError(403, "admin_only", "This account is not an administrator.");
      }
      return res;
    },
    onSuccess: (res) => {
      signIn(res.token);
      void queryClient.invalidateQueries();
      onSignedIn();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "admin_only") setNotAdmin(true);
      setError(messageOf(err));
    },
  });

  return (
    <div className="login-wrap">
      <form
        className="login-card"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setNotAdmin(false);
          if (code) verify.mutate();
          else request.mutate();
        }}
      >
        <h1>Together — Admin</h1>

        {!devCode ? (
          <>
            <label className="field">
              <span>Phone number</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+3069…"
                autoComplete="tel"
                required
              />
            </label>
            <button className="btn primary" type="submit" disabled={request.isPending}>
              {request.isPending ? "Sending…" : "Send code"}
            </button>
          </>
        ) : (
          <>
            {devCode && (
              <p className="dev-hint">
                Dev mode code: <strong>{devCode}</strong>
              </p>
            )}
            <label className="field">
              <span>6-digit code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoFocus
                required
              />
            </label>
            <button className="btn primary" type="submit" disabled={verify.isPending || code.length !== 6}>
              {verify.isPending ? "Checking…" : "Sign in"}
            </button>
            <button
              className="btn subtle"
              type="button"
              onClick={() => {
                setDevCode(null);
                setCode("");
              }}
            >
              Use a different number
            </button>
          </>
        )}

        {notAdmin && <p className="error">This account is not an administrator.</p>}
        {error && !notAdmin && <p className="error">{error}</p>}
      </form>
    </div>
  );
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

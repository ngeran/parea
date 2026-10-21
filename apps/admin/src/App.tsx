// Auth gate + section navigation. The dashboard has exactly one URL — /admin —
// and switches sections in state. That keeps /admin/<section> free for the
// JSON API (e.g. GET /admin/users) with no path collisions.

import { useState } from "react";
import { hasToken, signOut } from "./api";
import { Feedback } from "./pages/Feedback";
import { Login } from "./pages/Login";
import { Reports } from "./pages/Reports";
import { Stats } from "./pages/Stats";
import { Users } from "./pages/Users";
import { Verifications } from "./pages/Verifications";
import { Volunteers } from "./pages/Volunteers";

type Page = "stats" | "users" | "volunteers" | "reports" | "verifications" | "feedback";

const NAV: Array<{ id: Page; label: string }> = [
  { id: "stats", label: "Stats" },
  { id: "users", label: "Users" },
  { id: "volunteers", label: "Volunteers" },
  { id: "reports", label: "Reports" },
  { id: "verifications", label: "Verifications" },
  { id: "feedback", label: "Feedback" },
];

export function App() {
  const [signedIn, setSignedIn] = useState(hasToken);
  const [page, setPage] = useState<Page>("stats");

  if (!signedIn) return <Login onSignedIn={() => setSignedIn(true)} />;

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">Together — Admin</span>
        <nav className="tabs">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={page === item.id ? "tab active" : "tab"}
              onClick={() => setPage(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="btn subtle"
          onClick={() => {
            signOut();
            setSignedIn(false);
          }}
        >
          Log out
        </button>
      </header>

      <main className="content">
        {page === "stats" && <Stats onOpenReports={() => setPage("reports")} />}
        {page === "users" && <Users />}
        {page === "volunteers" && <Volunteers />}
        {page === "reports" && <Reports />}
        {page === "verifications" && <Verifications />}
        {page === "feedback" && <Feedback />}
      </main>
    </div>
  );
}

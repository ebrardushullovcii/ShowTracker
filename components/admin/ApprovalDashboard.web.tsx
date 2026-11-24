import { useState } from "react";
import { useConvexAuth, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AuthTicket } from "@/components/auth/AuthTicket";

const css = `
.approval-admin{min-height:100vh;background:#111114;color:#fafafa;padding:32px 20px;font:16px/1.5 system-ui,sans-serif}
.approval-admin main{max-width:1000px;margin:auto}.approval-admin h1{font-size:28px;margin:0}.approval-admin p{color:#bbb}
.approval-admin header,.approval-admin nav{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:24px}
.approval-admin header h1{flex:1}.approval-admin button,.approval-admin select{font:inherit;min-height:44px;padding:8px 14px;border:1px solid #666;border-radius:6px;background:#24242a;color:white;cursor:pointer}
.approval-admin button:disabled{opacity:.5;cursor:default}.approval-admin button:focus-visible,.approval-admin select:focus-visible{outline:3px solid #f87171;outline-offset:3px}
.approval-admin button[aria-pressed=true]{background:#991b1b}.approval-admin section{border:1px solid #444;padding:20px;border-radius:8px;margin-bottom:24px}
.approval-admin .table-wrap{overflow-x:auto}.approval-admin table{border-collapse:collapse;width:100%;text-align:left}.approval-admin th,.approval-admin td{padding:14px 12px;border-bottom:1px solid #333;vertical-align:top}
.approval-admin caption{text-align:left;margin-bottom:12px}.approval-admin small{display:block;color:#bbb}.approval-admin a{color:#fca5a5}.approval-admin .message{color:#86efac}.approval-admin .error{color:#fca5a5}
`;

export default function ApprovalDashboard() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const access = useQuery(api.access.current, isAuthenticated ? {} : "skip");
  const policy = useQuery(api.access.registrationPolicy, access?.isAdmin ? {} : "skip");
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const { results, status, loadMore } = usePaginatedQuery(api.access.listUsers,
    access?.isAdmin ? { filter } : "skip", { initialNumItems: 25 });
  const approveUser = useMutation(api.access.approveUser);
  const setPolicy = useMutation(api.access.setRegistrationPolicy);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function approve(userId: Id<"users">, label: string) {
    setBusy(userId); setError(""); setMessage("");
    try { await approveUser({ userId }); setMessage(`Approved ${label}.`); }
    catch { setError("Unable to approve this account. Please try again."); }
    finally { setBusy(null); }
  }

  async function changePolicy(requireApproval: boolean) {
    setBusy("policy"); setError(""); setMessage("");
    try {
      await setPolicy({ requireApproval });
      setMessage(requireApproval ? "New accounts now require approval." : "New accounts will now be approved automatically. Existing requests still need your approval.");
    } catch { setError("Unable to update registration. Please try again."); }
    finally { setBusy(null); }
  }

  if (!isAuthenticated) return <AuthTicket mode="signIn" />;
  return (
    <div className="approval-admin"><style>{css}</style><main>
      <header><h1>ShowTracker users</h1><a href="/home">Open app</a>
        <button onClick={() => void signOut().catch(() => setError("Unable to sign out. Please try again."))}>Sign out</button></header>
      {!access?.isAdmin ? <p>Only the owner can open this dashboard.</p> : <>
        <section aria-labelledby="registration-heading">
          <h2 id="registration-heading">New accounts</h2>
          <label htmlFor="registration-mode">Registration mode </label>
          <select id="registration-mode" value={policy?.requireApproval === false ? "open" : "approval"}
            disabled={!policy || busy !== null} onChange={(event) => void changePolicy(event.target.value === "approval")}>
            <option value="approval">Require my approval</option><option value="open">Approve new accounts automatically</option>
          </select>
          <p>Existing accounts keep access. Pending requests stay pending until you approve them. Guest sign-in is available only when new accounts are approved automatically.</p>
        </section>
        <nav aria-label="User filter">
          <button aria-pressed={filter === "pending"} onClick={() => { setFilter("pending"); setMessage(""); }}>Pending requests</button>
          <button aria-pressed={filter === "all"} onClick={() => { setFilter("all"); setMessage(""); }}>All users</button>
        </nav>
        <div className="table-wrap"><table>
          <caption>{filter === "pending" ? "Accounts awaiting approval" : "All accounts, newest first"}</caption>
          <thead><tr><th scope="col">User</th><th scope="col">Created</th><th scope="col">Access</th><th scope="col">Action</th></tr></thead>
          <tbody>{results.map((user) => <tr key={user.id}>
            <td>{user.email ?? (user.isAnonymous ? "Guest account" : "No email")}{user.name ? <small>{user.name}</small> : null}</td>
            <td>{new Date(user.createdAt).toLocaleDateString()}</td><td>{user.status === "approved" ? "Approved" : "Pending"}</td>
            <td>{user.status === "pending" ? <button disabled={busy !== null} onClick={() => void approve(user.id, user.email ?? "account")}
              aria-label={`Approve ${user.email ?? "account"}`}>{busy === user.id ? "Approving..." : "Approve"}</button> : "—"}</td>
          </tr>)}</tbody>
        </table></div>
        {status === "LoadingFirstPage" ? <p role="status">Loading users...</p> : results.length === 0 ? <p>No {filter === "pending" ? "pending requests" : "users"}.</p> : null}
        {status === "CanLoadMore" || status === "LoadingMore" ? <button disabled={status === "LoadingMore"} onClick={() => loadMore(25)}>{status === "LoadingMore" ? "Loading..." : "Load more"}</button> : null}
      </>}
      {message ? <p className="message" role="status">{message}</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
    </main></div>
  );
}

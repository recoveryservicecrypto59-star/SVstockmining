 "use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Wallet, ShieldCheck, Users, ArrowUpRight, LogOut, Plus, Check, X, RefreshCw } from "lucide-react";

type Profile = { id: string; display_name: string; email: string; status: string };
type WalletRow = { user_id: string; balance_cents: number };
type Tx = { id: number; amount_cents: number; note: string; created_at: string; kind: string };

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [pending, setPending] = useState<Profile[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mode, setMode] = useState<"login"|"register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("Admin balance adjustment");

  async function load(user = session?.user) {
    if (!user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile(p);
    const admin = user.app_metadata?.role === "admin";
    setIsAdmin(admin);
    if (admin) {
      const [{ data: pend }, { data: all }] = await Promise.all([
        supabase.from("profiles").select("id,display_name,email,status").eq("status","pending").order("created_at"),
        supabase.from("profiles").select("id,display_name,email,status").eq("status","approved").order("created_at", { ascending: false })
      ]);
      setPending(pend || []); setUsers(all || []);
    } else if (p?.status === "approved") {
      const [{ data: w }, { data: tx }] = await Promise.all([
        supabase.from("wallets").select("user_id,balance_cents").eq("user_id", user.id).maybeSingle(),
        supabase.from("transactions").select("id,amount_cents,note,created_at,kind").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20)
      ]);
      setWallet(w); setTransactions(tx || []);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) load(data.session.user); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s); if (s) setTimeout(() => load(s.user), 0);
      else { setProfile(null); setWallet(null); setIsAdmin(false); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setNotice("");
    if (mode === "register") {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { display_name: displayName.trim() } }
      });
      setNotice(error ? error.message : "Registration submitted. Check your email if confirmation is enabled. Your account will remain pending until the administrator approves it.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setNotice(error.message);
    }
    setBusy(false);
  }

  async function decide(id: string, decision: "approve"|"reject") {
    setBusy(true); setNotice("");
    const { error } = await supabase.rpc("admin_review_registration", { target_user: id, decision });
    setNotice(error ? error.message : `Registration ${decision}d.`);
    await load(); setBusy(false);
  }

  async function adjustBalance(e: React.FormEvent) {
    e.preventDefault();
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars <= 0 || dollars > 100000000) { setNotice("Enter a positive amount up to $100,000,000."); return; }
    setBusy(true); setNotice("");
    const { error } = await supabase.rpc("admin_add_virtual_balance", {
      target_user: target, amount_cents: Math.round(dollars * 100), transaction_note: note.trim() || "Admin balance adjustment"
    });
    setNotice(error ? error.message : "Virtual balance updated successfully.");
    setAmount(""); await load(); setBusy(false);
  }

  async function signOut() { await supabase.auth.signOut(); }

  if (!session) return <main className="auth-shell">
    <div className="brand"><div className="brand-icon"><Wallet /></div><div><b>SVstockmining</b><small>VIRTUAL ASSET DASHBOARD</small></div></div>
    <section className="auth-card">
      <div className="eyebrow">DEMO WALLET PLATFORM</div>
      <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p className="muted">Access your virtual USD wallet. No real funds, deposits, or withdrawals.</p>
      <form onSubmit={submitAuth} className="stack">
        {mode === "register" && <label>Display name<input required value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your name" /></label>}
        <label>Email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></label>
        <label>Password<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
        <button className="primary" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      {notice && <div className="notice">{notice}</div>}
      <p className="switch">{mode === "login" ? "New here?" : "Already registered?"} <button onClick={()=>{setMode(mode==="login"?"register":"login");setNotice("")}}>{mode==="login"?"Create an account":"Sign in"}</button></p>
    </section>
    <p className="legal">SVstockmining is a virtual demonstration service. Balances are fictional and have no cash value.</p>
  </main>;

  if (!profile && !isAdmin) return <main className="center-screen"><div className="spinner"/><p>Loading your account…</p></main>;

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><Wallet /></div><div><b>SVstockmining</b><small>VIRTUAL ASSETS</small></div></div>
      <div className="side-label">WORKSPACE</div><div className="nav-item active"><Wallet size={18}/> Overview</div>
      {isAdmin && <><div className="side-label">ADMINISTRATION</div><div className="nav-item"><Users size={18}/> User approvals</div></>}
      <div className="sidebar-bottom"><div className="demo-pill"><span/> DEMO ENVIRONMENT</div><button className="logout" onClick={signOut}><LogOut size={17}/> Sign out</button></div>
    </aside>
    <section className="content">
      <header className="topbar"><div><span className="muted small">WORKSPACE / OVERVIEW</span><h2>{isAdmin ? "Admin overview" : "My wallet"}</h2></div><div className="user-chip"><div className="avatar">{(profile?.display_name || "A").slice(0,1).toUpperCase()}</div><div><b>{profile?.display_name || "Administrator"}</b><small>{isAdmin ? "Administrator" : "Member"}</small></div></div></header>
      <div className="warning"><ShieldCheck size={18}/><span><b>Virtual demo only.</b> All balances are fictional USD values and cannot be deposited, withdrawn, transferred, or redeemed.</span></div>
      {notice && <div className="notice">{notice}</div>}
      {isAdmin ? <div className="admin-grid">
        <section className="panel wide">
          <div className="panel-head"><div><div className="eyebrow">ACCOUNT MODERATION</div><h3>Pending registrations <span className="count">{pending.length}</span></h3></div><button className="icon-btn" onClick={()=>load()} aria-label="Refresh"><RefreshCw size={17}/></button></div>
          {pending.length === 0 ? <div className="empty">No registrations are waiting for approval.</div> : <div className="table-wrap"><table><thead><tr><th>NAME</th><th>EMAIL</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{pending.map(u=><tr key={u.id}><td>{u.display_name}</td><td>{u.email}</td><td><span className="status pending">Pending</span></td><td><div className="actions"><button className="approve" disabled={busy} onClick={()=>decide(u.id,"approve")}><Check size={15}/> Approve</button><button className="reject" disabled={busy} onClick={()=>decide(u.id,"reject")}><X size={15}/> Reject</button></div></td></tr>)}</tbody></table></div>}
        </section>
        <section className="panel">
          <div className="eyebrow">MANUAL CREDIT</div><h3>Add virtual balance</h3><p className="muted small">Only the administrator can change a member's demo balance.</p>
          <form onSubmit={adjustBalance} className="stack">
            <label>Approved user<select required value={target} onChange={e=>setTarget(e.target.value)}><option value="">Select a member</option>{users.map(u=><option key={u.id} value={u.id}>{u.display_name} — {u.email}</option>)}</select></label>
            <label>Amount (USD)<input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></label>
            <label>Transaction note<input value={note} onChange={e=>setNote(e.target.value)} maxLength={120}/></label>
            <button className="primary" disabled={busy || !target}><Plus size={17}/> Add virtual balance</button>
          </form>
        </section>
        <section className="panel wide">
          <div className="panel-head"><div><div className="eyebrow">MEMBER DIRECTORY</div><h3>Approved users <span className="count">{users.length}</span></h3></div><button className="icon-btn" onClick={()=>load()}><RefreshCw size={17}/></button></div>
          {users.length===0 ? <div className="empty">Approved members will appear here.</div> : <div className="table-wrap"><table><thead><tr><th>NAME</th><th>EMAIL</th><th>STATUS</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.display_name}</td><td>{u.email}</td><td><span className="status approved">Approved</span></td></tr>)}</tbody></table></div>}
        </section>
      </div> : profile?.status === "pending" ? <section className="panel pending-card"><div className="pending-icon"><ShieldCheck size={28}/></div><div className="eyebrow">ACCOUNT REVIEW</div><h1>Your registration is pending</h1><p className="muted">Thanks for signing up, {profile.display_name}. Your name and wallet access will become available after the SVstockmining administrator approves your account.</p><button className="secondary" onClick={()=>load()}><RefreshCw size={16}/> Check approval status</button></section>
      : profile?.status === "rejected" ? <section className="panel pending-card"><h1>Registration not approved</h1><p className="muted">Your account was not approved. Please contact the site administrator if you believe this is a mistake.</p></section>
      : <><section className="balance-card"><div className="balance-top"><span>YOUR VIRTUAL BALANCE</span><span className="live-dot">● DEMO USD</span></div><div className="balance-value">{money(wallet?.balance_cents || 0)}</div><div className="balance-bottom">Fictional balance · No cash value</div><div className="balance-mark"><Wallet size={90}/></div></section>
      <section className="panel"><div className="panel-head"><div><div className="eyebrow">ACCOUNT ACTIVITY</div><h3>Recent transactions</h3></div></div>{transactions.length===0 ? <div className="empty">Your virtual balance activity will appear here.</div> : <div className="table-wrap"><table><thead><tr><th>DESCRIPTION</th><th>DATE</th><th>AMOUNT</th></tr></thead><tbody>{transactions.map(t=><tr key={t.id}><td>{t.note}</td><td>{new Date(t.created_at).toLocaleDateString()}</td><td className="positive">+{money(t.amount_cents)}</td></tr>)}</tbody></table></div>}</section></>}
      <footer>SVstockmining · Virtual demonstration platform · Not a financial institution</footer>
    </section>
  </main>;
}

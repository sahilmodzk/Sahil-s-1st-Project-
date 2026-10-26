"use client";
/* eslint-disable @next/next/no-img-element */
/* URL/session hydration and request loading states intentionally synchronize with external browser and API state. */
/* eslint-disable react-hooks/set-state-in-effect */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Check,
  CheckCheck,
  ChevronRight,
  Compass,
  Flag,
  Heart,
  Home,
  ImagePlus,
  Leaf,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  Shield,
  Sun,
  Trash2,
  UserRound,
  Users,
  X,
  Pencil,
  UserPlus,
  Ban,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
type Person = {
  id: string;
  name: string;
  username: string | null;
  image?: string | null;
  bio?: string;
  role?: string;
  isFollowing?: boolean;
  isBlocked?: boolean;
  _count?: { followers: number; following: number; posts: number };
};
type Post = {
  id: string;
  content: string;
  image?: string | null;
  createdAt: string;
  author: Person;
  liked: boolean;
  bookmarked: boolean;
  _count: { likes: number; comments: number };
  comments?: Comment[];
};
type Comment = { id: string; content: string; createdAt: string; user: Person };
type Notice = {
  id: string;
  actor: Person;
  type: string;
  postId?: string;
  read: boolean;
  createdAt: string;
};
type Report = {
  id: string;
  reason: string;
  status: string;
  post: Post;
  user: Person;
  createdAt: string;
};
type Location = { view: string; username?: string; post?: string };
type FeedResult = { posts: Post[]; nextCursor?: string | null };
async function api<T>(
  query: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch("/api/social" + query, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
function initials(name?: string) {
  return (name || "G")
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}
function Avatar({
  person,
  size = "normal",
}: {
  person?: Partial<Person>;
  size?: string;
}) {
  return (
    <span className={"avatar " + size}>
      {person?.image ? (
        <img src={person.image} alt="" />
      ) : (
        initials(person?.name)
      )}
    </span>
  );
}
function time(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  return diff < 60000
    ? "Just now"
    : diff < 3600000
      ? Math.floor(diff / 60000) + "m"
      : diff < 86400000
        ? Math.floor(diff / 3600000) + "h"
        : new Date(value).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
}
function Spinner() {
  return <LoaderCircle className="spin" size={20} aria-label="Loading" />;
}
function Empty({
  icon,
  heading,
  children,
}: {
  icon: ReactNode;
  heading: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      <h3>{heading}</h3>
      <p>{children}</p>
    </div>
  );
}
export default function Gather() {
  const { data: session, isPending, refetch } = authClient.useSession();
  const [loc, setLoc] = useState<Location>({ view: "feed" });
  const [reset, setReset] = useState(false);
  const [token, setToken] = useState("");
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState("");
  useEffect(() => {
    const sync = () => {
      const q = new URLSearchParams(window.location.search);
      setLoc({
        view: q.get("view") || "feed",
        username: q.get("username") || undefined,
        post: q.get("post") || undefined,
      });
      setReset(q.has("reset") || q.has("token"));
      setToken(q.get("token") || "");
    };
    sync();
    window.addEventListener("popstate", sync);
    const d = localStorage.getItem("gather-theme") === "dark";
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const notify = useCallback((message: string) => {
    setToast(message);
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4200);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const go = useCallback((next: Location) => {
    const q = new URLSearchParams();
    if (next.view !== "feed") q.set("view", next.view);
    if (next.username) q.set("username", next.username);
    if (next.post) q.set("post", next.post);
    history.pushState(null, "", "/" + (q.size ? "?" + q.toString() : ""));
    setLoc(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const theme = () => {
    setDark(!dark);
    document.documentElement.classList.toggle("dark", !dark);
    localStorage.setItem("gather-theme", !dark ? "dark" : "light");
  };
  return (
    <>
      {isPending ? (
        <div className="boot">
          <Logo />
          <Spinner />
        </div>
      ) : !session || reset ? (
        <AuthScreen
          reset={reset}
          token={token}
          onDone={() => {
            setReset(false);
            history.replaceState(null, "", "/");
            refetch();
          }}
          notify={notify}
        />
      ) : (
        <SocialApp
          me={session.user as Person}
          loc={loc}
          go={go}
          dark={dark}
          theme={theme}
          notify={notify}
          refreshSession={() => refetch()}
        />
      )}
      {toast && (
        <div role="status" className="toast">
          <Check size={17} />
          {toast}
          <button aria-label="Dismiss message" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
function Logo() {
  return (
    <div className="logo">
      <span className="logo-mark">
        <Leaf size={24} strokeWidth={2.4} />
      </span>
      gather<span className="logo-dot">.</span>
    </div>
  );
}
function AuthScreen({
  reset,
  token,
  onDone,
  notify,
}: {
  reset: boolean;
  token: string;
  onDone: () => void;
  notify: (s: string) => void;
}) {
  const [mode, setMode] = useState(reset ? "reset" : "login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") || "");
    const password = String(f.get("password") || "");
    try {
      let result;
      if (mode === "signup") {
        result = await authClient.signUp.email({
          email,
          password,
          name: String(f.get("name")),
          username: String(f.get("username")),
        });
      } else if (mode === "forgot") {
        result = await authClient.requestPasswordReset({
          email,
          redirectTo: window.location.origin + "/?reset=1",
        });
      } else if (mode === "reset") {
        result = await authClient.resetPassword({
          newPassword: password,
          token,
        });
      } else {
        result = await authClient.signIn.email({ email, password });
      }
      if (result.error)
        throw new Error(result.error.message || "Unable to continue");
      if (mode === "forgot") {
        setSent(true);
      } else if (mode === "reset") {
        notify("Password updated. Sign in with your new password.");
        setMode("login");
        onDone();
      } else onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Logo />
        <div className="auth-story-copy">
          <span className="eyebrow">GOOD PEOPLE. GREAT CONVERSATIONS.</span>
          <h1>
            The internet feels
            <br />
            better <em>together.</em>
          </h1>
          <p>
            A space for everyday discoveries, big ideas, and the people who make
            them worth sharing.
          </p>
          <div className="story-note">
            <span className="orbit">✳</span>
            <div>
              <strong>
                A little less noise.
                <br />A little more connection.
              </strong>
              <span>Your people are here.</span>
            </div>
          </div>
        </div>
        <span className="auth-footer">
          A little corner of the internet, made for you.
        </span>
      </section>
      <section className="auth-form-wrap">
        <div className="mobile-logo">
          <Logo />
        </div>
        <div className="auth-form">
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h2>
            {mode === "signup"
              ? "Find your people."
              : mode === "forgot"
                ? "Let’s get you back in."
                : mode === "reset"
                  ? "A fresh start."
                  : "Welcome back."}
          </h2>
          <p className="muted">
            {mode === "signup"
              ? "Make a little space for connection."
              : mode === "forgot"
                ? "We’ll send you a secure password reset link."
                : mode === "reset"
                  ? "Choose a strong password for your account."
                  : "Good to see you. What’s on your mind today?"}
          </p>
          {sent ? (
            <div className="success-panel">
              <CheckCheck />
              <h3>Check your inbox</h3>
              <p>
                If an account exists, a reset link is on its way.
                {process.env.NODE_ENV === "development" &&
                  " In local development, check the .local/mail folder."}
              </p>
              <button
                className="btn primary"
                onClick={() => {
                  setMode("login");
                  setSent(false);
                }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              {mode === "signup" && (
                <>
                  <label>
                    Full name
                    <input
                      name="name"
                      placeholder="Alex Morgan"
                      maxLength={60}
                      required
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    Username
                    <input
                      name="username"
                      placeholder="alexmorgan"
                      pattern="[a-z0-9_]{3,24}"
                      title="3–24 lowercase letters, numbers, or underscores"
                      minLength={3}
                      maxLength={24}
                      required
                      autoComplete="username"
                    />
                  </label>
                </>
              )}
              {mode !== "reset" && (
                <label>
                  Email address
                  <input
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </label>
              )}
              {mode !== "forgot" && (
                <label>
                  Password
                  <input
                    type="password"
                    name="password"
                    placeholder="At least 10 characters"
                    minLength={10}
                    maxLength={128}
                    required
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                  />
                </label>
              )}
              {mode === "login" && (
                <button
                  className="text-btn forgot"
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError("");
                  }}
                >
                  Forgot password?
                </button>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button className="btn primary auth-submit" disabled={busy}>
                {busy ? (
                  <Spinner />
                ) : mode === "signup" ? (
                  "Create your account"
                ) : mode === "forgot" ? (
                  "Send reset link"
                ) : mode === "reset" ? (
                  "Update password"
                ) : (
                  "Sign in"
                )}
                {!busy && <ArrowRight size={18} />}
              </button>
            </form>
          )}
          {mode === "login" || mode === "signup" ? (
            <p className="auth-switch">
              {mode === "login"
                ? "New around here?"
                : "Already part of Gather?"}{" "}
              <button
                className="text-btn"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError("");
                }}
              >
                {mode === "login" ? "Join Gather" : "Sign in"}
              </button>
            </p>
          ) : (
            <button
              className="text-btn"
              onClick={() => {
                setMode("login");
                setSent(false);
                setError("");
              }}
            >
              ← Back to sign in
            </button>
          )}
          <p className="auth-fine">
            A thoughtful space. A real connection. Yours to make.
          </p>
        </div>
      </section>
    </main>
  );
}
const NAV = [
  { view: "feed", label: "Home feed", icon: Home },
  { view: "explore", label: "Explore", icon: Compass },
  { view: "notifications", label: "Notifications", icon: Bell },
  { view: "bookmarks", label: "Bookmarks", icon: Bookmark },
];
function SocialApp({
  me,
  loc,
  go,
  dark,
  theme,
  notify,
  refreshSession,
}: {
  me: Person;
  loc: Location;
  go: (l: Location) => void;
  dark: boolean;
  theme: () => void;
  notify: (s: string) => void;
  refreshSession: () => void;
}) {
  const [data, setData] = useState<FeedResult>({ posts: [] });
  const [profile, setProfile] = useState<Person | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [suggestions, setSuggestions] = useState<Person[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [blocked, setBlocked] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [compose, setCompose] = useState(false);
  const [connections, setConnections] = useState<
    "followers" | "following" | null
  >(null);
  const [connectionPeople, setConnectionPeople] = useState<Person[]>([]);
  const [connectionCursor, setConnectionCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const version = useRef(0);
  const reload = () => setRefresh((x) => x + 1);
  const visit = (p: Person) =>
    go({ view: "profile", username: p.username || p.id });
  useEffect(() => {
    let active = true;
    api<{ users: Person[] }>("?resource=discover")
      .then((d) => {
        if (active)
          setSuggestions(d.users.filter((p) => p.id !== me.id).slice(0, 4));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [me.id, refresh]);
  useEffect(() => {
    const v = ++version.current;
    setLoading(true);
    setError("");
    setConnections(null);
    setProfile(null);
    const resource = loc.post ? "post" : loc.view;
    let qs = "?resource=" + encodeURIComponent(resource);
    if (loc.post) qs += "&postId=" + encodeURIComponent(loc.post);
    if (loc.username) qs += "&username=" + encodeURIComponent(loc.username);
    if (resource === "search") qs += "&q=" + encodeURIComponent(query);
    api<Record<string, unknown>>(qs)
      .then((result) => {
        if (v !== version.current) return;
        setData({
          posts:
            (result.posts as Post[]) ||
            (result.post ? [result.post as Post] : []),
          nextCursor: result.nextCursor as string | null,
        });
        setProfile((result.profile as Person) || null);
        setPeople((result.users as Person[]) || []);
        setNotices((result.notifications as Notice[]) || []);
        setReports((result.reports as Report[]) || []);
        setBlocked((result.blockedUsers as Person[]) || []);
      })
      .catch((e) => {
        if (v === version.current) setError(e.message);
      })
      .finally(() => {
        if (v === version.current) setLoading(false);
      });
  }, [loc.view, loc.username, loc.post, query, refresh]);
  async function mutation(body: Record<string, unknown>, message?: string) {
    await api("", body);
    if (message) notify(message);
    reload();
  }
  async function more() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const d = await api<
        FeedResult & { notifications?: Notice[]; reports?: Report[] }
      >(
        "?resource=" +
          loc.view +
          "&cursor=" +
          encodeURIComponent(data.nextCursor || "") +
          (loc.username
            ? "&username=" + encodeURIComponent(loc.username)
            : "") +
          (loc.view === "search" ? "&q=" + encodeURIComponent(query) : ""),
      );
      setData((prev) => ({
        posts: [...prev.posts, ...(d.posts || [])],
        nextCursor: d.nextCursor,
      }));
      if (d.notifications) setNotices((prev) => [...prev, ...d.notifications!]);
      if (d.reports) setReports((prev) => [...prev, ...d.reports!]);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }
  async function showConnections(kind: "followers" | "following") {
    try {
      const d = await api<{ users: Person[]; nextCursor?: string | null }>(
        "?resource=connections&userId=" +
          encodeURIComponent(profile?.id || "") +
          "&type=" +
          kind,
      );
      setConnectionPeople(d.users);
      setConnectionCursor(d.nextCursor || null);
      setConnections(kind);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const title = loc.post
    ? "Conversation"
    : loc.view === "profile"
      ? profile?.name || "Profile"
      : (
          {
            feed: "Your home feed",
            explore: "A world of discovery",
            bookmarks: "Your saved moments",
            notifications: "Your notifications",
            search: "Find your people",
            settings: "Make yourself at home",
            admin: "Community care",
          } as Record<string, string>
        )[loc.view] || "Your home feed";
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobileNav ? "mobile-open" : "")}>
        <button className="logo-button" onClick={() => go({ view: "feed" })}>
          <Logo />
        </button>
        <span className="nav-kicker">YOUR LITTLE CORNER</span>
        <nav>
          {NAV.map((n) => (
            <button
              className={
                "nav-link " + (loc.view === n.view && !loc.post ? "active" : "")
              }
              key={n.view}
              onClick={() => {
                go({ view: n.view });
                setMobileNav(false);
              }}
            >
              <n.icon size={21} />
              {n.label}
              {loc.view === n.view && <span className="nav-active-dot" />}
            </button>
          ))}
          <button
            className={
              "nav-link " +
              (loc.view === "profile" && loc.username === (me.username || me.id)
                ? "active"
                : "")
            }
            onClick={() => {
              visit(me);
              setMobileNav(false);
            }}
          >
            <UserRound size={21} />
            My profile
          </button>
          <button
            className={"nav-link " + (loc.view === "settings" ? "active" : "")}
            onClick={() => {
              go({ view: "settings" });
              setMobileNav(false);
            }}
          >
            <Settings size={21} />
            Settings
          </button>
          {me.role === "ADMIN" && (
            <button
              className={"nav-link " + (loc.view === "admin" ? "active" : "")}
              onClick={() => go({ view: "admin" })}
            >
              <Shield size={21} />
              Moderation
            </button>
          )}
        </nav>
        <button
          className="btn primary write-post"
          onClick={() => {
            setCompose(true);
            setMobileNav(false);
          }}
        >
          <Plus size={19} />
          Create a post
        </button>
        <div className="sidebar-note">
          <span>✳</span>
          <strong>
            A good conversation
            <br />
            starts with you.
          </strong>
          <p>
            Share a thought.
            <br />
            Make someone’s day.
          </p>
        </div>
        <div className="sidebar-bottom">
          <button className="theme-switch" onClick={theme}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
            <span>{dark ? "Light appearance" : "Dark appearance"}</span>
          </button>
          <div className="sidebar-user">
            <button className="user-mini" onClick={() => visit(me)}>
              <Avatar person={me} />
              <span>
                <strong>{me.name}</strong>
                <small>@{me.username || "you"}</small>
              </span>
            </button>
            <button
              className="icon-btn"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  const result = await authClient.signOut();
                  if (result.error)
                    throw new Error(
                      result.error.message || "Unable to sign out",
                    );
                  refreshSession();
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="mobile-top">
            <button
              className="icon-btn"
              aria-label="Toggle navigation"
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Menu size={23} />
            </button>
            <Logo />
          </div>
          <div className="breadcrumb">
            Your space <ChevronRight size={14} />
            <strong>
              {loc.post
                ? "Post"
                : loc.view === "feed"
                  ? "Home"
                  : loc.view[0].toUpperCase() + loc.view.slice(1)}
            </strong>
          </div>
          <form
            className="header-search"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search);
              go({ view: "search" });
            }}
          >
            <Search size={17} />
            <input
              aria-label="Search Gather"
              placeholder="Search people, ideas, and more…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" aria-label="Search">
              <ArrowRight size={16} />
            </button>
          </form>
          <button
            className="top-avatar"
            onClick={() => visit(me)}
            aria-label="Your profile"
          >
            <Avatar person={me} size="small" />
          </button>
        </header>
        <div className="content-grid">
          <main className="timeline">
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  {loc.view === "feed"
                    ? "A LITTLE CLOSER, EVERY DAY"
                    : loc.view === "explore"
                      ? "CURIOSITY LOOKS GOOD ON YOU"
                      : "YOUR GATHER"}
                </span>
                <h1>
                  {title}
                  <span className="heading-dot">.</span>
                </h1>
                <p>
                  {loc.view === "feed"
                    ? "Fresh thoughts from your favorite people."
                    : loc.view === "explore"
                      ? "Good ideas have a way of bringing people together."
                      : loc.view === "bookmarks"
                        ? "The things you want to come back to."
                        : loc.view === "notifications"
                          ? "You’re part of the conversation."
                          : loc.view === "settings"
                            ? "A few details that make this space yours."
                            : loc.view === "search"
                              ? "A new connection is just a search away."
                              : loc.view === "admin"
                                ? "Help keep Gather a welcoming place."
                                : ""}
                </p>
              </div>
              {loc.post && (
                <button
                  className="icon-btn"
                  aria-label="Back to feed"
                  onClick={() => go({ view: "feed" })}
                >
                  <ArrowLeft />
                </button>
              )}
            </div>
            {loc.view === "feed" && !loc.post && (
              <Composer
                me={me}
                onPost={() => {
                  notify("Your thought is out in the world.");
                  reload();
                }}
                notify={notify}
              />
            )}
            {(loc.view === "feed" || loc.view === "explore") && !loc.post && (
              <div className="feed-tabs">
                <button
                  className={loc.view === "feed" ? "selected" : ""}
                  onClick={() => go({ view: "feed" })}
                >
                  Following
                </button>
                <button
                  className={loc.view === "explore" ? "selected" : ""}
                  onClick={() => go({ view: "explore" })}
                >
                  Discover
                </button>
                <span>
                  <span className="live-dot" />
                  Latest first
                </span>
              </div>
            )}
            {error ? (
              <div className="error-panel">
                <p role="alert">{error}</p>
                <button className="btn secondary" onClick={reload}>
                  Try again
                </button>
              </div>
            ) : loading ? (
              <div className="loading-panel">
                <Spinner />
                <p>Gathering the good stuff…</p>
              </div>
            ) : (
              <>
                {loc.view === "profile" && profile && (
                  <section className="profile-card">
                    <div className="profile-cover">
                      <span>grow your own little world.</span>
                      <Leaf size={85} />
                    </div>
                    <div className="profile-body">
                      <div className="profile-top">
                        <Avatar person={profile} size="large" />
                        {profile.id === me.id ? (
                          <button
                            className="btn secondary"
                            onClick={() => go({ view: "settings" })}
                          >
                            <Pencil size={15} />
                            Edit profile
                          </button>
                        ) : (
                          <div className="profile-buttons">
                            <button
                              className={
                                "btn " +
                                (profile.isFollowing ? "secondary" : "primary")
                              }
                              onClick={() =>
                                mutation({
                                  action: profile.isFollowing
                                    ? "unfollow"
                                    : "follow",
                                  userId: profile.id,
                                }).catch((e) => notify(e.message))
                              }
                            >
                              {profile.isFollowing ? (
                                <>
                                  <Check size={16} />
                                  Following
                                </>
                              ) : (
                                <>
                                  <UserPlus size={16} />
                                  Follow
                                </>
                              )}
                            </button>
                            <button
                              className="icon-btn"
                              title="Block user"
                              onClick={() => {
                                if (
                                  confirm(
                                    "Block @" +
                                      profile.username +
                                      "? You will no longer see each other’s posts.",
                                  )
                                )
                                  mutation(
                                    { action: "block", userId: profile.id },
                                    "User blocked",
                                  )
                                    .then(() => go({ view: "feed" }))
                                    .catch((e) => notify(e.message));
                              }}
                            >
                              <Ban size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                      <h2>{profile.name}</h2>
                      <span className="muted">@{profile.username}</span>
                      <p className="profile-bio">
                        {profile.bio ||
                          "A little corner of the internet, still taking shape."}
                      </p>
                      <div className="profile-counts">
                        <span>
                          <strong>{profile._count?.posts || 0}</strong> posts
                        </span>
                        <button onClick={() => showConnections("followers")}>
                          <strong>{profile._count?.followers || 0}</strong>{" "}
                          followers
                        </button>
                        <button onClick={() => showConnections("following")}>
                          <strong>{profile._count?.following || 0}</strong>{" "}
                          following
                        </button>
                      </div>
                    </div>
                  </section>
                )}
                {loc.view === "search" && (
                  <>
                    <form
                      className="search-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        setQuery(search);
                      }}
                    >
                      <Search size={20} />
                      <input
                        aria-label="Search people and posts"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="A person, a thought, a topic…"
                      />
                      <button className="btn primary">Search</button>
                    </form>
                    <h3 className="section-label">
                      People{query && " matching “" + query + "”"}
                    </h3>
                    <div className="people-results">
                      {people.length ? (
                        people.map((p) => (
                          <PersonRow
                            key={p.id}
                            person={p}
                            me={me}
                            visit={visit}
                            mutate={mutation}
                            notify={notify}
                          />
                        ))
                      ) : (
                        <p className="muted">
                          No people found. Try another search.
                        </p>
                      )}
                    </div>
                    <h3 className="section-label">Conversations</h3>
                  </>
                )}
                {["feed", "explore", "bookmarks", "profile", "search"].includes(
                  loc.view,
                ) || loc.post ? (
                  <>
                    {data.posts.length ? (
                      data.posts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          me={me}
                          visit={visit}
                          open={() => go({ view: "feed", post: post.id })}
                          mutate={mutation}
                          notify={notify}
                          detailed={!!loc.post}
                        />
                      ))
                    ) : (
                      <Empty
                        icon={
                          loc.view === "bookmarks" ? (
                            <Bookmark />
                          ) : (
                            <MessageCircle />
                          )
                        }
                        heading={
                          loc.view === "feed"
                            ? "Your feed is a fresh start"
                            : loc.view === "bookmarks"
                              ? "Keep a little inspiration"
                              : loc.view === "search"
                                ? "No conversations yet"
                                : "The conversation starts here"
                        }
                      >
                        {loc.view === "feed" ? (
                          <>
                            Follow people in Explore to bring their posts here.{" "}
                            <button
                              className="text-btn"
                              onClick={() => go({ view: "explore" })}
                            >
                              Discover your people →
                            </button>
                          </>
                        ) : loc.view === "bookmarks" ? (
                          "Tap the bookmark on a post to save it for later."
                        ) : (
                          "Share a thought, or explore what others are saying."
                        )}
                      </Empty>
                    )}
                    {data.nextCursor && (
                      <button
                        className="btn secondary load-more"
                        disabled={loadingMore}
                        onClick={more}
                      >
                        <ArrowDown size={16} />
                        Load more posts
                      </button>
                    )}
                  </>
                ) : null}
                {loc.view === "notifications" && (
                  <>
                    {notices.length > 0 && (
                      <button
                        className="text-btn mark-read"
                        onClick={() =>
                          mutation(
                            { action: "readNotifications" },
                            "All caught up",
                          ).catch((e) => notify(e.message))
                        }
                      >
                        <CheckCheck size={16} />
                        Mark all as read
                      </button>
                    )}
                    {notices.length ? (
                      notices.map((n) => (
                        <button
                          key={n.id}
                          className={
                            "notification " + (!n.read ? "unread" : "")
                          }
                          onClick={() => {
                            mutation({ action: "readNotifications" }).catch(
                              () => {},
                            );
                            if (n.postId) go({ view: "feed", post: n.postId });
                            else visit(n.actor);
                          }}
                        >
                          <Avatar person={n.actor} />
                          <span>
                            <strong>{n.actor.name}</strong>{" "}
                            {n.type === "FOLLOW"
                              ? "started following you"
                              : n.type === "LIKE"
                                ? "liked your post"
                                : "commented on your post"}
                            .<small>{time(n.createdAt)}</small>
                          </span>
                          <ChevronRight size={16} />
                        </button>
                      ))
                    ) : (
                      <Empty icon={<Bell />} heading="Quiet for now">
                        When someone connects with you, you’ll find it here.
                      </Empty>
                    )}
                  </>
                )}
                {loc.view === "settings" && (
                  <SettingsPanel
                    me={me}
                    blocked={blocked}
                    mutate={mutation}
                    notify={notify}
                    refreshSession={refreshSession}
                  />
                )}
                {loc.view === "admin" && (
                  <>
                    {reports.length ? (
                      reports.map((r) => (
                        <section className="report-card" key={r.id}>
                          <div className="report-heading">
                            <span className="badge">{r.status}</span>
                            <small>{time(r.createdAt)}</small>
                          </div>
                          <h3>{r.reason}</h3>
                          <p className="muted">
                            Reported by {r.user?.name || "a member"}
                          </p>
                          <blockquote>{r.post?.content}</blockquote>
                          <div className="row-actions">
                            <button
                              className="btn secondary"
                              onClick={() =>
                                mutation(
                                  { action: "resolveReport", reportId: r.id },
                                  "Report dismissed",
                                ).catch((e) => notify(e.message))
                              }
                            >
                              <Check size={16} />
                              Dismiss report
                            </button>
                            <button
                              className="btn danger"
                              onClick={() => {
                                if (
                                  confirm(
                                    "Remove this post from the community?",
                                  )
                                )
                                  mutation(
                                    {
                                      action: "adminDeletePost",
                                      postId: r.post.id,
                                      reportId: r.id,
                                    },
                                    "Post removed",
                                  ).catch((e) => notify(e.message));
                              }}
                            >
                              <Trash2 size={16} />
                              Remove post
                            </button>
                          </div>
                        </section>
                      ))
                    ) : (
                      <Empty icon={<Shield />} heading="All clear">
                        There are no reports waiting for review.
                      </Empty>
                    )}
                  </>
                )}
              </>
            )}
            {!loading &&
              !error &&
              ["notifications", "admin"].includes(loc.view) &&
              data.nextCursor && (
                <button
                  className="btn secondary load-more"
                  disabled={loadingMore}
                  onClick={more}
                >
                  <ArrowDown size={16} />
                  Load more
                </button>
              )}
            <footer className="timeline-footer">
              <Leaf size={15} />A little more human. A little more Gather.
            </footer>
          </main>
          <aside className="right-rail">
            <div className="welcome-card">
              <div className="welcome-spark">✳</div>
              <span className="eyebrow">MAKE ROOM FOR GOOD THINGS</span>
              <h2>
                Your people.
                <br />
                Your perspective.
              </h2>
              <p>
                There’s something wonderful about seeing the world through
                someone else’s eyes.
              </p>
              <button onClick={() => go({ view: "explore" })}>
                Find your next connection <ArrowUpRight size={16} />
              </button>
            </div>
            <section className="discovery-card">
              <div className="rail-title">
                <h3>People to know</h3>
                <Users size={17} />
              </div>
              <p className="muted rail-description">
                A fresh perspective is a follow away.
              </p>
              {suggestions.length ? (
                suggestions.map((p) => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    me={me}
                    visit={visit}
                    mutate={mutation}
                    notify={notify}
                    compact
                  />
                ))
              ) : (
                <p className="muted rail-description">
                  Invite a friend to start a conversation.
                </p>
              )}
              <button
                className="rail-more"
                onClick={() => go({ view: "explore" })}
              >
                Explore the community
                <ArrowRight size={15} />
              </button>
            </section>
            <div className="community-note">
              <span className="live-dot" />
              <strong>Small moments. Real connections.</strong>
              <p>Be curious. Be kind. Be yourself.</p>
            </div>
            <div className="rail-footer">
              Made for connection.
              <br />
              <span>© {new Date().getFullYear()} Gather</span>
              <Leaf size={20} />
            </div>
          </aside>
        </div>
      </div>
      <nav className="mobile-bottom" aria-label="Mobile navigation">
        {NAV.map((n) => (
          <button
            key={n.view}
            aria-label={n.label}
            className={loc.view === n.view ? "selected" : ""}
            onClick={() => go({ view: n.view })}
          >
            <n.icon size={22} />
          </button>
        ))}
        <button aria-label="Create a post" onClick={() => setCompose(true)}>
          <Plus size={24} />
        </button>
      </nav>
      {compose && (
        <Dialog
          title="Share a little something"
          close={() => setCompose(false)}
        >
          <Composer
            me={me}
            notify={notify}
            onPost={() => {
              setCompose(false);
              notify("Your post is live.");
              reload();
            }}
            autoFocus
          />
        </Dialog>
      )}
      {connections && (
        <Dialog
          title={connections === "followers" ? "Followers" : "Following"}
          close={() => setConnections(null)}
        >
          {connectionPeople.length ? (
            connectionPeople.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                me={me}
                visit={(p) => {
                  visit(p);
                  setConnections(null);
                }}
                mutate={mutation}
                notify={notify}
              />
            ))
          ) : (
            <Empty icon={<Users />} heading="Growing at your own pace">
              New connections will appear here.
            </Empty>
          )}
          {connectionCursor && (
            <button
              className="btn secondary load-more"
              disabled={loadingMore}
              onClick={async () => {
                setLoadingMore(true);
                try {
                  const d = await api<{
                    users: Person[];
                    nextCursor?: string | null;
                  }>(
                    "?resource=connections&userId=" +
                      encodeURIComponent(profile?.id || "") +
                      "&type=" +
                      connections +
                      "&cursor=" +
                      encodeURIComponent(connectionCursor),
                  );
                  setConnectionPeople((v) => [...v, ...d.users]);
                  setConnectionCursor(d.nextCursor || null);
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setLoadingMore(false);
                }
              }}
            >
              Load more people
            </button>
          )}
        </Dialog>
      )}
    </div>
  );
}
async function upload(file: File) {
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Please choose an image smaller than 5 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  const form = new FormData();
  form.set("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Image upload failed");
  return data.url as string;
}
function Composer({
  me,
  onPost,
  notify,
  autoFocus = false,
}: {
  me: Person;
  onPost: () => void;
  notify: (s: string) => void;
  autoFocus?: boolean;
}) {
  const [content, setContent] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("", { action: "createPost", content, image: image || null });
      setContent("");
      setImage("");
      onPost();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="composer card" onSubmit={submit}>
      <div className="composer-top">
        <Avatar person={me} />
        <textarea
          autoFocus={autoFocus}
          aria-label="Write a post"
          placeholder={`What's on your mind, ${me.name.split(" ")[0]}?`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
          rows={2}
        />
      </div>
      {image && (
        <div className="composer-image">
          <img src={image} alt="Image to attach to your post" />
          <button
            type="button"
            className="icon-btn"
            aria-label="Remove attached image"
            onClick={() => setImage("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <div className="composer-bottom">
        <div className="composer-tools">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="visually-hidden"
            aria-label="Upload post image"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploading(true);
              try {
                setImage(await upload(f));
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setUploading(false);
                if (input.current) input.current.value = "";
              }
            }}
          />
          <button
            type="button"
            disabled={uploading}
            className="photo-button"
            onClick={() => input.current?.click()}
          >
            {uploading ? <Spinner /> : <ImagePlus size={18} />}
            <span>Photo</span>
          </button>
          <span className="composer-hint">Every thought has a place.</span>
        </div>
        <div className="composer-submit">
          {content.length > 1700 && <small>{content.length}/2000</small>}
          <button
            className="btn primary"
            disabled={busy || uploading || (!content.trim() && !image)}
          >
            {busy ? (
              <Spinner />
            ) : (
              <>
                Post <ArrowUpRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
function PersonRow({
  person,
  me,
  visit,
  mutate,
  notify,
  compact = false,
}: {
  person: Person;
  me: Person;
  visit: (p: Person) => void;
  mutate: (body: Record<string, unknown>, message?: string) => Promise<void>;
  notify: (s: string) => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className={"person-row " + (compact ? "compact" : "")}>
      <button className="person-identity" onClick={() => visit(person)}>
        <Avatar person={person} />
        <span>
          <strong>{person.name}</strong>
          <small>@{person.username || "member"}</small>
          {!compact && person.bio && <p>{person.bio}</p>}
        </span>
      </button>
      {person.id !== me.id && (
        <button
          disabled={busy}
          className={"follow-button " + (person.isFollowing ? "following" : "")}
          aria-label={
            (person.isFollowing ? "Unfollow " : "Follow ") + person.name
          }
          onClick={async () => {
            setBusy(true);
            try {
              await mutate({
                action: person.isFollowing ? "unfollow" : "follow",
                userId: person.id,
              });
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <Spinner />
          ) : person.isFollowing ? (
            <Check size={16} />
          ) : (
            <Plus size={16} />
          )}
        </button>
      )}
    </div>
  );
}
function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,textarea,select,[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = prevOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function PostCard({
  post,
  me,
  visit,
  open,
  mutate,
  notify,
  detailed,
}: {
  post: Post;
  me: Person;
  visit: (p: Person) => void;
  open: () => void;
  mutate: (body: Record<string, unknown>, message?: string) => Promise<void>;
  notify: (s: string) => void;
  detailed: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(post.content);
  const [editImage, setEditImage] = useState(post.image || "");
  const [editUploading, setEditUploading] = useState(false);
  const editInput = useRef<HTMLInputElement>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState("");
  async function action(body: Record<string, unknown>, msg?: string) {
    setBusy(true);
    try {
      await mutate(body, msg);
      setMenu(false);
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="post-card card">
      <div className="post-heading">
        <button className="person-identity" onClick={() => visit(post.author)}>
          <Avatar person={post.author} />
          <span>
            <strong>{post.author.name}</strong>
            <small>
              @{post.author.username} <span>·</span> {time(post.createdAt)}
            </small>
          </span>
        </button>
        <div className="post-menu-wrap">
          <button
            className="icon-btn"
            aria-label="Post options"
            onClick={() => setMenu(!menu)}
          >
            <MoreHorizontal size={21} />
          </button>
          {menu && (
            <div className="post-menu">
              {me.id === post.author.id ? (
                <>
                  <button
                    onClick={() => {
                      setEdit(true);
                      setText(post.content);
                      setEditImage(post.image || "");
                      setMenu(false);
                    }}
                  >
                    <Pencil size={15} />
                    Edit post
                  </button>
                  <button
                    className="red"
                    disabled={busy}
                    onClick={() => {
                      if (confirm("Delete this post? This cannot be undone."))
                        action(
                          { action: "deletePost", postId: post.id },
                          "Post deleted",
                        );
                    }}
                  >
                    <Trash2 size={15} />
                    Delete post
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setReport(true);
                      setMenu(false);
                    }}
                  >
                    <Flag size={15} />
                    Report post
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Block @" + post.author.username + "?"))
                        action(
                          { action: "block", userId: post.author.id },
                          "User blocked",
                        );
                    }}
                  >
                    <Ban size={15} />
                    Block user
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {edit ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await action(
                {
                  action: "editPost",
                  postId: post.id,
                  content: text,
                  image: editImage || null,
                },
                "Post updated",
              )
            )
              setEdit(false);
          }}
        >
          <textarea
            className="edit-textarea"
            aria-label="Edit post text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
          />
          {editImage && (
            <div className="composer-image">
              <img src={editImage} alt="Attached post image" />
              <button
                type="button"
                className="icon-btn"
                aria-label="Remove post image"
                onClick={() => setEditImage("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="row-actions">
            <input
              className="visually-hidden"
              type="file"
              ref={editInput}
              accept="image/jpeg,image/png,image/webp"
              aria-label="Replace post image"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setEditUploading(true);
                try {
                  setEditImage(await upload(file));
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setEditUploading(false);
                }
              }}
            />
            <button
              type="button"
              className="btn secondary"
              disabled={editUploading}
              onClick={() => editInput.current?.click()}
            >
              {editUploading ? <Spinner /> : <ImagePlus size={16} />}Photo
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => setEdit(false)}
            >
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={busy || editUploading || (!text.trim() && !editImage)}
            >
              Save changes
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="post-content">{post.content}</p>
          {post.image && (
            <button
              className="post-image-button"
              onClick={open}
              aria-label="Open image post"
            >
              <img
                className="post-image"
                src={post.image}
                alt="Image shared by the post author"
                loading="lazy"
              />
            </button>
          )}
        </>
      )}
      <div className="post-actions">
        <button
          disabled={busy}
          className={post.liked ? "liked" : ""}
          aria-label={post.liked ? "Unlike post" : "Like post"}
          onClick={() =>
            action({ action: post.liked ? "unlike" : "like", postId: post.id })
          }
        >
          <Heart size={19} fill={post.liked ? "currentColor" : "none"} />
          <span>{post._count.likes || "Like"}</span>
        </button>
        <button aria-label="View comments" onClick={open}>
          <MessageCircle size={19} />
          <span>{post._count.comments || "Comment"}</span>
        </button>
        <button
          aria-label="Share post"
          onClick={async () => {
            const url = window.location.origin + "/?post=" + post.id;
            try {
              await navigator.clipboard.writeText(url);
              notify("Post link copied");
            } catch {
              prompt("Copy this post link:", url);
            }
          }}
        >
          <Send size={18} />
          <span className="share-label">Share</span>
        </button>
        <button
          disabled={busy}
          className={"bookmark-action " + (post.bookmarked ? "saved" : "")}
          aria-label={post.bookmarked ? "Remove bookmark" : "Bookmark post"}
          onClick={() =>
            action(
              {
                action: post.bookmarked ? "unbookmark" : "bookmark",
                postId: post.id,
              },
              post.bookmarked ? "Removed from bookmarks" : "Saved to bookmarks",
            )
          }
        >
          <Bookmark
            size={19}
            fill={post.bookmarked ? "currentColor" : "none"}
          />
        </button>
      </div>
      {detailed && (
        <div className="comments">
          <h3>
            The conversation <span>{post._count.comments}</span>
          </h3>
          <form
            className="comment-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await action({
                  action: "comment",
                  postId: post.id,
                  content: comment,
                })
              )
                setComment("");
            }}
          >
            <Avatar person={me} size="small" />
            <textarea
              aria-label="Write a comment"
              placeholder="Add to the conversation…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              maxLength={1000}
            />
            <button
              className="icon-btn"
              aria-label="Post comment"
              disabled={busy || !comment.trim()}
            >
              <ArrowUpRight size={22} />
            </button>
          </form>
          {post.comments?.map((c) => (
            <div className="comment" key={c.id}>
              <button
                aria-label={"View " + c.user.name + " profile"}
                onClick={() => visit(c.user)}
              >
                <Avatar person={c.user} size="small" />
              </button>
              <div>
                <div className="comment-top">
                  <strong>{c.user.name}</strong>
                  <small>{time(c.createdAt)}</small>
                </div>
                <p>{c.content}</p>
              </div>
              {c.user.id === me.id && (
                <button
                  className="icon-btn"
                  aria-label="Delete comment"
                  disabled={busy}
                  onClick={() =>
                    action({ action: "deleteComment", commentId: c.id })
                  }
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {(post as Post & { commentsNextCursor?: string })
            .commentsNextCursor && <CommentMore post={post} notify={notify} />}
        </div>
      )}
      {report && (
        <Dialog
          title="Help care for the community"
          close={() => setReport(false)}
        >
          <p className="muted">
            Tell us why this post needs a closer look. A moderator will review
            your report.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await action(
                  { action: "report", postId: post.id, reason },
                  "Report sent. Thank you for looking out for the community.",
                )
              )
                setReport(false);
            }}
          >
            <label>
              Reason
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                minLength={5}
                maxLength={500}
                placeholder="Describe the issue…"
              />
            </label>
            <button className="btn primary" disabled={busy}>
              Submit report
            </button>
          </form>
        </Dialog>
      )}
    </article>
  );
}
function CommentMore({
  post,
  notify,
}: {
  post: Post;
  notify: (s: string) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState(
    (post as Post & { commentsNextCursor?: string }).commentsNextCursor,
  );
  const [busy, setBusy] = useState(false);
  return (
    <>
      {comments.map((c) => (
        <div className="comment" key={c.id}>
          <Avatar person={c.user} size="small" />
          <div>
            <strong>{c.user.name}</strong>
            <p>{c.content}</p>
          </div>
        </div>
      ))}
      {cursor && (
        <button
          className="text-btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const d = await api<{
                post: Post & { commentsNextCursor?: string };
              }>(
                "?resource=post&postId=" +
                  post.id +
                  "&commentsCursor=" +
                  encodeURIComponent(cursor),
              );
              setComments((v) => [...v, ...(d.post.comments || [])]);
              setCursor(d.post.commentsNextCursor);
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Load more comments
        </button>
      )}
    </>
  );
}
function SettingsPanel({
  me,
  blocked,
  mutate,
  notify,
  refreshSession,
}: {
  me: Person;
  blocked: Person[];
  mutate: (body: Record<string, unknown>, message?: string) => Promise<void>;
  notify: (s: string) => void;
  refreshSession: () => void;
}) {
  const [name, setName] = useState(me.name);
  const [username, setUsername] = useState(me.username || "");
  const [bio, setBio] = useState(me.bio || "");
  const [image, setImage] = useState(me.image || "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <section className="settings-card card">
        <h2>Your profile</h2>
        <p className="muted">
          Introduce yourself. The best connections start with being you.
        </p>
        <div className="avatar-editor">
          <Avatar person={{ name, image }} size="large" />
          <div>
            <button
              className="btn secondary"
              disabled={uploading}
              onClick={() => input.current?.click()}
            >
              {uploading ? <Spinner /> : <ImagePlus size={16} />}Change photo
            </button>
            {image && (
              <button className="text-btn" onClick={() => setImage("")}>
                Remove photo
              </button>
            )}
            <small>JPEG, PNG, or WebP · Up to 5 MB</small>
          </div>
          <input
            className="visually-hidden"
            ref={input}
            type="file"
            aria-label="Upload profile photo"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploading(true);
              try {
                setImage(await upload(f));
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setUploading(false);
              }
            }}
          />
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await mutate(
                {
                  action: "updateProfile",
                  name,
                  username,
                  bio,
                  image: image || null,
                },
                "Profile updated",
              );
              refreshSession();
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Full name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={60}
            />
          </label>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              pattern="[a-z0-9_]{3,24}"
              required
              minLength={3}
              maxLength={24}
            />
          </label>
          <label>
            Bio
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="A few words about your world…"
            />
            <small>{bio.length}/300 characters</small>
          </label>
          <button className="btn primary" disabled={busy || uploading}>
            {busy ? <Spinner /> : "Save profile"}
            <Check size={16} />
          </button>
        </form>
      </section>
      <section className="settings-card card">
        <h2>Account security</h2>
        <p className="muted">
          Need a new password? We’ll email you a secure reset link.
        </p>
        <button
          className="btn secondary"
          onClick={async () => {
            try {
              const email = (me as Person & { email?: string }).email;
              if (!email)
                throw new Error(
                  "Please sign out and use Forgot password to reset your password.",
                );
              const r = await authClient.requestPasswordReset({
                email,
                redirectTo: window.location.origin + "/?reset=1",
              });
              if (r.error) throw new Error(r.error.message);
              notify("If your account exists, a reset link has been sent.");
            } catch (e) {
              notify((e as Error).message);
            }
          }}
        >
          Send password reset email
          <ArrowUpRight size={16} />
        </button>
      </section>
      <section className="settings-card card">
        <h2>Blocked accounts</h2>
        <p className="muted">
          Your boundaries matter. Blocked members cannot interact with you.
        </p>
        {blocked.length ? (
          blocked.map((p) => (
            <div className="person-row" key={p.id}>
              <div className="person-identity">
                <Avatar person={p} />
                <span>
                  <strong>{p.name}</strong>
                  <small>@{p.username}</small>
                </span>
              </div>
              <button
                className="btn secondary"
                onClick={() =>
                  mutate(
                    { action: "unblock", userId: p.id },
                    "User unblocked",
                  ).catch((e) => notify(e.message))
                }
              >
                Unblock
              </button>
            </div>
          ))
        ) : (
          <p className="settings-empty">You haven’t blocked anyone.</p>
        )}
      </section>
    </>
  );
}

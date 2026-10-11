import { ThemePicker } from "./theme";
import { useEffect, useState } from "react";
import { Projects } from "./Projects";
import { Project } from "./Project";
import { Help } from "./Help";
import { api, message, type SessionInfo } from "./api";
import { clearViewState } from "./FlowCanvas";

export default function App() {
  const [hash, setHash] = useState(location.hash);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    let active = true;
    let generation = 0;
    let knownLogin: string | null | undefined;
    const update = () => setHash(location.hash);
    const refresh = (broadcast = true) => {
      const current = ++generation;
      void api<SessionInfo>("/session")
        .then((value) => {
          if (active && current === generation) {
            const login = value.user?.login ?? null;
            if (login !== knownLogin) {
              if (knownLogin !== undefined && broadcast)
                channel?.postMessage("identity-changed");
              knownLogin = login;
              clearViewState();
            }
            setSession(value);
            setLocked(false);
            setError("");
          }
        })
        .catch((error) => {
          if (active && current === generation) {
            setSession(null);
            setError(message(error));
            setLocked(true);
          }
        });
    };
    const end = () => {
      generation++;
      clearViewState();
      setSession({ user: null, configured: true, installationUrl: null });
      setLocked(false);
    };
    const visibility = () => {
      if (document.hidden) {
        generation++;
        clearViewState();
        setLocked(true);
      } else refresh();
    };
    const pagehide = () => {
      generation++;
      clearViewState();
      setLocked(true);
    };
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel("codevista-session");
    if (channel)
      channel.onmessage = () => {
        end();
        refresh(false);
      };
    window.addEventListener("hashchange", update);
    window.addEventListener("codevista-session-ended", end);
    const pageshow = () => refresh();
    window.addEventListener("pageshow", pageshow);
    window.addEventListener("pagehide", pagehide);
    document.addEventListener("visibilitychange", visibility);
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, 60000);
    refresh();
    return () => {
      active = false;
      clearInterval(timer);
      channel?.close();
      window.removeEventListener("hashchange", update);
      window.removeEventListener("codevista-session-ended", end);
      window.removeEventListener("pageshow", pageshow);
      window.removeEventListener("pagehide", pagehide);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  async function remove(account: boolean) {
    try {
      await api(account ? "/account" : "/logout", {
        method: account ? "DELETE" : "POST",
        csrf: session?.csrf,
      });
      clearViewState();
      setSession({
        user: null,
        configured: session?.configured ?? true,
        installationUrl: session?.installationUrl ?? null,
      });
      setConfirmDelete(false);
      location.hash = "/projects";
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("codevista-session");
        channel.postMessage("ended");
        channel.close();
      }
    } catch (error) {
      setError(message(error));
    }
  }
  const path = hash.replace(/^#/, "").split("?")[0];
  const project = /^\/project\/([A-Za-z0-9-]+\/[A-Za-z0-9_.-]+)$/.exec(
    path ?? "",
  );
  const isPrivate = path !== "/help";
  return (
    <>
      <header className="app-header">
        <a className="brand" href="#/projects">
          <span className="brand-mark">C</span>CodeVista
          <span className="brand-tag">APPLICATION INTELLIGENCE</span>
        </a>
        <div className="header-right">
          <ThemePicker />
          <a href="#/projects">Projects</a>
          <a href="#/help">Guide & privacy</a>
          {session?.user && (
            <>
              <button onClick={() => void remove(false)}>Sign out</button>
              <button
                className="button-link"
                onClick={() => setConfirmDelete(true)}
              >
                Delete local account data
              </button>
            </>
          )}
        </div>
      </header>
      {confirmDelete && (
        <section className="panel">
          <div className="notice">
            <strong>Delete your data from this host?</strong>
            <p>
              This removes all sessions and saved preferences. GitHub files and
              the app installation stay in place.
            </p>
            <div className="toolbar">
              <button onClick={() => void remove(true)}>
                Delete my local account data
              </button>
              <button onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </div>
        </section>
      )}
      {isPrivate && error && (
        <div className="notice error" role="alert">
          {error}
          <button onClick={() => location.reload()}>Retry connection</button>
        </div>
      )}
      {path === "/help" ? (
        <Help />
      ) : !session || locked ? (
        <div className="empty" role="status">
          <h2>Verifying your session…</h2>
        </div>
      ) : project && session.user ? (
        <Project
          key={`${session.user.login}:${project[1]}`}
          repository={project[1]!}
          hash={hash}
          session={session}
        />
      ) : (
        <Projects key={session.user?.login ?? "anonymous"} session={session} />
      )}
    </>
  );
}

import type { SessionInfo } from "./api";

const repository = "https://github.com/iamseyedalipro/CodeVista";

export function Landing({
  session,
  error,
}: {
  session: SessionInfo | null;
  error: string;
}) {
  return (
    <main className="landing">
      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">
            OPEN SOURCE / REPOSITORY-OWNED / AGENT-MAINTAINED
          </p>
          <h1 id="hero-title">
            See the logic.
            <br />
            Understand
            <br />
            <span>the system.</span>
          </h1>
          <p className="hero-description">
            Turn the code you work with into application flows you can explore.
            From the big picture to the decision that makes it happen.
          </p>
          <div className="hero-actions">
            {session?.user ? (
              <a className="primary action-link" href="#/projects">
                Open your workspace ↗
              </a>
            ) : session?.configured ? (
              <a className="primary action-link" href="/auth/github">
                Connect GitHub ↗
              </a>
            ) : (
              <a className="primary action-link" href="#/projects">
                Open workspace ↗
              </a>
            )}
            <a
              className="action-link"
              href={repository}
              target="_blank"
              rel="noreferrer"
            >
              View on GitHub ↗
            </a>
          </div>
          {session && !session.configured && !session.user && (
            <p className="notice">
              This host has not configured its GitHub App.{" "}
              <a href="#/help">Read the self-hosting guide</a> to enable GitHub
              connections.
            </p>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}{" "}
              <button onClick={() => location.reload()}>
                Retry connection
              </button>
            </div>
          )}
          <p className="hero-footnote">
            Your repository. Your coding agent. No separate AI API key.
          </p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-caption">
            <span>CODEVISTA / 01</span>
            <span>FOLLOW THE LOGIC ↘</span>
          </div>
          <img src="/codevista-logo.svg" alt="" width="512" height="512" />
          <div className="art-footer">
            <span className="active-square" />
            CLARITY, ONE LAYER AT A TIME.
          </div>
        </div>
      </section>
      <div className="landing-strip">
        <span>CODE → CONTEXT</span>
        <span>FLOWS → UNDERSTANDING</span>
        <span>OWNERSHIP → CONTROL</span>
      </div>
      <section className="landing-section" aria-labelledby="features-title">
        <div className="section-intro">
          <p className="eyebrow">01 / A CLEARER PICTURE</p>
          <h2 id="features-title">
            Less digging.
            <br />
            More understanding.
          </h2>
          <p>
            Find how your application behaves, where the paths split, and which
            code sits behind each step.
          </p>
        </div>
        <div className="feature-grid">
          <article>
            <span className="feature-number">[01]</span>
            <h3>Start wide. Go deep.</h3>
            <p>
              Explore business processes, open reusable subprocesses, and follow
              individual decisions without losing your place.
            </p>
          </article>
          <article>
            <span className="feature-number">[02]</span>
            <h3>Keep the code in sight.</h3>
            <p>
              Move from a flow step to its source reference at the selected
              commit. Inspect branches and pull request comparisons.
            </p>
          </article>
          <article>
            <span className="feature-number">[03]</span>
            <h3>Know what is missing.</h3>
            <p>
              Coverage gaps, validation issues, and review status stay explicit.
              A valid diagram is not a promise of complete coverage.
            </p>
          </article>
        </div>
      </section>
      <section
        className="landing-section workflow-section"
        aria-labelledby="workflow-title"
      >
        <div className="section-intro">
          <p className="eyebrow">02 / FROM REPOSITORY TO CLARITY</p>
          <h2 id="workflow-title">
            Your agent does the mapping.
            <br />
            You do the exploring.
          </h2>
        </div>
        <ol className="workflow-list">
          <li>
            <span>01</span>
            <div>
              <h3>Connect your repository</h3>
              <p>
                Sign in with GitHub and grant the app access to the repositories
                you choose.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Let your coding agent map it</h3>
              <p>
                Use the setup instructions with your existing agent. It reads
                the code and commits flow definitions to your repository. Your
                agent's usage limits still apply.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Explore. Review. Keep it current.</h3>
              <p>
                Choose a project and branch. Follow the flows, inspect source
                references, and ask your agent to maintain maps as the code
                changes.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <section className="ownership-section">
        <div>
          <p className="eyebrow">03 / BUILT TO STAY YOURS</p>
          <h2>
            Clarity without
            <br />
            giving up control.
          </h2>
        </div>
        <div>
          <p>
            Flow definitions live alongside your code. CodeVista is open source
            and self-hostable, with private repository access checked through
            GitHub.
          </p>
          <a
            className="action-link"
            href={`${repository}/blob/master/docs/self-hosting.md`}
            target="_blank"
            rel="noreferrer"
          >
            Read the deployment guide ↗
          </a>
        </div>
      </section>
      <section className="landing-cta">
        <h2>
          Make your code
          <br />
          easier to understand.
        </h2>
        <a className="primary action-link" href="#/projects">
          Explore your projects ↗
        </a>
      </section>
      <footer className="landing-footer">
        <a className="brand" href="#/home">
          <img
            className="brand-logo"
            src="/codevista-logo.svg"
            alt=""
            width="44"
            height="44"
          />
          CodeVista
        </a>
        <span>APPLICATION LOGIC, IN PLAIN SIGHT.</span>
        <nav aria-label="Footer">
          <a href="#/help">Guide & privacy</a>
          <a href={repository} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
          <a
            href={`${repository}/blob/master/LICENSE`}
            target="_blank"
            rel="noreferrer"
          >
            MIT license ↗
          </a>
        </nav>
      </footer>
    </main>
  );
}

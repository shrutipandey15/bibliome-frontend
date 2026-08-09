import { Link, useLocation } from "react-router-dom";
import { PRIVACY, TERMS, OPERATOR } from "./legalContent";
import "./LegalPage.css";

/**
 * Privacy policy and terms, rendered from one structured document each so the
 * two pages can't drift apart in styling or in what they claim.
 *
 * The content deliberately describes what the code actually does — the journal
 * really is end-to-end encrypted, exports and deletion really are self-service —
 * rather than the usual maximal-permission boilerplate. If a claim here stops
 * being true, the fix is the code, not the wording.
 */
export default function LegalPage() {
  const { pathname } = useLocation();
  const doc = pathname.startsWith("/terms") ? TERMS : PRIVACY;

  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link to="/" className="legal-brand">Biblio<em>me</em></Link>
        <nav className="legal-nav">
          <Link to="/privacy" className={doc === PRIVACY ? "active" : ""}>Privacy</Link>
          <Link to="/terms" className={doc === TERMS ? "active" : ""}>Terms</Link>
        </nav>
      </header>

      <article className="legal-body">
        <h1 className="legal-title">{doc.title}</h1>
        <p className="legal-meta">
          Last updated {doc.updated} · operated by {OPERATOR.name}
        </p>

        {doc.sections.map((s) => (
          <section key={s.heading} className="legal-section">
            <h2 className="legal-heading">{s.heading}</h2>
            {s.body.map((para, i) =>
              Array.isArray(para) ? (
                <ul key={i} className="legal-list">
                  {para.map((li) => <li key={li}>{li}</li>)}
                </ul>
              ) : (
                <p key={i}>{para}</p>
              )
            )}
          </section>
        ))}

        <footer className="legal-footer">
          Questions, or a request about your data: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
        </footer>
      </article>
    </div>
  );
}

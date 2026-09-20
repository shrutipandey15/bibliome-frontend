import { useParams, Link } from "react-router-dom";
import { useHead } from "../hooks/useHead";
import { routeByPath, urlFor } from "../data/pageHtml";
import ThemeToggle from "../components/ThemeToggle";
import "./ContentPages.css";

/**
 * The prerendered marketing routes: /archetypes, /archetypes/:slug, /vs/:slug.
 *
 * The body is the SAME html string vite.config.js bakes into
 * dist/<route>/index.html at build time (see data/pageHtml.js), so what a
 * crawler reads and what a signed-in reader clicking through sees cannot
 * diverge. That is also why this component is so thin — it is a frame around a
 * string, not a page.
 *
 * useHead still runs: the prerendered file already carries the right title and
 * canonical for a cold load, but a client-side navigation into this route from
 * elsewhere in the SPA has to set them itself.
 */
function ContentPage({ path }) {
  const route = routeByPath(path);
  useHead(
    route
      ? { title: route.title, description: route.description, canonical: urlFor(route.path) }
      : { title: "Not found — Bibliome", robots: "noindex" },
  );

  if (!route) {
    return (
      <div className="cp-shell">
        <div className="cp cp-missing">
          <h1>No such page</h1>
          <p><Link to="/archetypes">The 8 reading archetypes</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-shell">
      <div className="cp-toolbar"><ThemeToggle /></div>
      {/* Safe: every string in pageHtml.js is a literal in data/, never user
          input or an API response. See the note at the top of that file. */}
      <div dangerouslySetInnerHTML={{ __html: route.html() }} />
    </div>
  );
}

export function ArchetypeIndexPage() {
  return <ContentPage path="/archetypes" />;
}

export function ArchetypePage() {
  const { slug } = useParams();
  return <ContentPage path={`/archetypes/${slug}`} />;
}

export function ComparePage() {
  const { slug } = useParams();
  return <ContentPage path={`/vs/${slug}`} />;
}

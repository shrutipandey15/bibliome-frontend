import { useState, useEffect, useCallback } from "react";
import { Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch, getModerationQueue, resolveReport } from "../services/api";
import "./AdminPage.css";

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [dbHealth, setDbHealth] = useState(null);
  const [catalogStats, setCatalogStats] = useState(null);
  const [catalogBooks, setCatalogBooks] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogSort, setCatalogSort] = useState("popular");
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [queue, setQueue] = useState([]);
  const [resolving, setResolving] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("dashboard");

  const CATALOG_PAGE_SIZE = 50;

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadDashboard = useCallback(async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        apiFetch("/admin/dashboard"),
        apiFetch("/admin/users"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (e) {
      showToast("Failed to load admin data", "error");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user?.is_admin) { navigate("/"); return; }
    loadDashboard();
  }, [user, navigate, loadDashboard]);

  const loadDbHealth = async () => {
    const res = await apiFetch("/admin/db-health");
    if (res.ok) setDbHealth(await res.json());
  };

  const loadCatalog = async (search = catalogSearch, sort = catalogSort, page = 0) => {
    const params = new URLSearchParams({
      sort,
      limit: String(CATALOG_PAGE_SIZE),
      offset: String(page * CATALOG_PAGE_SIZE),
    });
    if (search) params.set("q", search);
    const [statsRes, booksRes] = await Promise.all([
      apiFetch("/admin/catalog/stats"),
      apiFetch(`/admin/catalog/books?${params}`),
    ]);
    if (statsRes.ok) setCatalogStats(await statsRes.json());
    if (booksRes.ok) {
      const books = await booksRes.json();
      setCatalogBooks(books);
      setCatalogHasMore(books.length === CATALOG_PAGE_SIZE);
      setCatalogPage(page);
    }
  };

  const deleteCatalogBook = async (bookId, title) => {
    if (!confirm(`Remove "${title}" from the catalog?`)) return;
    const res = await apiFetch(`/admin/catalog/books/${bookId}`, { method: "DELETE" });
    if (res.ok) {
      showToast(`"${title}" removed from catalog`);
      loadCatalog();
    } else {
      showToast("Delete failed", "error");
    }
  };

  const loadQueue = useCallback(async () => {
    try {
      setQueue(await getModerationQueue());
    } catch {
      showToast("Couldn't load the moderation queue", "error");
    }
  }, []);

  // `remove` is the irreversible one, so it confirms; `dismiss` restores a held
  // item and `clear` only closes reports against something already deleted.
  const resolve = async (item, action) => {
    if (action === "remove" && !confirm(
      `Remove this ${item.target_type} permanently? Dismiss instead if it should stay up.`
    )) return;
    const key = `${item.target_type}:${item.target_id}`;
    setResolving(key);
    try {
      await resolveReport(item.target_type, item.target_id, action);
      showToast(
        action === "remove" ? "Removed" : action === "dismiss" ? "Dismissed — content restored" : "Reports cleared"
      );
      await Promise.all([loadQueue(), loadDashboard()]);
    } catch (e) {
      showToast(e.message || "Couldn't resolve that report", "error");
    }
    setResolving(null);
  };

  const loadAuditLog = async () => {
    const res = await apiFetch("/admin/audit-log?limit=50");
    if (res.ok) setAuditLogs(await res.json());
  };

  const cleanupTokens = async () => {
    const res = await apiFetch("/admin/cleanup-tokens", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      showToast(`Cleaned up ${data.deleted} expired tokens`);
      loadDashboard();
    }
  };

  const viewUser = async (userId) => {
    const res = await apiFetch(`/admin/users/${userId}`);
    if (res.ok) setSelectedUser(await res.json());
  };

  const deleteUser = async (userId, username) => {
    if (!confirm(`Delete user "${username}" and ALL their data? This cannot be undone.`)) return;
    const res = await apiFetch(`/admin/users/${userId}`, { method: "DELETE" });
    if (res.ok) {
      showToast(`User ${username} deleted`);
      setSelectedUser(null);
      loadDashboard();
    } else {
      const d = await res.json().catch(() => ({}));
      showToast(d.detail || "Delete failed", "error");
    }
  };

  if (loading) return <div className="admin-page"><div className="admin-loading">Loading admin...</div></div>;
  if (!user?.is_admin) return null;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button className="admin-back" onClick={() => navigate("/")}>←</button>
        <h1 className="admin-title">Admin</h1>
        <div className="admin-tabs">
          {/* Moderation sits second deliberately: it is the only tab whose
              contents grow without anyone doing anything, and its badge is the
              whole reason it exists — otherwise you still have to remember to
              go and look, which is what the queue not being here amounted to. */}
          {["dashboard", "moderation", "users", "catalog", "audit", "database"].map((t) => (
            <button
              key={t}
              className={`admin-tab ${tab === t ? "active" : ""}`}
              onClick={() => {
                setTab(t);
                if (t === "database") loadDbHealth();
                if (t === "catalog") loadCatalog();
                if (t === "audit") loadAuditLog();
                if (t === "moderation") loadQueue();
              }}
            >
              {t}
              {t === "moderation" && stats?.open_reports > 0 && (
                <span className="admin-tab-badge">{stats.open_reports}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      {tab === "dashboard" && stats && (
        <div className="admin-section">
          <div className="admin-grid">
            <Stat label="Users" value={stats.total_users} />
            <Stat label="Books Logged" value={stats.total_entries} />
            <Stat label="Echoes" value={stats.total_echoes} />
            <Stat label="DNA Generated" value={stats.total_dna_generated} />
            <Stat label="Catalog Books" value={stats.catalog_books} />
            <Stat label="New Users (7d)" value={stats.users_last_7d} />
            <Stat label="DB Size" value={`${stats.db_size_mb} MB`} />
            <Stat label="Expired Tokens" value={stats.expired_refresh_tokens} />
          </div>
          {stats.expired_refresh_tokens > 0 && (
            <button className="admin-action-btn" onClick={cleanupTokens}>
              Cleanup {stats.expired_refresh_tokens} expired tokens
            </button>
          )}
        </div>
      )}

      {/* ── Moderation queue ── */}
      {tab === "moderation" && (
        <div className="admin-section">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reported</th>
                  <th>Author</th>
                  <th>Reports</th>
                  <th>Categories</th>
                  <th>First</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => {
                  const key = `${item.target_type}:${item.target_id}`;
                  const busy = resolving === key;
                  return (
                    <tr key={key} className={item.target_exists ? "" : "admin-row-gone"}>
                      <td>
                        <div className="admin-mod-type">
                          {item.target_type}
                          {item.status === "held" && <span className="admin-held-badge">held</span>}
                        </div>
                        {item.target_type === "thread" ? (
                          /* No transcript here on purpose — resolving a report
                             doesn't require reading a private conversation. */
                          <div className="admin-mod-preview muted">
                            private thread · {item.participants?.join(" ↔ ") || "—"} ·{" "}
                            {item.message_count ?? 0} messages
                          </div>
                        ) : item.target_exists ? (
                          <div className="admin-mod-preview">
                            {item.preview}{item.truncated ? "…" : ""}
                          </div>
                        ) : (
                          <div className="admin-mod-preview muted">
                            target deleted — nothing left to review
                          </div>
                        )}
                      </td>
                      <td>{item.author_handle || "—"}</td>
                      <td>{item.report_count}</td>
                      <td>{item.categories.join(", ")}</td>
                      <td className="admin-mono">
                        {item.first_reported_at
                          ? new Date(item.first_reported_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        {item.target_exists ? (
                          <div className="admin-mod-actions">
                            <button
                              className="admin-mod-btn danger"
                              disabled={busy}
                              onClick={() => resolve(item, "remove")}
                            >Remove</button>
                            <button
                              className="admin-mod-btn"
                              disabled={busy}
                              onClick={() => resolve(item, "dismiss")}
                            >Dismiss</button>
                          </div>
                        ) : (
                          /* Remove/dismiss both 404 against a target that is
                             already gone; clear is the only way to close these
                             out, and without it they'd sit here forever. */
                          <button
                            className="admin-mod-btn"
                            disabled={busy}
                            onClick={() => resolve(item, "clear")}
                          >Clear</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {queue.length === 0 && (
                  <tr><td colSpan={6} className="admin-empty">Nothing reported. Queue is clear.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Users List ── */}
      {tab === "users" && !selectedUser && (
        <div className="admin-section">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Books</th>
                  <th>Personality</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} onClick={() => viewUser(u.id)}>
                    <td>
                      <div className="admin-username">
                        {u.username}
                        {u.is_admin && <span className="admin-badge">admin</span>}
                      </div>
                      <div className="admin-email">{u.email}</div>
                    </td>
                    <td>{u.book_count}</td>
                    <td>{u.personality_type || "—"}</td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "users" && selectedUser && (
        <div className="admin-section">
          <button className="admin-back-link" onClick={() => setSelectedUser(null)}>← Back to users</button>
          <div className="admin-user-detail">
            <h2 className="admin-detail-name">{selectedUser.username}</h2>
            <div className="admin-detail-grid">
              <div className="admin-detail-item"><span className="admin-detail-label">Email</span> {selectedUser.email}</div>
              <div className="admin-detail-item"><span className="admin-detail-label">Display Name</span> {selectedUser.display_name || "—"}</div>
              <div className="admin-detail-item"><span className="admin-detail-label">Personality</span> {selectedUser.personality_type || "Not generated"}</div>
              <div className="admin-detail-item"><span className="admin-detail-label">Books</span> {selectedUser.book_count}</div>
              <div className="admin-detail-item"><span className="admin-detail-label">DNA Dirty</span> {selectedUser.dna_dirty ? "Yes" : "No"}</div>
              <div className="admin-detail-item"><span className="admin-detail-label">Joined</span> {new Date(selectedUser.created_at).toLocaleString()}</div>
            </div>

            {selectedUser.entries.length > 0 && (
              <>
                <h3 className="admin-subhead">Books ({selectedUser.entries.length})</h3>
                <div className="admin-entry-list">
                  {selectedUser.entries.map((e) => (
                    <div key={e.id} className="admin-entry-row">
                      <span className="admin-entry-title">{e.title}</span>
                      <span className="admin-entry-meta">{e.author} · {e.intensity}/10</span>
                      <span className="admin-entry-emo">{e.emotions.join(", ")}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!selectedUser.is_admin && (
              <button className="admin-danger-btn" onClick={() => deleteUser(selectedUser.id, selectedUser.username)}>
                Delete User
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Book Catalog ── */}
      {tab === "catalog" && (
        <div className="admin-section">
          {catalogStats && (
            <div className="admin-grid">
              <Stat label="Total Books" value={catalogStats.total_books} />
              <Stat label="With Covers" value={catalogStats.with_covers} />
              <Stat label="With ISBN" value={catalogStats.with_isbn} />
              <Stat label="Avg Popularity" value={catalogStats.avg_popularity} />
            </div>
          )}

          {catalogStats?.top_sources && (
            <div className="admin-source-tags">
              {Object.entries(catalogStats.top_sources).map(([src, count]) => (
                <span key={src} className="admin-source-tag">{src}: {count}</span>
              ))}
            </div>
          )}

          <div className="admin-catalog-controls">
            <input
              type="text"
              placeholder="Search catalog..."
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadCatalog(catalogSearch, catalogSort, 0)}
              className="admin-catalog-search"
            />
            <select
              value={catalogSort}
              onChange={(e) => { setCatalogSort(e.target.value); loadCatalog(catalogSearch, e.target.value, 0); }}
              className="admin-catalog-sort"
            >
              <option value="popular">Most Popular</option>
              <option value="recent">Recently Added</option>
              <option value="title">A-Z Title</option>
            </select>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Book</th>
                  <th>ISBN</th>
                  <th>Source</th>
                  <th>Pop.</th>
                  <th>Cover</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {catalogBooks.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div className="admin-username">{b.title}</div>
                      <div className="admin-email">{b.author || "Unknown"}{b.published_year ? ` · ${b.published_year}` : ""}</div>
                    </td>
                    <td className="admin-mono">{b.isbn_13 || b.isbn_10 || "—"}</td>
                    <td><span className={`admin-source-dot ${b.source}`}>{b.source}</span></td>
                    <td>{b.popularity}</td>
                    <td>{b.cover_url ? <Check size={14} color="#5A8B6F" /> : <span>—</span>}</td>
                    <td>
                      <button
                        className="admin-delete-sm"
                        onClick={() => deleteCatalogBook(b.id, b.title)}
                        title="Remove from catalog"
                      >×</button>
                    </td>
                  </tr>
                ))}
                {catalogBooks.length === 0 && (
                  <tr><td colSpan={6} className="admin-empty">No books in catalog yet. Search for books to populate it.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {(catalogPage > 0 || catalogHasMore) && (
            <div className="admin-pagination">
              <button
                className="admin-page-btn"
                disabled={catalogPage === 0}
                onClick={() => loadCatalog(catalogSearch, catalogSort, catalogPage - 1)}
              >← Prev</button>
              <span className="admin-page-info">Page {catalogPage + 1}</span>
              <button
                className="admin-page-btn"
                disabled={!catalogHasMore}
                onClick={() => loadCatalog(catalogSearch, catalogSort, catalogPage + 1)}
              >Next →</button>
            </div>
          )}
        </div>
      )}
      {tab === "audit" && (
        <div className="admin-section">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Detail</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td><span className="admin-badge">{log.admin_username}</span></td>
                    <td><span className="admin-mono">{log.action}</span></td>
                    <td><span className="admin-mono">{log.target_type}{log.target_id ? `:${log.target_id.slice(0,8)}` : ""}</span></td>
                    <td className="admin-audit-detail">{log.detail || "—"}</td>
                    <td className="admin-mono">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr><td colSpan={5} className="admin-empty">No admin actions logged yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Database ── */}
      {tab === "database" && (
        <div className="admin-section">
          {dbHealth ? (
            <>
              <div className={`admin-status-badge ${dbHealth.status === "healthy" ? "healthy" : "unhealthy"}`}>
                {dbHealth.status === "healthy" ? <Check size={14} color="#5A8B6F" /> : <X size={14} color="#C4553A" />} {dbHealth.status} · {dbHealth.db_size_mb} MB
              </div>
              {dbHealth.tables && (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr><th>Table</th><th>Rows</th></tr>
                    </thead>
                    <tbody>
                      {dbHealth.tables.map((t) => (
                        <tr key={t.table}><td>{t.table}</td><td>{t.rows}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="admin-loading">Loading...</div>
          )}

          <div className="admin-cmd-section">
            <h3 className="admin-subhead">Backup Command</h3>
            <div className="admin-code-block">
              pg_dump -U bibliome -d bibliome -F c -f bibliome_backup_$(date +%Y%m%d).dump
            </div>
            <h3 className="admin-subhead">Restore Command</h3>
            <div className="admin-code-block">
              pg_restore -U bibliome -d bibliome -c bibliome_backup_YYYYMMDD.dump
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`admin-toast ${toast.type === "error" ? "error" : ""}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="admin-stat-card">
      <div className="admin-stat-val">{value}</div>
      <div className="admin-stat-label">{label}</div>
    </div>
  );
}
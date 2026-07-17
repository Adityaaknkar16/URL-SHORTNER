import React, { useState, useEffect } from "react";
import Background3D from "./components/Background3D";
import { api } from "./api";
import QRCode from "qrcode";

const isometricLogo = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "10px", display: "inline-block", verticalAlign: "middle" }}>
    <polygon points="12 2, 22 7, 12 12, 2 7" />
    <polygon points="2 7, 12 12, 12 22, 2 17" />
    <polygon points="22 7, 12 12, 12 22, 22 17" />
  </svg>
);

const isometricFolderIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "8px", display: "inline-block", verticalAlign: "middle" }}>
    <polygon points="4 9, 12 5, 20 9, 12 13" />
    <polygon points="4 9, 12 13, 12 19, 4 15" />
    <polygon points="20 9, 12 13, 12 19, 20 15" />
  </svg>
);

const isometricLinkIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "8px", display: "inline-block", verticalAlign: "middle" }}>
    <polygon points="6 10, 12 7, 18 10, 12 13" />
    <line x1="12" y1="13" x2="12" y2="18" />
    <polygon points="6 15, 12 12, 18 15, 12 18" />
  </svg>
);

function LinkQRCode({ url }) {
  const [qrSrc, setQrSrc] = useState("");

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 120, margin: 1 })
      .then(setQrSrc)
      .catch((err) => console.error(err));
  }, [url]);

  if (!qrSrc) {
    return (
      <div className="qr-placeholder-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>
        Generating...
      </div>
    );
  }

  return (
    <div className="qr-placeholder-container" style={{ padding: "0", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <img src={qrSrc} alt="QR Code" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    </div>
  );
}

function App() {
  // --- MAIN DASHBOARD APP LOGIC ---
  const [links, setLinks] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  // Form States
  const [url, setUrl] = useState("");
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [vanityCode, setVanityCode] = useState("");
  const [assignedGroupId, setAssignedGroupId] = useState("uncategorized");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [linkPassword, setLinkPassword] = useState("");

  // Modals / Dialogs
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  // Copy Status / Toast Message
  const [copiedId, setCopiedId] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("date-desc");

  // Load States from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [fetchedGroups, fetchedLinks] = await Promise.all([
          api.getGroups(),
          api.getLinks(),
        ]);
        setGroups(fetchedGroups);
        setLinks(fetchedLinks);
      } catch (err) {
        console.error(err);
        setApiError("Failed to fetch data from the server.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2000);
  };

  const handleShorten = async (e) => {
    e.preventDefault();
    if (!url || url.trim() === "") {
      alert("Please enter a valid URL");
      return;
    }

    try {
      const data = {
        longUrl: url.trim(),
        groupId: assignedGroupId,
        expiresAt: expiresAt || undefined,
        maxClicks: maxClicks ? parseInt(maxClicks) : undefined,
        password: linkPassword || undefined,
      };

      if (useCustomCode && vanityCode.trim() !== "") {
        data.vanityCode = vanityCode.trim().toLowerCase();
      }

      const newLink = await api.shortenLink(data);
      setLinks([newLink, ...links]);

      // Reset Form Fields
      setUrl("");
      setUseCustomCode(false);
      setVanityCode("");
      setExpiresAt("");
      setMaxClicks("");
      setLinkPassword("");

      triggerToast("Link created successfully.");
    } catch (err) {
      alert(err.message || "Failed to shorten URL.");
    }
  };

  // Create Group Handler
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName || newGroupName.trim() === "") return;

    try {
      const newGroup = await api.createGroup(newGroupName.trim());
      setGroups([...groups, newGroup]);
      setNewGroupName("");
      setIsAddGroupOpen(false);
      triggerToast(`Group "${newGroup.name}" created.`);
    } catch (err) {
      alert(err.message || "Failed to create group.");
    }
  };

  // Copy Single link URL
  const handleCopy = (shortCode, id) => {
    const fullLink = `${window.location.origin}/${shortCode}`;
    navigator.clipboard.writeText(fullLink).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      triggerToast("URL copied to clipboard.");
    });
  };

  // Copy All link URLs currently filtered
  const handleCopyAllLinks = () => {
    const filteredLinks = activeGroupId === "all" ? links : links.filter((l) => l.groupId === activeGroupId);
    if (filteredLinks.length === 0) {
      alert("No links to copy.");
      return;
    }
    const txt = filteredLinks.map((l) => `${window.location.origin}/${l.shortCode}`).join("\n");
    navigator.clipboard.writeText(txt).then(() => {
      triggerToast("All short links copied to clipboard.");
    });
  };

  // Export Filtered Links as CSV
  const handleExportCsv = () => {
    const filteredLinks = activeGroupId === "all" ? links : links.filter((l) => l.groupId === activeGroupId);
    if (filteredLinks.length === 0) {
      alert("No links to export.");
      return;
    }
    let csv = "Short URL,Original URL,Clicks,Created Date\n";
    filteredLinks.forEach((l) => {
      const escapedUrl = (l.longUrl || "").replace(/"/g, '""');
      csv += `"${window.location.origin}/${l.shortCode}","${escapedUrl}",${l.clicks || 0},"${new Date(l.createdAt).toLocaleDateString()}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.setAttribute("download", `links_export_${Date.now()}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  // Delete Individual Link
  const handleDeleteLink = async (id, shortCode) => {
    if (confirm(`Delete short link "/${shortCode}"?`)) {
      try {
        await api.deleteLink(id);
        setLinks(links.filter((l) => l._id !== id));
        triggerToast("Link deleted.");
      } catch (err) {
        alert(err.message || "Failed to delete link.");
      }
    }
  };

  // Delete All Links in currently active view
  const handleDeleteAllInGroup = async () => {
    const warning = activeGroupId === "all"
      ? "Delete ALL links across all groups? This cannot be undone."
      : "Delete all links in this group? This cannot be undone.";

    if (confirm(warning)) {
      try {
        await api.deleteLinksInGroup(activeGroupId);
        if (activeGroupId === "all") {
          setLinks([]);
        } else {
          setLinks(links.filter((l) => l.groupId !== activeGroupId));
        }
        triggerToast("Links deleted.");
      } catch (err) {
        alert(err.message || "Failed to delete links.");
      }
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "#ffffff" }}>
        <Background3D />
        <div style={{ border: "1px solid #000000", padding: "40px", maxWidth: "450px", width: "90%", backgroundColor: "#ffffff", zIndex: 1, textAlign: "center" }}>
          <p style={{ fontWeight: "600" }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (apiError) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "#ffffff" }}>
        <Background3D />
        <div style={{ border: "1px solid #000000", padding: "40px", maxWidth: "450px", width: "90%", backgroundColor: "#ffffff", zIndex: 1 }}>
          <h2 style={{ fontSize: "20px", marginBottom: "15px" }}>Error Loading Dashboard</h2>
          <p style={{ color: "#666666", marginBottom: "20px" }}>{apiError}</p>
          <button onClick={() => window.location.reload()} className="btn-primary" style={{ padding: "10px 20px" }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Filter & Search Logic
  let filtered = activeGroupId === "all" ? links : links.filter((l) => l.groupId === activeGroupId);

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(
      (l) => (l.shortCode || "").toLowerCase().includes(q) || (l.longUrl || "").toLowerCase().includes(q)
    );
  }

  filtered = [...filtered].sort((a, b) => {
    if (sortOrder === "date-desc") return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortOrder === "date-asc") return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortOrder === "clicks-desc") return (b.clicks || 0) - (a.clicks || 0);
    if (sortOrder === "clicks-asc") return (a.clicks || 0) - (b.clicks || 0);
    return 0;
  });

  return (
    <div className="app-root-react">
      <Background3D />
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div style={{ position: "fixed", top: "10px", right: "10px", border: "1px solid #000", backgroundColor: "#fff", padding: "10px 15px", zIndex: 2000, fontWeight: "bold" }}>
          {toastMessage}
        </div>
      )}

      <div className="app-wrapper">
        {/* SIDEBAR PANEL */}
        <aside>
          <div className="sidebar-section">
            <h3>Groups</h3>
            <ul className="group-list">
              <li className={`group-item ${activeGroupId === "all" ? "active" : ""}`} onClick={() => setActiveGroupId("all")}>
                <span>{isometricFolderIcon} All Links</span>
                <span className="group-badge-count">{links.length}</span>
              </li>

              {groups.map((g) => {
                const count = links.filter((l) => l.groupId === g.id).length;
                return (
                  <li key={g.id} className={`group-item ${activeGroupId === g.id ? "active" : ""}`} onClick={() => setActiveGroupId(g.id)}>
                    <span>{isometricFolderIcon} {g.name}</span>
                    <span className="group-badge-count">{count}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <button className="sidebar-footer-btn" onClick={() => setIsAddGroupOpen(true)}>
            + Add Group
          </button>
        </aside>

        {/* MAIN PANEL */}
        <main>
          <div className="header-banner">
            <div>
              <h1>
                {isometricLogo} {activeGroupId === "all" ? "All Links" : groups.find((g) => g.id === activeGroupId)?.name || "Group"}
              </h1>
              <p>Minimal Black/White URL Shortener Dashboard</p>
            </div>
            <div className="global-stats">
              Total Links: <span>{links.length}</span>
              <br />
              Total Clicks: <span>{links.reduce((sum, l) => sum + (l.clicks || 0), 0)}</span>
            </div>
          </div>

          {/* CREATOR FORM */}
          <section className="creator-section">
            <form onSubmit={handleShorten}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="longUrlInput">Paste Long URL</label>
                  <input
                    type="url"
                    id="longUrlInput"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/some/long-link-url"
                    required
                  />
                </div>

                <div className="form-group fixed-width">
                  <label htmlFor="groupSelect">Assign Group</label>
                  <select id="groupSelect" value={assignedGroupId} onChange={(e) => setAssignedGroupId(e.target.value)}>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Advanced Fields Row */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="expiryInput">Expiry Date (Optional)</label>
                  <input type="date" id="expiryInput" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="maxClicksInput">Max Clicks (Optional)</label>
                  <input type="text" id="maxClicksInput" value={maxClicks} onChange={(e) => setMaxClicks(e.target.value)} placeholder="e.g. 100" />
                </div>
                <div className="form-group">
                  <label htmlFor="passwordInput">Password Protection (Optional)</label>
                  <input type="password" id="passwordInput" value={linkPassword} onChange={(e) => setLinkPassword(e.target.value)} placeholder="None" />
                </div>
              </div>

              <div className="form-row">
                <label className="checkbox-label">
                  <input type="checkbox" checked={useCustomCode} onChange={(e) => setUseCustomCode(e.target.checked)} />
                  Use custom vanity code
                </label>
              </div>

              {useCustomCode && (
                <div className="form-row" style={{ marginTop: "-10px" }}>
                  <div className="form-group">
                    <input
                      type="text"
                      value={vanityCode}
                      onChange={(e) => setVanityCode(e.target.value)}
                      placeholder="e.g. promo-code"
                      maxLength={50}
                    />
                  </div>
                </div>
              )}

              <button type="submit">Shorten URL</button>
            </form>
          </section>

          {/* ACTIONS BAR */}
          <div className="actions-buttons">
            <button className="btn-action" onClick={handleCopyAllLinks}>
              Copy All Links
            </button>
            <button className="btn-action" onClick={handleExportCsv}>
              Export CSV
            </button>
            <button className="btn-action" style={{ color: "red", border: "1px solid red" }} onClick={handleDeleteAllInGroup}>
              Delete All
            </button>
          </div>

          {/* SEARCH + SORT TOOLBAR */}
          <div className="toolbar-row">
            <input
              type="search"
              placeholder="Search by URL or short code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
              <option value="date-desc">Date: Newest First</option>
              <option value="date-asc">Date: Oldest First</option>
              <option value="clicks-desc">Clicks: Most First</option>
              <option value="clicks-asc">Clicks: Least First</option>
            </select>
          </div>

          {/* LINKS LIST */}
          <section className="links-list">
            {filtered.length === 0 ? (
              <div className="empty-state">No links found. Create one above to get started.</div>
            ) : (
              filtered.map((link) => {
                const grpName = groups.find((g) => g.id === link.groupId)?.name || "Uncategorized";
                const shortUrl = `${window.location.origin}/${link.shortCode}`;

                return (
                  <div className="link-card bg3d-lift" key={link.shortCode}>
                    {/* Real QR Code Component */}
                    <LinkQRCode url={shortUrl} />

                    <div className="link-details">
                      <div className="link-header-row">
                        <a className="short-link-display" href={shortUrl} target="_blank" rel="noreferrer">
                          {isometricLinkIcon} {window.location.hostname}/{link.shortCode}
                        </a>
                        <span className="group-tag">{grpName}</span>
                        {link.password && <span title="Password Protected">🔒</span>}
                      </div>

                      <div className="original-url-display">Original: {link.longUrl}</div>

                      <div className="link-meta-row">
                        <span>
                          Clicks: <strong>{link.clicks || 0}</strong>
                          {link.maxClicks && <span> / {link.maxClicks} max</span>}
                        </span>
                        <span>Created: {new Date(link.createdAt).toLocaleDateString()}</span>
                        {link.expiresAt && <span>Expires: {new Date(link.expiresAt).toLocaleDateString()}</span>}
                      </div>
                    </div>

                    <div className="link-card-actions">
                      <button
                        className={`card-action-btn copy-btn ${copiedId === link._id ? "copied" : ""}`}
                        onClick={() => handleCopy(link.shortCode, link._id)}
                      >
                        {copiedId === link._id ? "Copied" : "Copy"}
                      </button>
                      <button className="card-action-btn btn-delete" style={{ color: "red" }} onClick={() => handleDeleteLink(link._id, link.shortCode)}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </main>
      </div>

      {/* ADD GROUP MODAL */}
      {isAddGroupOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Add New Group</h3>
            <form onSubmit={handleCreateGroup}>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group Name"
                style={{ padding: "10px", width: "100%", border: "1px solid #000", marginBottom: "15px", outline: "none" }}
                required
              />
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsAddGroupOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

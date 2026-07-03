import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import JSZip from "jszip";

function App() {
  const getUserId = () => {
    let id = localStorage.getItem("url_shortener_user_id");
    if (!id) {
      id =
        "user-" +
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
      localStorage.setItem("url_shortener_user_id", id);
    }
    return id;
  };

  const fetchWithUser = async (url, options = {}) => {
    const headers = {
      ...options.headers,
      "X-User-ID": getUserId(),
    };
    return fetch(url, { ...options, headers });
  };

  // App States
  const [links, setLinks] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState("all");
  const [defaultGroupId, setDefaultGroupId] = useState("uncategorized");
  const [readOnlyMode, setReadOnlyMode] = useState(false);
  const [readOnlyGroupInfo, setReadOnlyGroupInfo] = useState(null);

  // Form States
  const [url, setUrl] = useState("");
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [vanityCode, setVanityCode] = useState("");
  const [assignedGroupId, setAssignedGroupId] = useState("uncategorized");
  const [vanityStatus, setVanityStatus] = useState({
    valid: true,
    text: "",
    fallback: "",
  });

  // UI Control States
  const [copiedId, setCopiedId] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [capacityWarning, setCapacityWarning] = useState("");

  // Modals States
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState("navy");
  const [newGroupAsDefault, setNewGroupAsDefault] = useState(false);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [shareExpiry, setShareExpiry] = useState("none");

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [moveLinkId, setMoveLinkId] = useState("");
  const [moveTargetGroupId, setMoveTargetGroupId] = useState("uncategorized");

  const [isBatchQrOpen, setIsBatchQrOpen] = useState(false);
  const [batchQrSize, setBatchQrSize] = useState("400");
  const [batchQrPreviewUrl, setBatchQrPreviewUrl] = useState("");

  // Feature 1: Link Expiration
  const [expiresAt, setExpiresAt] = useState("");
  const [maxClicks, setMaxClicks] = useState("");

  // Feature 2: Password Protection
  const [linkPassword, setLinkPassword] = useState("");

  // Feature 3: Edit Destination URL
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editLinkId, setEditLinkId] = useState("");
  const [editLinkUrl, setEditLinkUrl] = useState("");

  // Feature 4: Bulk Import
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkGroupId, setBulkGroupId] = useState("uncategorized");

  // Feature 7: Tags
  const [newTags, setNewTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [activeTagFilter, setActiveTagFilter] = useState("");

  // Color Definitions
  const GROUP_COLORS = {
    navy: "var(--color-navy)",
    forest: "var(--color-forest)",
    brick: "var(--color-brick)",
    slate: "var(--color-slate)",
    teal: "var(--color-teal)",
  };

  // Helper: Show notification
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // Fetch Groups
  const fetchGroups = async () => {
    try {
      const res = await fetchWithUser("/api/groups");
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
        // Find default group
        const defaultGrp = data.find((g) => g.id === defaultGroupId);
        if (!defaultGrp && data.length > 0) {
          setAssignedGroupId(data[0].id);
        } else {
          setAssignedGroupId(defaultGroupId);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Links
  const fetchLinks = async () => {
    try {
      const res = await fetchWithUser("/api/links");
      if (res.ok) {
        const data = await res.json();
        setLinks(data);

        // Warn if capacity is approaching 500 links
        if (data.length >= 500) {
          setCapacityWarning(
            "Warning: Link limit reached (500 links). Delete old links to create new ones.",
          );
        } else if (data.length >= 400) {
          setCapacityWarning(
            `Warning: approaching maximum link capacity (${data.length} / 500 links).`,
          );
        } else {
          setCapacityWarning("");
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Check shared view or setup app on mount
  useEffect(() => {
    const initApp = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const shareId = urlParams.get("view");

      if (shareId) {
        try {
          const res = await fetch(`/api/share/${shareId}`);
          if (res.ok) {
            const data = await res.json();
            setReadOnlyMode(true);
            setReadOnlyGroupInfo(data.group);
            setLinks(data.links);
            setGroups([data.group]);
            setActiveGroupId(data.group.id);
            return;
          } else {
            alert("Shared view not found or has expired.");
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname,
            );
          }
        } catch (e) {
          console.error(e);
        }
      }

      // Default Mode
      await fetchGroups();
      await fetchLinks();
    };

    initApp();
  }, []);

  // Listen to cross-tab storage updates
  useEffect(() => {
    const handleStorageChange = () => {
      if (!readOnlyMode) {
        fetchGroups();
        fetchLinks();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [readOnlyMode]);

  // Keyboard Shortcuts: Ctrl+Shift+S focuses URL input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === "KeyS") {
        e.preventDefault();
        const input = document.getElementById("longUrlInput");
        if (input) input.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Real-time Vanity Code Validation
  useEffect(() => {
    if (!useCustomCode || vanityCode.trim() === "") {
      setVanityStatus({
        valid: true,
        text: "Auto-generates random code if empty.",
        fallback: "",
      });
      return;
    }

    const validate = setTimeout(async () => {
      try {
        const res = await fetchWithUser(
          `/api/validate-vanity?code=${encodeURIComponent(vanityCode)}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.valid) {
            setVanityStatus({ valid: true, text: "✓ Available", fallback: "" });
          } else {
            let msg = "✗ Invalid";
            if (data.error === "too short") msg = "✗ Too short (min 3 chars)";
            else if (data.error === "invalid format")
              msg = "✗ Invalid format (letters, numbers, hyphens only)";
            else if (data.error === "taken") msg = `✗ Code taken.`;
            setVanityStatus({
              valid: false,
              text: msg,
              fallback: data.suggestion || "",
            });
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 300);

    return () => clearTimeout(validate);
  }, [vanityCode, useCustomCode]);

  // Helper: Construct full redirect link
  const getShortUrl = (code) => {
    return `${window.location.origin}/${code}`;
  };

  // Form submit handler
  const handleShorten = async (e) => {
    e.preventDefault();
    if (readOnlyMode) return;

    if (links.length >= 500) {
      alert("Maximum database capacity of 500 links reached.");
      return;
    }

    if (!url || url.trim() === "") {
      alert("Enter a valid URL");
      return;
    }

    try {
      const parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        alert("Enter a valid URL (must start with http:// or https://)");
        return;
      }
    } catch (err) {
      alert("Enter a valid URL");
      return;
    }

    if (useCustomCode && vanityCode.trim() !== "" && !vanityStatus.valid) {
      alert("Please fix the vanity code errors first.");
      return;
    }

    // Temporary code to construct QR url preview
    const finalCode =
      useCustomCode && vanityCode.trim() !== ""
        ? vanityCode.trim().toLowerCase()
        : generateRandomCode();
    const mockShortUrl = getShortUrl(finalCode);

    try {
      // Generate QR Code data URL
      const qrDataUri = await QRCode.toDataURL(mockShortUrl, {
        margin: 1,
        width: 200,
      });

      const res = await fetchWithUser("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          longUrl: url,
          vanityCode: useCustomCode ? vanityCode : undefined,
          groupId: assignedGroupId,
          qrCode: qrDataUri,
          expiresAt: expiresAt || undefined,
          maxClicks: maxClicks ? parseInt(maxClicks) : undefined,
          password: linkPassword || undefined,
          tags: newTags,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setUrl("");
        setVanityCode("");
        setUseCustomCode(false);
        setExpiresAt("");
        setMaxClicks("");
        setLinkPassword("");
        setNewTags([]);
        setTagInput("");
        triggerToast(
          `Link created in group: ${groups.find((g) => g.id === assignedGroupId)?.name || "Uncategorized"}`,
        );
        fetchLinks();
      } else {
        alert(data.error || "Failed to shorten URL.");
      }
    } catch (err) {
      console.error(err);
      alert("Error creating short link. Please check network.");
    }
  };

  // Helpers: Copy to clipboard
  const handleCopy = (shortCode, id) => {
    const fullLink = getShortUrl(shortCode);
    navigator.clipboard.writeText(fullLink).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Helpers: Single Download QR
  const downloadSingleQr = (link) => {
    const a = document.createElement("a");
    a.href = link.qrCode;
    a.download = `qr_${link.shortCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Handle Bulk Import
  const handleBulkImport = async () => {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      alert("No URLs entered.");
      return;
    }
    if (lines.length > 100) {
      alert("Maximum 100 URLs per bulk import.");
      return;
    }
    try {
      const res = await fetchWithUser("/api/bulk-shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: lines, groupId: bulkGroupId }),
      });
      const data = await res.json();
      if (res.ok) {
        const succeeded = data.results.filter((r) => r.success).length;
        const failed = data.results.filter((r) => !r.success).length;
        setIsBulkImportOpen(false);
        setBulkText("");
        fetchLinks();
        triggerToast(`Bulk import: ${succeeded} created${failed > 0 ? `, ${failed} failed` : ""}.`);
      } else {
        alert(data.error || "Bulk import failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error during bulk import.");
    }
  };

  // Handle CSV file upload for bulk import
  const handleBulkCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      // Extract URLs: try to find http/https URLs from CSV content
      const lines = text.split(/\r?\n/).map((l) => {
        // If it looks like CSV with multiple columns, grab first column
        const cols = l.split(",");
        const candidate = cols.find((c) => c.trim().startsWith("http"));
        return candidate ? candidate.trim().replace(/^"|"$/g, "") : l.trim().replace(/^"|"$/g, "");
      }).filter((l) => l.startsWith("http"));
      setBulkText(lines.join("\n"));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Handle Edit Link Save
  const handleEditLinkSave = async () => {
    if (!editLinkUrl.trim()) {
      alert("URL cannot be empty.");
      return;
    }
    try {
      new URL(editLinkUrl.trim());
    } catch {
      alert("Enter a valid URL including http:// or https://");
      return;
    }
    try {
      const res = await fetchWithUser(`/api/links/${editLinkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ longUrl: editLinkUrl.trim() }),
      });
      if (res.ok) {
        setIsEditModalOpen(false);
        triggerToast("Destination URL updated.");
        fetchLinks();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to update link.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error.");
    }
  };

  // Move Link Submission
  const handleMoveLinkSubmit = async () => {
    try {
      const res = await fetchWithUser("/api/links/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkId: moveLinkId,
          groupId: moveTargetGroupId,
        }),
      });
      if (res.ok) {
        setIsMoveModalOpen(false);
        triggerToast("Link moved successfully.");
        fetchLinks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Link
  const handleDeleteLink = async (link) => {
    if (confirm(`Delete short link "${link.shortCode}"?`)) {
      try {
        const res = await fetchWithUser(`/api/links/${link._id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          triggerToast("Link deleted.");
          fetchLinks();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Group creation modal submission
  const handleCreateGroup = async () => {
    if (groups.length >= 50) {
      alert("Maximum limit of 50 groups reached.");
      return;
    }
    if (!newGroupName || newGroupName.trim() === "") {
      alert("Group name is required.");
      return;
    }

    try {
      const res = await fetchWithUser("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupName,
          color: newGroupColor,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (newGroupAsDefault) {
          setDefaultGroupId(data.id);
        }
        setIsAddGroupOpen(false);
        setNewGroupName("");
        setActiveGroupId(data.id);
        triggerToast(`Group "${data.name}" created.`);
        fetchGroups();
      } else {
        alert(data.error || "Failed to create group.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Archive Active Group
  const handleArchiveGroup = async () => {
    if (activeGroupId === "all" || activeGroupId === "uncategorized") return;
    const activeGrpObj = groups.find((g) => g.id === activeGroupId);
    if (!activeGrpObj) return;

    try {
      const res = await fetchWithUser(`/api/groups/${activeGroupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !activeGrpObj.archived }),
      });
      if (res.ok) {
        const wasArchived = !activeGrpObj.archived;
        setActiveGroupId("all");
        triggerToast(wasArchived ? "Group archived." : "Group unarchived.");
        fetchGroups();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete All Links in Group
  const handleDeleteAllInGroup = async () => {
    const warningText =
      activeGroupId === "all"
        ? "Are you sure you want to delete ALL links in the application? This cannot be undone."
        : `Are you sure you want to delete all links in this group? This cannot be undone.`;

    if (confirm(warningText)) {
      try {
        const res = await fetchWithUser(`/api/links/group/${activeGroupId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          triggerToast("All group links deleted.");
          fetchLinks();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Copy All Short URLs in Group
  const handleCopyAllLinks = () => {
    const filtered =
      activeGroupId === "all"
        ? links
        : links.filter((l) => l.groupId === activeGroupId);
    if (filtered.length === 0) {
      alert("No links to copy.");
      return;
    }
    const txt = filtered.map((l) => getShortUrl(l.shortCode)).join("\n");
    navigator.clipboard.writeText(txt).then(() => {
      triggerToast("All group short links copied to clipboard.");
    });
  };

  // Export Group Links as CSV
  const handleExportCsv = () => {
    const filtered =
      activeGroupId === "all"
        ? links
        : links.filter((l) => l.groupId === activeGroupId);
    if (filtered.length === 0) {
      alert("No links to export.");
      return;
    }
    let csvContent =
      "data:text/csv;charset=utf-8,Short Code,Original URL,Clicks,Created Date\n";
    filtered.forEach((l) => {
      const escapedUrl = l.longUrl.replace(/"/g, '""');
      csvContent += `"${l.shortCode}","${escapedUrl}",${l.clicks || 0},"${new Date(l.createdAt).toLocaleDateString()}"\n`;
    });
    const encoded = encodeURI(csvContent);
    const a = document.createElement("a");
    a.setAttribute("href", encoded);

    const activeGrp = groups.find((g) => g.id === activeGroupId);
    const name =
      activeGroupId === "all" ? "all_links" : activeGrp?.name || "group";
    a.setAttribute(
      "download",
      `${name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_export.csv`,
    );
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Open Share Group Link dialog
  const handleShareGroupBtnClick = () => {
    const activeGrp = groups.find((g) => g.id === activeGroupId);
    if (
      !activeGrp ||
      activeGrp.id === "all" ||
      activeGrp.id === "uncategorized"
    )
      return;

    const shareUrl = `${window.location.origin}${window.location.pathname}?view=${activeGrp.shareId}`;
    setShareLink(shareUrl);
    setIsShareModalOpen(true);
  };

  // Batch QR Code Download Zip
  const handleBatchQrBtnClick = async () => {
    const filtered =
      activeGroupId === "all"
        ? links
        : links.filter((l) => l.groupId === activeGroupId);
    if (filtered.length === 0) {
      alert("No links in this group to download.");
      return;
    }
    // Generate preview
    const sampleLink = filtered[0];
    const previewUri = await QRCode.toDataURL(
      getShortUrl(sampleLink.shortCode),
      { width: 150, margin: 1 },
    );
    setBatchQrPreviewUrl(previewUri);
    setIsBatchQrOpen(true);
  };

  const handleDownloadZip = async () => {
    const filtered =
      activeGroupId === "all"
        ? links
        : links.filter((l) => l.groupId === activeGroupId);
    const size = parseInt(batchQrSize);

    const activeGrp = groups.find((g) => g.id === activeGroupId);
    const name =
      activeGroupId === "all" ? "all-groups" : activeGrp?.name || "group";
    const folderName = name.replace(/[^a-z0-9]/gi, "_").toLowerCase();

    setIsBatchQrOpen(false);
    triggerToast("Generating ZIP archive...");

    const zip = new JSZip();
    for (const link of filtered) {
      const fullUrl = getShortUrl(link.shortCode);
      const dataUri = await QRCode.toDataURL(fullUrl, {
        width: size,
        margin: 1,
      });
      const base64Data = dataUri.split(",")[1];
      zip.file(`${folderName}_${link.shortCode}.png`, base64Data, {
        base64: true,
      });
    }

    zip.generateAsync({ type: "blob" }).then((content) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `${folderName}_qr_codes.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      triggerToast("ZIP folder downloaded.");
    });
  };

  // Helper to generate a 6 character code
  const generateRandomCode = () => {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

// Feature 8: Click Analytics
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [analyticsEvents, setAnalyticsEvents] = useState([]);
  const [analyticsLink, setAnalyticsLink] = useState(null);

  // Feature 5: Search and Sort
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("date-desc");

  // Link Filtering for render
  let filteredLinks =
    activeGroupId === "all"
      ? links
      : links.filter((l) => l.groupId === activeGroupId);

  // Apply search filter
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filteredLinks = filteredLinks.filter(
      (l) =>
        l.shortCode.toLowerCase().includes(q) ||
        l.longUrl.toLowerCase().includes(q)
    );
  }

  // Apply sort
  filteredLinks = [...filteredLinks].sort((a, b) => {
    switch (sortOrder) {
      case "date-asc":
        return new Date(a.createdAt) - new Date(b.createdAt);
      case "date-desc":
        return new Date(b.createdAt) - new Date(a.createdAt);
      case "clicks-desc":
        return (b.clicks || 0) - (a.clicks || 0);
      case "clicks-asc":
        return (a.clicks || 0) - (b.clicks || 0);
      case "alpha-asc":
        return a.shortCode.localeCompare(b.shortCode);
      case "alpha-desc":
        return b.shortCode.localeCompare(a.shortCode);
      default:
        return new Date(b.createdAt) - new Date(a.createdAt);
    }
  });

  // Apply tag filter
  if (activeTagFilter) {
    filteredLinks = filteredLinks.filter(
      (l) => Array.isArray(l.tags) && l.tags.includes(activeTagFilter)
    );
  }

  const activeGroup = groups.find((g) => g.id === activeGroupId);

  return (
    <div className="app-root-react">
      {capacityWarning && (
        <div className="system-banner" style={{ display: "block" }}>
          {capacityWarning}
        </div>
      )}

      {readOnlyMode && (
        <div className="readonly-banner">
          Viewing Shared Group (Read-Only Mode) — Links cannot be created,
          modified, or deleted.
        </div>
      )}

      <div className="app-wrapper">
        {/* SIDEBAR PANEL */}
        {!readOnlyMode && (
          <aside>
            <div className="sidebar-section">
              <h3>Groups</h3>
              <ul className="group-list">
                <li
                  className={`group-item ${activeGroupId === "all" ? "active" : ""}`}
                  onClick={() => setActiveGroupId("all")}
                >
                  <div className="group-name-wrapper">
                    <span
                      className="color-dot"
                      style={{ backgroundColor: "#7f7f7f" }}
                    ></span>
                    <span>All Links</span>
                  </div>
                  <span className="group-badge-count">{links.length}</span>
                </li>

                {groups.map((g) => {
                  if (g.archived && activeGroupId !== g.id) return null;
                  const count = links.filter((l) => l.groupId === g.id).length;
                  return (
                    <li
                      key={g.id}
                      className={`group-item ${activeGroupId === g.id ? "active" : ""}`}
                      onClick={() => setActiveGroupId(g.id)}
                    >
                      <div className="group-name-wrapper">
                        <span
                          className="color-dot"
                          style={{
                            backgroundColor: GROUP_COLORS[g.color] || "#7f7f7f",
                          }}
                        ></span>
                        <span>
                          {g.name} {g.archived ? "(Archived)" : ""}
                        </span>
                      </div>
                      <span className="group-badge-count">{count}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <button
              className="sidebar-footer-btn"
              onClick={() => setIsAddGroupOpen(true)}
            >
              + Add Group
            </button>
          </aside>
        )}

        {/* MAIN PANEL */}
        <main>
          <div className="header-banner">
            <div>
              <h1>
                {activeGroupId === "all"
                  ? "All Links"
                  : readOnlyMode
                    ? readOnlyGroupInfo?.name || "Shared Group"
                    : activeGroup?.name || "Group"}
              </h1>
              <p>
                {activeGroupId === "all"
                  ? "All shortened URLs in this dashboard."
                  : activeGroup?.archived
                    ? "[Archived] "
                    : ""}
                {activeGroup &&
                  `Group created on ${new Date(activeGroup.createdAt).toLocaleDateString()}`}
              </p>
            </div>
            <div className="global-stats">
              Total Links: <span>{links.length}</span> / 500
              <br />
              Total Clicks:{" "}
              <span>{links.reduce((sum, l) => sum + (l.clicks || 0), 0)}</span>
            </div>
          </div>

          {/* CREATOR FORM */}
          {!readOnlyMode && (
            <section className="creator-section">
              <form onSubmit={handleShorten} noValidate>
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
                    <select
                      id="groupSelect"
                      value={assignedGroupId}
                      onChange={(e) => setAssignedGroupId(e.target.value)}
                    >
                      {groups
                        .filter((g) => !g.archived)
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="form-row" style={{ alignItems: "flex-start" }}>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={useCustomCode}
                        onChange={(e) => setUseCustomCode(e.target.checked)}
                      />
                      Use custom vanity code
                    </label>

                    {useCustomCode && (
                      <div style={{ marginTop: "8px" }}>
                        <input
                          type="text"
                          value={vanityCode}
                          onChange={(e) => setVanityCode(e.target.value)}
                          placeholder="e.g. black-friday-promo"
                          maxLength={50}
                        />
                        <div
                          className={`vanity-validation-msg ${vanityStatus.valid ? "valid" : "invalid"}`}
                        >
                          {vanityStatus.text}
                          {!vanityStatus.valid && vanityStatus.fallback && (
                            <span
                              style={{ display: "block", marginTop: "2px" }}
                            >
                              Try fallback suggestion:{" "}
                              <strong
                                style={{
                                  textDecoration: "underline",
                                  cursor: "pointer",
                                }}
                                onClick={() =>
                                  setVanityCode(vanityStatus.fallback)
                                }
                              >
                                {vanityStatus.fallback}
                              </strong>
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <div className="form-group" style={{ minWidth: "160px" }}>
                        <label htmlFor="expiresAtInput" style={{ fontSize: "12px" }}>Expiry Date (optional)</label>
                        <input
                          type="date"
                          id="expiresAtInput"
                          value={expiresAt}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setExpiresAt(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ minWidth: "130px" }}>
                        <label htmlFor="maxClicksInput" style={{ fontSize: "12px" }}>Max Clicks (optional)</label>
                        <input
                          type="number"
                          id="maxClicksInput"
                          value={maxClicks}
                          min="1"
                          placeholder="e.g. 100"
                          onChange={(e) => setMaxClicks(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ minWidth: "150px" }}>
                        <label htmlFor="linkPasswordInput" style={{ fontSize: "12px" }}>Password (optional)</label>
                        <input
                          type="password"
                          id="linkPasswordInput"
                          value={linkPassword}
                          placeholder="Protect this link"
                          autoComplete="new-password"
                          onChange={(e) => setLinkPassword(e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: "4px" }}>
                      <label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>Tags (press Enter to add)</label>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                        {newTags.map((tag) => (
                          <span key={tag} style={{ background: "var(--border-color)", padding: "2px 8px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
                            #{tag}
                            <button type="button" onClick={() => setNewTags(newTags.filter((t) => t !== tag))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", lineHeight: 1 }}>×</button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
                              if (t && !newTags.includes(t) && newTags.length < 10) {
                                setNewTags([...newTags, t]);
                              }
                              setTagInput("");
                            }
                          }}
                          placeholder="e.g. marketing"
                          style={{ flex: 1, minWidth: "120px" }}
                        />
                      </div>
                    </div>
                    <button type="submit" className="submit-btn">
                      Shorten
                    </button>
                  </div>
                </div>
              </form>
            </section>
          )}

          {/* ACTIONS BAR */}
          <section className="group-actions-bar">
            <div className="group-info-stats">
              {activeGroupId === "all"
                ? `All Groups: ${filteredLinks.length} Links | ${filteredLinks.reduce((sum, l) => sum + (l.clicks || 0), 0)} Clicks`
                : `${activeGroup?.name || "Group"}: ${filteredLinks.length} Links | ${filteredLinks.reduce((sum, l) => sum + (l.clicks || 0), 0)} Clicks`}
            </div>

            <div className="actions-buttons">
              {!readOnlyMode &&
                activeGroupId !== "all" &&
                activeGroupId !== "uncategorized" && (
                  <>
                    <button
                      className="btn-action"
                      onClick={handleShareGroupBtnClick}
                    >
                      Share Group
                    </button>
                    <button className="btn-action" onClick={handleArchiveGroup}>
                      {activeGroup?.archived
                        ? "Unarchive Group"
                        : "Archive Group"}
                    </button>
                  </>
                )}

              <button className="btn-action" onClick={handleBatchQrBtnClick}>
                Download QRs
              </button>
              <button className="btn-action" onClick={handleCopyAllLinks}>
                Copy All Links
              </button>
              <button className="btn-action" onClick={handleExportCsv}>
                Export CSV
              </button>
              {!readOnlyMode && (
                <button
                  className="btn-action"
                  onClick={() => { setBulkGroupId(activeGroupId === "all" ? "uncategorized" : activeGroupId); setIsBulkImportOpen(true); }}
                >
                  Bulk Add
                </button>
              )}

              {!readOnlyMode && (
                <button
                  className="btn-action"
                  style={{ color: "var(--color-brick)" }}
                  onClick={handleDeleteAllInGroup}
                >
                  Delete All
                </button>
              )}
            </div>
          </section>

          {/* SEARCH + SORT BAR */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "8px 0", flexWrap: "wrap" }}>
            <input
              type="search"
              id="searchLinksInput"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by URL or short code..."
              style={{ flex: 1, minWidth: "200px" }}
            />
            <select
              id="sortOrderSelect"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{ minWidth: "180px" }}
            >
              <option value="date-desc">Date: Newest First</option>
              <option value="date-asc">Date: Oldest First</option>
              <option value="clicks-desc">Clicks: Most First</option>
              <option value="clicks-asc">Clicks: Least First</option>
              <option value="alpha-asc">Short Code: A → Z</option>
              <option value="alpha-desc">Short Code: Z → A</option>
            </select>
            {/* Tag filter */}
            {links.some((l) => Array.isArray(l.tags) && l.tags.length > 0) && (
              <select
                id="tagFilterSelect"
                value={activeTagFilter}
                onChange={(e) => setActiveTagFilter(e.target.value)}
                style={{ minWidth: "130px" }}
              >
                <option value="">All Tags</option>
                {[...new Set(links.flatMap((l) => l.tags || []))].sort().map((tag) => (
                  <option key={tag} value={tag}>#{tag}</option>
                ))}
              </select>
            )}
          </div>

          {/* LINKS LIST */}
          <section className="links-list">
            {filteredLinks.length === 0 ? (
              <div className="empty-state">
                No links yet. Create one to get started.
              </div>
            ) : (
              filteredLinks.map((link) => {
                const grp = groups.find((g) => g.id === link.groupId);
                const grpName = grp ? grp.name : "Uncategorized";
                const grpColor = grp
                  ? GROUP_COLORS[grp.color]
                  : "var(--color-slate)";
                const shortUrl = getShortUrl(link.shortCode);

                return (
                  <div className="link-card" key={link._id || link.id}>
                    <div className="qr-thumb-container">
                      <img src={link.qrCode} alt="QR Thumbnail" />
                      <div className="qr-hover-preview">
                        <img src={link.qrCode} alt="QR Large Preview" />
                      </div>
                    </div>

                    <div className="link-details">
                      <div className="link-header-row">
                        <a
                          className="short-link-display"
                          href={shortUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {link.shortCode}
                        </a>
                        {link.vanityCode && (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "var(--text-muted)",
                            }}
                          >
                            ({link.vanityCode})
                          </span>
                        )}
                        <span
                          className="group-badge"
                          style={{ backgroundColor: grpColor }}
                        >
                          {grpName}
                        </span>
                        {link.password && (
                          <span title="Password protected" style={{ fontSize: "14px" }}>🔒</span>
                        )}
                        {link.active === false && (
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-brick)", border: "1px solid var(--color-brick)", padding: "1px 5px", borderRadius: "2px" }}>PAUSED</span>
                        )}
                      </div>

                      <div
                        className="original-url-display"
                        title={link.longUrl}
                      >
                        Original:{" "}
                        <a href={link.longUrl} target="_blank" rel="noreferrer">
                          {link.longUrl}
                        </a>
                      </div>

                      <div className="link-meta-row">
                        <span>
                          Clicks: <strong>{link.clicks || 0}</strong>
                          {link.maxClicks && (
                            <span style={{ color: "var(--text-muted)", fontSize: "11px" }}> / {link.maxClicks} max</span>
                          )}
                        </span>
                        <span>
                          Created:{" "}
                          {new Date(link.createdAt).toLocaleDateString()}
                        </span>
                        {link.expiresAt && (
                          <span style={{ fontSize: "11px", color: new Date() > new Date(link.expiresAt) ? "var(--color-brick)" : "var(--text-muted)" }}>
                            {new Date() > new Date(link.expiresAt)
                              ? "⏰ EXPIRED"
                              : `Expires: ${new Date(link.expiresAt).toLocaleDateString()}`}
                          </span>
                        )}
                        {link.maxClicks !== null && link.maxClicks !== undefined && link.clicks >= link.maxClicks && (
                          <span style={{ fontSize: "11px", color: "var(--color-brick)" }}>🔢 CLICK LIMIT HIT</span>
                        )}
                      </div>
                      {/* Tag pills */}
                      {Array.isArray(link.tags) && link.tags.length > 0 && (
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                          {link.tags.map((tag) => (
                            <span
                              key={tag}
                              title={`Filter by #${tag}`}
                              onClick={() => setActiveTagFilter(activeTagFilter === tag ? "" : tag)}
                              style={{ background: activeTagFilter === tag ? "var(--color-navy)" : "var(--border-color)", color: activeTagFilter === tag ? "#fff" : "inherit", padding: "1px 7px", fontSize: "11px", cursor: "pointer", borderRadius: "2px" }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="link-card-actions">
                      <button
                        className={`card-action-btn copy-btn ${copiedId === link.id ? "copied" : ""}`}
                        onClick={() => handleCopy(link.shortCode, link.id)}
                      >
                        {copiedId === link.id ? "Copied" : "Copy"}
                      </button>

                      <button
                        className="card-action-btn"
                        onClick={() => downloadSingleQr(link)}
                      >
                        QR PNG
                      </button>

                      {!readOnlyMode && (
                        <>
                          <button
                            className="card-action-btn"
                            onClick={() => {
                              setEditLinkId(link._id);
                              setEditLinkUrl(link.longUrl);
                              setIsEditModalOpen(true);
                            }}
                          >
                            Edit
                          </button>

                          <button
                            className="card-action-btn"
                            style={{ color: link.active === false ? "var(--color-forest)" : "var(--color-brick)" }}
                            onClick={async () => {
                              const newActive = link.active !== false ? false : true;
                              const res = await fetchWithUser(`/api/links/${link._id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ active: newActive }),
                              });
                              if (res.ok) {
                                triggerToast(newActive ? "Link activated." : "Link paused.");
                                fetchLinks();
                              }
                            }}
                          >
                            {link.active === false ? "Activate" : "Pause"}
                          </button>

                          <button
                            className="card-action-btn"
                            onClick={() => {
                              setMoveLinkId(link._id);
                              setMoveTargetGroupId(link.groupId);
                              setIsMoveModalOpen(true);
                            }}
                          >
                            Move
                          </button>

                          <button
                            className="card-action-btn btn-delete"
                            onClick={() => handleDeleteLink(link)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {!readOnlyMode && (
            <div className="keyboard-help" id="keyboardHelp">
              <strong>Shortcut:</strong> Press <code>Ctrl+Shift+S</code> to
              auto-focus the long URL input field.
            </div>
          )}
        </main>
      </div>

      {/* TOAST CONTAINER */}
      {toastMessage && (
        <div className="toast-container">
          <div className="toast">{toastMessage}</div>
        </div>
      )}

      {/* MODAL: ADD GROUP */}
      {isAddGroupOpen && (
        <div className="modal-overlay" style={{ display: "flex" }}>
          <div className="modal-card">
            <div className="modal-header">
              <h4>Create New Group</h4>
              <button
                className="modal-close"
                onClick={() => setIsAddGroupOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="newGroupName">Group Name (Max 30 chars)</label>
              <input
                type="text"
                id="newGroupName"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                maxLength={30}
                required
              />
            </div>

            <div className="form-group">
              <label>Select Badge Color</label>
              <div className="color-picker" id="groupColorPicker">
                {Object.keys(GROUP_COLORS).map((colorKey) => (
                  <div
                    key={colorKey}
                    className={`color-option ${newGroupColor === colorKey ? "selected" : ""}`}
                    style={{ backgroundColor: GROUP_COLORS[colorKey] }}
                    onClick={() => setNewGroupColor(colorKey)}
                  />
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={newGroupAsDefault}
                  onChange={(e) => setNewGroupAsDefault(e.target.checked)}
                />
                Set as default group for future links
              </label>
            </div>

            <div className="modal-footer">
              <button
                className="btn-action"
                onClick={() => setIsAddGroupOpen(false)}
              >
                Cancel
              </button>
              <button className="submit-btn" onClick={handleCreateGroup}>
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SHARE GROUP */}
      {isShareModalOpen && (
        <div className="modal-overlay" style={{ display: "flex" }}>
          <div className="modal-card">
            <div className="modal-header">
              <h4>Share Group</h4>
              <button
                className="modal-close"
                onClick={() => setIsShareModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <p>
              Anyone with this read-only link can view this group's links and
              click counts.
            </p>

            <div className="form-group">
              <label>Shareable Link</label>
              <input type="text" value={shareLink} readOnly />
            </div>

            <div className="form-group">
              <label htmlFor="shareExpirySelect">Link Expiration</label>
              <select
                id="shareExpirySelect"
                value={shareExpiry}
                onChange={(e) => setShareExpiry(e.target.value)}
              >
                <option value="none">No Expiry</option>
                <option value="7">7 Days</option>
                <option value="30">30 Days</option>
              </select>
            </div>

            <div className="modal-footer">
              <button
                className="submit-btn"
                onClick={() => {
                  navigator.clipboard.writeText(shareLink).then(() => {
                    triggerToast("Shareable link copied to clipboard.");
                    setIsShareModalOpen(false);
                  });
                }}
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MOVE LINK */}
      {isMoveModalOpen && (
        <div className="modal-overlay" style={{ display: "flex" }}>
          <div className="modal-card">
            <div className="modal-header">
              <h4>Move Link to Group</h4>
              <button
                className="modal-close"
                onClick={() => setIsMoveModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="moveLinkSelect">Choose Destination Group</label>
              <select
                id="moveLinkSelect"
                value={moveTargetGroupId}
                onChange={(e) => setMoveTargetGroupId(e.target.value)}
              >
                {groups
                  .filter((g) => !g.archived)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="modal-footer">
              <button
                className="btn-action"
                onClick={() => setIsMoveModalOpen(false)}
              >
                Cancel
              </button>
              <button className="submit-btn" onClick={handleMoveLinkSubmit}>
                Move Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BATCH QR DOWNLOAD */}
      {isBatchQrOpen && (
        <div className="modal-overlay" style={{ display: "flex" }}>
          <div className="modal-card">
            <div className="modal-header">
              <h4>Batch Download QR Codes</h4>
              <button
                className="modal-close"
                onClick={() => setIsBatchQrOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="batchQrSize">Select Download Dimension</label>
              <select
                id="batchQrSize"
                value={batchQrSize}
                onChange={(e) => setBatchQrSize(e.target.value)}
              >
                <option value="200">Small (200x200 px)</option>
                <option value="400">Medium (400x400 px)</option>
                <option value="600">Large (600x600 px)</option>
              </select>
            </div>

            <div className="form-group" style={{ alignItems: "center" }}>
              <label>QR Code Preview</label>
              <div
                id="batchQrPreview"
                style={{
                  width: "150px",
                  height: "150px",
                  border: "1px solid var(--border-color)",
                  marginTop: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#fafafa",
                }}
              >
                {batchQrPreviewUrl && (
                  <img
                    src={batchQrPreviewUrl}
                    style={{ width: "130px", height: "130px" }}
                    alt="Batch Preview"
                  />
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-action"
                onClick={() => setIsBatchQrOpen(false)}
              >
                Cancel
              </button>
              <button className="submit-btn" onClick={handleDownloadZip}>
                Download ZIP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT LINK URL */}
      {isEditModalOpen && (
        <div className="modal-overlay" style={{ display: "flex" }}>
          <div className="modal-card">
            <div className="modal-header">
              <h4>Edit Destination URL</h4>
              <button
                className="modal-close"
                onClick={() => setIsEditModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <div className="form-group">
              <label htmlFor="editLinkUrlInput">New Destination URL</label>
              <input
                type="url"
                id="editLinkUrlInput"
                value={editLinkUrl}
                onChange={(e) => setEditLinkUrl(e.target.value)}
                placeholder="https://new-destination.com/path"
              />
            </div>
            <div className="modal-footer">
              <button
                className="btn-action"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </button>
              <button className="submit-btn" onClick={handleEditLinkSave}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BULK IMPORT */}
      {isBulkImportOpen && (
        <div className="modal-overlay" style={{ display: "flex" }}>
          <div className="modal-card" style={{ maxWidth: "520px" }}>
            <div className="modal-header">
              <h4>Bulk Add Links</h4>
              <button
                className="modal-close"
                onClick={() => setIsBulkImportOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="bulkGroupSelect">Assign All to Group</label>
              <select
                id="bulkGroupSelect"
                value={bulkGroupId}
                onChange={(e) => setBulkGroupId(e.target.value)}
              >
                {groups.filter((g) => !g.archived).map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="bulkTextArea">Paste URLs (one per line, max 100)</label>
              <textarea
                id="bulkTextArea"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={8}
                placeholder={"https://example.com/page1\nhttps://another.com/page2\nhttps://third.com"}
                style={{ width: "100%", fontFamily: "monospace", fontSize: "13px", resize: "vertical" }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="bulkCsvUpload" style={{ fontSize: "12px" }}>Or upload a CSV file (URLs in any column)</label>
              <input
                type="file"
                id="bulkCsvUpload"
                accept=".csv,.txt"
                onChange={handleBulkCsvUpload}
              />
            </div>

            <div className="modal-footer">
              <button
                className="btn-action"
                onClick={() => setIsBulkImportOpen(false)}
              >
                Cancel
              </button>
              <button className="submit-btn" onClick={handleBulkImport}>
                Import {bulkText.split("\n").filter((l) => l.trim()).length} Links
              </button>
            </div>
          </div>
        </div>
      )}
{/* MODAL: ANALYTICS */}
{isAnalyticsOpen && analyticsLink && (
  <div className="modal-overlay" style={{ display: "flex" }}>
    <div className="modal-card" style={{ maxWidth: "600px", maxHeight: "80vh", overflowY: "auto" }}>
      <div className="modal-header">
        <h4>Analytics for {analyticsLink.shortCode}</h4>
        <button className="modal-close" onClick={() => setIsAnalyticsOpen(false)}>&times;</button>
      </div>
      <div className="modal-body">
        {analyticsEvents.length === 0 ? (
          <p>No click data available.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ borderBottom: "1px solid var(--border-color)", padding: "4px" }}>Time</th>
                <th style={{ borderBottom: "1px solid var(--border-color)", padding: "4px" }}>Referrer</th>
                <th style={{ borderBottom: "1px solid var(--border-color)", padding: "4px" }}>User Agent</th>
              </tr>
            </thead>
            <tbody>
              {analyticsEvents.map((e, i) => (
                <tr key={i}>
                  <td style={{ padding: "4px" }}>{new Date(e.timestamp).toLocaleString()}</td>
                  <td style={{ padding: "4px" }}>{e.referrer || "-"}</td>
                  <td style={{ padding: "4px" }}>{e.userAgent || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="modal-footer">
        <button className="btn-action" onClick={() => setIsAnalyticsOpen(false)}>Close</button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

export default App;

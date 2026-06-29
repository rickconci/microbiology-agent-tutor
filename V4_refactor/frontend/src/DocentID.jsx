import { useState, useRef, useEffect, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = "/api/v1";

const ORGANISMS = [
  { value: "staphylococcus aureus", label: "Staphylococcus aureus", group: "Bacteria" },
  { value: "escherichia coli", label: "Escherichia coli", group: "Bacteria" },
  { value: "nocardia species", label: "Nocardia species", group: "Bacteria" },
  { value: "borrelia burgdorferi", label: "Borrelia burgdorferi", group: "Bacteria" },
  { value: "streptococcus pneumoniae", label: "Streptococcus pneumoniae", group: "Bacteria" },
  { value: "mycobacterium tuberculosis", label: "Mycobacterium tuberculosis", group: "Bacteria" },
  { value: "clostridium difficile", label: "Clostridioides difficile", group: "Bacteria" },
  { value: "neisseria meningitidis", label: "Neisseria meningitidis", group: "Bacteria" },
  { value: "hsv-1", label: "HSV-1", group: "Viruses" },
  { value: "influenza a", label: "Influenza A", group: "Viruses" },
  { value: "hiv", label: "HIV", group: "Viruses" },
  { value: "ebv", label: "EBV", group: "Viruses" },
  { value: "sars-cov-2", label: "SARS-CoV-2", group: "Viruses" },
  { value: "candida albicans", label: "Candida albicans", group: "Fungi" },
  { value: "aspergillus fumigatus", label: "Aspergillus fumigatus", group: "Fungi" },
  { value: "cryptococcus neoformans", label: "Cryptococcus neoformans", group: "Fungi" },
  { value: "plasmodium falciparum", label: "Plasmodium falciparum", group: "Parasites" },
  { value: "taenia solium", label: "Taenia solium", group: "Parasites" },
];

const MODULES = [
  {
    id: "history_taking",
    label: "History Taking",
    icon: "🩺",
    description: "Interview the patient directly — gather a history, review exam findings, order diagnostics and see results to build your clinical picture.",
  },
  {
    id: "differential_diagnosis",
    label: "Differential Diagnosis",
    icon: "🔬",
    description: "Build a systematic differential from the presenting complaint and the patient's history — layered clinical reasoning, step by step.",
  },
  {
    id: "management",
    label: "Management",
    icon: "💊",
    description: "Walk through the management for the patient with infection — stabilisation, empiric therapy, targeted treatment, monitoring, escalation, and discharge.",
  },
  {
    id: "pathophys_epi",
    label: "Pathophys & Epidemiology",
    icon: "🧫",
    description: "Understand WHY this disease presents the way it does — mechanisms, virulence factors, and look-alike challenges.",
  },
];

const PHASES = [
  { id: "information_gathering", label: "History & Exam", icon: "🩺" },
  { id: "differential_diagnosis", label: "Differential Dx", icon: "🔬" },
  { id: "tests_management", label: "Tests & Tx", icon: "💊" },
  { id: "feedback", label: "Review", icon: "✅" },
];

const HOW_IT_WORKS_CONTENT = [
  "docent.ID teaches clinical infectious diseases through active case-based learning.",
  "Rather than presenting information to read, it puts you inside a case. You interview a patient, gather findings, reason through a differential diagnosis, and justify your management plan — guided throughout by Socratic questioning that never gives away the answer.",
  "Each session draws on real cases from the MGH ID Images library and is grounded in Mandell's Principles and Practices of Infectious Diseases. The tutor adapts to your reasoning in real time, probing gaps and reinforcing strong thinking.",
  "Four learning modules let you focus on what matters most: building a clinical history, constructing a differential, working through management, or understanding the underlying pathophysiology and epidemiology.",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateCaseId() {
  return `case_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatMessage(text) {
  if (!text) return "";
  let out = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*(.*?)\*/g, "<em>$1</em>");
  out = out.replace(/\n/g, "<br/>");
  return out;
}

// ─── CSS variables injected into <head> ──────────────────────────────────────

function useDarkMode() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.style.setProperty("--surface-0", "#0f1117");
      root.style.setProperty("--surface-1", "#161b22");
      root.style.setProperty("--surface-2", "#1e2433");
      root.style.setProperty("--border", "rgba(255,255,255,0.08)");
      root.style.setProperty("--border-strong", "rgba(255,255,255,0.15)");
      root.style.setProperty("--border-accent", "#3b82f6");
      root.style.setProperty("--text-primary", "#e6edf3");
      root.style.setProperty("--text-secondary", "#8b949e");
      root.style.setProperty("--text-muted", "#484f58");
      root.style.setProperty("--text-accent", "#58a6ff");
      root.style.setProperty("--text-danger", "#f85149");
      root.style.setProperty("--text-success", "#3fb950");
      root.style.setProperty("--text-disabled", "#484f58");
      root.style.setProperty("--fill-accent", "#1f6feb");
      root.style.setProperty("--fill-accent-hover", "#388bfd");
      root.style.setProperty("--fill-disabled", "#21262d");
      root.style.setProperty("--on-accent", "#ffffff");
      root.style.setProperty("--bg-accent", "rgba(56,139,253,0.1)");
      root.style.setProperty("--bg-danger", "rgba(248,81,73,0.1)");
      root.style.setProperty("--bg-success", "rgba(63,185,80,0.1)");
      root.style.setProperty("--bg-pro", "rgba(139,92,246,0.15)");
      root.style.setProperty("--border-danger", "rgba(248,81,73,0.3)");
      root.style.setProperty("--border-success", "rgba(63,185,80,0.3)");
      root.style.setProperty("--border-pro", "rgba(139,92,246,0.3)");
      root.style.setProperty("--radius", "6px");
      root.style.setProperty("--font-sans", "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif");
      root.style.setProperty("--modal-bg", "#1e2433");
      root.style.setProperty("--modal-border", "rgba(255,255,255,0.18)");
    } else {
      root.style.setProperty("--surface-0", "#f6f8fa");
      root.style.setProperty("--surface-1", "#ffffff");
      root.style.setProperty("--surface-2", "#ffffff");
      root.style.setProperty("--border", "rgba(0,0,0,0.08)");
      root.style.setProperty("--border-strong", "rgba(0,0,0,0.18)");
      root.style.setProperty("--border-accent", "#2563eb");
      root.style.setProperty("--text-primary", "#1a1f2e");
      root.style.setProperty("--text-secondary", "#4b5563");
      root.style.setProperty("--text-muted", "#9ca3af");
      root.style.setProperty("--text-accent", "#1d4ed8");
      root.style.setProperty("--text-danger", "#dc2626");
      root.style.setProperty("--text-success", "#16a34a");
      root.style.setProperty("--text-disabled", "#d1d5db");
      root.style.setProperty("--fill-accent", "#2563eb");
      root.style.setProperty("--fill-accent-hover", "#1d4ed8");
      root.style.setProperty("--fill-disabled", "#e5e7eb");
      root.style.setProperty("--on-accent", "#ffffff");
      root.style.setProperty("--bg-accent", "#eff6ff");
      root.style.setProperty("--bg-danger", "#fef2f2");
      root.style.setProperty("--bg-success", "#f0fdf4");
      root.style.setProperty("--bg-pro", "#f5f3ff");
      root.style.setProperty("--border-danger", "#fecaca");
      root.style.setProperty("--border-success", "#bbf7d0");
      root.style.setProperty("--border-pro", "#ddd6fe");
      root.style.setProperty("--radius", "6px");
      root.style.setProperty("--font-sans", "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif");
      root.style.setProperty("--modal-bg", "#ffffff");
      root.style.setProperty("--modal-border", "rgba(0,0,0,0.18)");
    }
  }, [dark]);
  return [dark, setDark];
}

// ─── Organism search input ────────────────────────────────────────────────────

function OrganismSearch({ value, onChange }) {
  const [query, setQuery] = useState(value ? ORGANISMS.find(o => o.value === value)?.label || "" : "");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef(null);

  const filtered = query.trim().length === 0
    ? ORGANISMS
    : ORGANISMS.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.group.toLowerCase().includes(query.toLowerCase())
      );

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectOrganism = (org, random = false) => {
    setQuery(org.label);
    onChange(org.value, random);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!open) { if (e.key === "ArrowDown" || e.key === "Enter") setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[highlighted]) selectOrganism(filtered[highlighted]); }
    else if (e.key === "Escape") setOpen(false);
  };

  const handleRandomClick = () => {
    const r = ORGANISMS[Math.floor(Math.random() * ORGANISMS.length)];
    setQuery("🎲 Random case selected");
    onChange(r.value, true);
    setOpen(false);
  };

  // Group results
  const groups = {};
  filtered.forEach(o => {
    if (!groups[o.group]) groups[o.group] = [];
    groups[o.group].push(o);
  });

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={query}
          placeholder="Type to search organisms…"
          onFocus={() => setOpen(true)}
          onChange={e => {
            setQuery(e.target.value);
            onChange("");
            setOpen(true);
            setHighlighted(0);
          }}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            padding: "10px 36px 10px 12px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border-strong)",
            background: "var(--surface-1)",
            color: "var(--text-primary)",
            fontSize: 14,
            fontFamily: "var(--font-sans)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); onChange(""); setOpen(true); }}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", fontSize: 16, lineHeight: 1, padding: 0,
            }}
          >×</button>
        )}
      </div>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          background: "var(--surface-1)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          zIndex: 50,
          maxHeight: 280,
          overflowY: "auto",
        }}>
          {/* Random case option always at top */}
          <div
            onMouseDown={handleRandomClick}
            onMouseEnter={() => setHighlighted(-1)}
            style={{
              padding: "9px 12px",
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: highlighted === -1 ? "var(--text-accent)" : "var(--text-secondary)",
              background: highlighted === -1 ? "var(--bg-accent)" : "transparent",
              borderBottom: "1px solid var(--border)",
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            <span>🎲</span>
            <span>Random case</span>
          </div>
          {filtered.length > 0 && Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div style={{
                padding: "6px 12px 4px",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                background: "var(--surface-0)",
              }}>
                {group}
              </div>
              {items.map(org => {
                const idx = filtered.indexOf(org);
                const isHighlighted = idx === highlighted;
                return (
                  <div
                    key={org.value}
                    onMouseDown={() => selectOrganism(org)}
                    onMouseEnter={() => setHighlighted(idx)}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontSize: 14,
                      fontStyle: group === "Viruses" ? "normal" : "italic",
                      background: isHighlighted ? "var(--bg-accent)" : "transparent",
                      color: isHighlighted ? "var(--text-accent)" : "var(--text-primary)",
                    }}
                  >
                    {org.label}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, children, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--modal-bg)",
          border: "1px solid var(--modal-border)",
          borderRadius: 12,
          padding: "28px 28px 24px",
          maxWidth: 540,
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-sans)" }}>{title}</h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 22, lineHeight: 1, padding: "0 0 0 16px" }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function AboutDropdown({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const items = [
    { id: "about_overview", label: "Overview", desc: "What is docent.ID?" },
    { id: "about_architecture", label: "Architecture", desc: "RAG, agents & LLM pipeline" },
    { id: "about_team", label: "The team", desc: "Who built this" },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          ...hBtn,
          background: open ? "var(--bg-accent)" : "transparent",
          color: open ? "var(--text-accent)" : "var(--text-secondary)",
          borderColor: open ? "var(--border-accent)" : undefined,
          display: "flex", alignItems: "center", gap: 4,
          transition: "background 0.15s, color 0.15s",
        }}
      >
        About
        <span style={{
          fontSize: 9, opacity: 0.6, marginTop: 1,
          display: "inline-block",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s ease",
        }}>▼</span>
      </button>

      <div style={{
        position: "absolute", top: "calc(100% + 6px)", right: 0,
        background: "var(--modal-bg)", border: "1px solid var(--modal-border)",
        borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        zIndex: 200, minWidth: 200, overflow: "hidden",
        // Smooth open/close via transform + opacity
        transformOrigin: "top right",
        transform: open ? "scaleY(1) translateY(0)" : "scaleY(0.85) translateY(-8px)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "transform 0.18s cubic-bezier(0.16,1,0.3,1), opacity 0.15s ease",
      }}>
        {items.map((item, i) => (
          <button
            key={item.id}
            onClick={() => { onNavigate(item.id); setOpen(false); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "10px 14px", background: "transparent", border: "none",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              cursor: "pointer",
              transition: "background 0.1s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-accent)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>{item.label}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, fontFamily: "var(--font-sans)" }}>{item.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AppHeader({ user, onLogout, dark, onToggleDark, onNavigate, onShowHowItWorks, onShowHistory, onShowProfile }) {
  return (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px", height: 52,
      borderBottom: "1px solid var(--border)", background: "var(--surface-1)",
      flexShrink: 0, fontFamily: "var(--font-sans)",
      position: "relative", zIndex: 100,
    }}>
      <span style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em", cursor: "pointer" }}
        onClick={() => onNavigate("setup")}>
        docent.ID
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={onToggleDark} style={hBtn}>{dark ? "Light" : "Dark"}</button>
        <AboutDropdown onNavigate={onNavigate} />
        <button onClick={onShowHowItWorks} style={hBtn}>How it works</button>
        <button onClick={() => onNavigate("case_library")} style={hBtn}>Case library</button>
        <button onClick={onShowHistory} style={hBtn}>My history</button>
        <button onClick={onShowProfile} style={{ ...hBtn, background: "var(--bg-accent)", borderColor: "var(--border-accent)", color: "var(--text-accent)", fontWeight: 500 }}>
          {user || "Account"}
        </button>
      </div>
    </header>
  );
}

const hBtn = {
  padding: "5px 12px",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius)",
  background: "transparent",
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontSize: 13,
  fontFamily: "var(--font-sans)",
};

// ─── Login Page ───────────────────────────────────────────────────────────────

function LoginPage({ onLogin, dark, onToggleDark }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      if (username === "admin" && password === "admin") {
        onLogin(username);
      } else {
        setError("Incorrect username or password.");
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--surface-0)", fontFamily: "var(--font-sans)" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 24px", borderBottom: "1px solid var(--border)", background: "var(--surface-1)",
      }}>
        <span style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>docent.ID</span>
        <button onClick={onToggleDark} style={hBtn}>{dark ? "Light" : "Dark"}</button>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{
          width: "100%", maxWidth: 360,
          background: "var(--modal-bg)",
          border: "1px solid var(--modal-border)",
          borderRadius: 12, padding: "32px 28px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px", fontFamily: "var(--font-sans)" }}>Sign in</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 24px", fontFamily: "var(--font-sans)" }}>Access your docent.ID account</p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 5, fontFamily: "var(--font-sans)" }}>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} autoFocus
                style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border-strong)", background: "var(--surface-0)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box", fontFamily: "var(--font-sans)", outline: "none" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 5, fontFamily: "var(--font-sans)" }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border-strong)", background: "var(--surface-0)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box", fontFamily: "var(--font-sans)", outline: "none" }}
              />
            </div>
            {error && (
              <div style={{ fontSize: 13, color: "var(--text-danger)", padding: "6px 10px", background: "var(--bg-danger)", borderRadius: "var(--radius)", fontFamily: "var(--font-sans)" }}>{error}</div>
            )}
            <button type="submit" disabled={loading} style={{
              padding: "9px", background: loading ? "var(--fill-disabled)" : "var(--fill-accent)",
              color: loading ? "var(--text-disabled)" : "var(--on-accent)", border: "none",
              borderRadius: "var(--radius)", cursor: loading ? "default" : "pointer",
              fontSize: 14, fontWeight: 500, marginTop: 4, fontFamily: "var(--font-sans)",
            }}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────

function SetupScreen({ onStart }) {
  const [organism, setOrganism] = useState("");
  const [selectedModules, setSelectedModules] = useState([]);
  const [isRandom, setIsRandom] = useState(false);

  const toggleModule = (id) => {
    setSelectedModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const setOrgWithRandom = (value, random = false) => {
    setOrganism(value);
    setIsRandom(random);
    setSelectedModules([]);
  };

  const canStart = organism && selectedModules.length > 0;
  const orgLabel = ORGANISMS.find(o => o.value === organism)?.label || organism;

  return (
    <div style={{
      flex: 1, overflowY: "auto",
      display: "flex", flexDirection: "column",
      alignItems: "center",
      padding: "40px 24px 60px",
      fontFamily: "var(--font-sans)",
    }}>
      <div style={{ width: "100%", maxWidth: 580 }}>

        {/* Label */}
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: "0.03em" }}>
          Choose a pathogen to study
        </p>

        {/* Search box */}
        <div style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-strong)",
          borderRadius: 12,
          padding: "16px",
        }}>
          <OrganismSearch value={organism} onChange={(v, random) => setOrgWithRandom(v, random)} />
        </div>

        {/* Modules — appear after organism chosen */}
        {organism && (
          <div style={{ marginTop: 28 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: "0.03em" }}>
              Select one or more modules
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {MODULES.map(mod => {
                const active = selectedModules.includes(mod.id);
                return (
                  <button key={mod.id} onClick={() => toggleModule(mod.id)} style={{
                    textAlign: "left", padding: "14px 16px",
                    background: active ? "var(--bg-accent)" : "var(--surface-1)",
                    border: active ? "1.5px solid var(--border-accent)" : "1px solid var(--border-strong)",
                    borderRadius: 10, cursor: "pointer", transition: "all 0.13s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>{mod.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: active ? "var(--text-accent)" : "var(--text-primary)", fontFamily: "var(--font-sans)" }}>
                        {mod.label}
                      </span>
                      {active && (
                        <span style={{
                          marginLeft: "auto", width: 16, height: 16, borderRadius: "50%",
                          background: "var(--fill-accent)", color: "var(--on-accent)",
                          fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>✓</span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: active ? "var(--text-accent)" : "var(--text-secondary)", margin: 0, lineHeight: 1.5, fontFamily: "var(--font-sans)" }}>
                      {mod.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => canStart && onStart(organism, selectedModules, isRandom)}
              disabled={!canStart}
              style={{
                marginTop: 20, width: "100%", padding: "11px",
                background: canStart ? "var(--fill-accent)" : "var(--fill-disabled)",
                color: canStart ? "var(--on-accent)" : "var(--text-disabled)",
                border: "none", borderRadius: "var(--radius)",
                cursor: canStart ? "pointer" : "default",
                fontSize: 14, fontWeight: 500, transition: "background 0.13s",
                fontFamily: "var(--font-sans)",
              }}
            >
              {canStart
                ? isRandom
                  ? "Start random case"
                  : `Start case — ${orgLabel}`
                : "Select a module to continue"
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, onFeedback }) {
  const isUser = msg.role === "user";
  const [feedbackGiven, setFeedbackGiven] = useState(null);
  if (msg.role === "system") return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, maxWidth: "85%", flexDirection: isUser ? "row-reverse" : "row" }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: isUser ? "var(--bg-accent)" : "var(--surface-0)",
          border: "1px solid var(--border)", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 13, flexShrink: 0, marginTop: 2,
        }}>
          {isUser ? "👤" : "👨‍⚕️"}
        </div>
        <div style={{
          background: isUser ? "var(--bg-accent)" : "var(--surface-1)",
          border: `1px solid ${isUser ? "var(--border-accent)" : "var(--border)"}`,
          borderRadius: isUser ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
          padding: "10px 14px", fontSize: 14, lineHeight: 1.6,
          color: "var(--text-primary)", fontFamily: "var(--font-sans)",
        }}>
          {msg.streaming ? (
            <span>{msg.content}<span style={{ display: "inline-block", width: 6, height: 14, background: "var(--text-secondary)", marginLeft: 2, borderRadius: 1, animation: "blink 1s infinite" }} /></span>
          ) : (
            <span dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
          )}
        </div>
      </div>

      {!isUser && !msg.streaming && onFeedback && (
        <div style={{ display: "flex", gap: 4, marginTop: 4, marginLeft: 36 }}>
          {[1, 2, 3, 4, 5].map(r => (
            <button key={r} onClick={() => { setFeedbackGiven(r); onFeedback(msg, r); }}
              style={{
                background: feedbackGiven === r ? "var(--bg-accent)" : "transparent",
                border: "1px solid var(--border)", borderRadius: 4,
                padding: "2px 6px", fontSize: 11,
                color: feedbackGiven === r ? "var(--text-accent)" : "var(--text-muted)", cursor: "pointer",
                fontFamily: "var(--font-sans)",
              }}>
              {r}
            </button>
          ))}
          {feedbackGiven && <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center", fontFamily: "var(--font-sans)" }}>Rated</span>}
        </div>
      )}
    </div>
  );
}

// ─── Collapsible Image ────────────────────────────────────────────────────────

function CollapsibleImage({ title, src }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "7px 10px", background: "var(--surface-0)", border: "1px solid var(--border)",
          borderRadius: open ? "6px 6px 0 0" : "6px", cursor: "pointer",
          fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", fontFamily: "var(--font-sans)",
        }}
      >
        <span>📷 {title}</span>
        <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
          <img src={src} alt={title} style={{ width: "100%", display: "block" }} />
        </div>
      )}
    </div>
  );
}

// ─── Left Panel: Context Box ──────────────────────────────────────────────────

function ContextPanel({ module, chiefComplaint, caseContext, revealedInfo, onImportToEMR }) {
  const isHistory = module === "history_taking";
  const isPathophys = module === "pathophys_epi";
  const [imported, setImported] = useState(false);

  const handleImport = () => {
    if (onImportToEMR && caseContext) {
      onImportToEMR(caseContext);
      setImported(true);
      setTimeout(() => setImported(false), 2000);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Top half: case context — occupies 50% */}
      <div style={{ flex: 1, overflowY: "auto", padding: 12, borderBottom: "1px solid var(--border)", minHeight: 0 }}>
        {/* Header row with label + import button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {isHistory ? "Chief Complaint" : "Case Summary"}
          </div>
          {!isHistory && caseContext && onImportToEMR && (
            <button
              onClick={handleImport}
              title="Import this summary into the Electronic Medical Record"
              style={{
                padding: "3px 9px", borderRadius: "var(--radius)",
                border: "1px solid var(--border-accent)",
                background: imported ? "var(--bg-success)" : "transparent",
                color: imported ? "var(--text-success)" : "var(--text-accent)",
                cursor: "pointer", fontSize: 11, fontFamily: "var(--font-sans)",
                transition: "all 0.15s",
              }}
            >
              {imported ? "✓ Imported" : "→ Import to EMR"}
            </button>
          )}
        </div>

        {isHistory ? (
          <div style={{
            background: "var(--bg-accent)", border: "1px solid var(--border-accent)",
            borderRadius: 8, padding: "10px 12px", fontSize: 13, lineHeight: 1.6,
            color: "var(--text-primary)", fontStyle: "italic", fontFamily: "var(--font-sans)",
          }}>
            {chiefComplaint || <span style={{ color: "var(--text-muted)" }}>Waiting for case to start…</span>}
          </div>
        ) : caseContext ? (
          <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6, fontFamily: "var(--font-sans)" }}>

            {/* Presentation */}
            {caseContext.presentation && (
              <div style={{ marginBottom: 10 }}>
                <div style={sectionLabel}>Presentation</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{caseContext.presentation}</div>
              </div>
            )}

            {/* Key exam findings */}
            {caseContext.examFindings && (
              <div style={{ marginBottom: 10 }}>
                <div style={sectionLabel}>Key Examination Findings</div>
                {Array.isArray(caseContext.examFindings) ? (
                  <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                    {caseContext.examFindings.map((f, i) => <li key={i} style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 2 }}>{f}</li>)}
                  </ul>
                ) : (
                  <div style={{ fontSize: 13 }}>{caseContext.examFindings}</div>
                )}
              </div>
            )}

            {/* Investigations */}
            {caseContext.investigations && (
              <div style={{ marginBottom: 10 }}>
                <div style={sectionLabel}>Investigations</div>
                {Array.isArray(caseContext.investigations) ? (
                  <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                    {caseContext.investigations.map((f, i) => <li key={i} style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 2 }}>{f}</li>)}
                  </ul>
                ) : (
                  <div style={{ fontSize: 13 }}>{caseContext.investigations}</div>
                )}
              </div>
            )}

            {/* Diagnosis — pathophys only */}
            {isPathophys && caseContext.diagnosis && (
              <div style={{ marginBottom: 10 }}>
                <div style={sectionLabel}>Diagnosis</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{caseContext.diagnosis}</div>
              </div>
            )}

            {/* Assessment — pathophys only */}
            {isPathophys && caseContext.assessment && (
              <div style={{ marginBottom: 10 }}>
                <div style={sectionLabel}>Assessment</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{caseContext.assessment}</div>
              </div>
            )}

            {/* Collapsible images */}
            {caseContext.examImage && <CollapsibleImage title="Exam finding" src={caseContext.examImage} />}
            {caseContext.radiologyImage && (
              <>
                <CollapsibleImage title="Radiology" src={caseContext.radiologyImage} />
                {caseContext.radiologyNote && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>{caseContext.radiologyNote}</div>
                )}
              </>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Waiting for case to start…</span>
        )}
      </div>

      {/* Curbside consult — starts at 50% of column height */}
      <CurbsideConsult />
    </div>
  );
}

const sectionLabel = {
  fontSize: 10, fontWeight: 700, color: "var(--text-accent)",
  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3,
};

// ─── Curbside Consult ─────────────────────────────────────────────────────────

function CurbsideConsult() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const ask = async () => {
    const q = question.trim();
    if (!q || loading) return;
    setQuestion("");
    setLoading(true);
    setAnswer(null);
    try {
      const res = await fetch(`${API_BASE}/clarify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history }),
      });
      const data = await res.json();
      const a = data.response || "No response.";
      setAnswer(a);
      setHistory(prev => [...prev, { role: "user", content: q }, { role: "assistant", content: a }]);
    } catch {
      setAnswer("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 12, minHeight: 0, overflow: "hidden" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        Curbside Consult
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.5 }}>
        Quick questions without interrupting your case.
      </div>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, marginBottom: 8 }}>
        {answer && (
          <div style={{
            background: "var(--surface-0)", border: "1px solid var(--border)",
            borderRadius: 6, padding: "8px 10px", fontSize: 12, lineHeight: 1.6,
            color: "var(--text-primary)", fontFamily: "var(--font-sans)",
          }}>
            <span dangerouslySetInnerHTML={{ __html: formatMessage(answer) }} />
          </div>
        )}
        {loading && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ display: "inline-block", width: 10, height: 10, border: "1.5px solid var(--border-strong)", borderTopColor: "var(--text-accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            Asking…
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === "Enter" && ask()}
          placeholder='e.g. "How do I interpret CRP?"'
          style={{
            flex: 1, padding: "7px 10px", borderRadius: "var(--radius)",
            border: "1px solid var(--border-strong)", background: "var(--surface-0)",
            color: "var(--text-primary)", fontSize: 12, fontFamily: "var(--font-sans)", outline: "none",
          }}
        />
        <button onClick={ask} disabled={!question.trim() || loading} style={{
          padding: "7px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border-strong)",
          background: "transparent", color: question.trim() && !loading ? "var(--text-accent)" : "var(--text-muted)",
          cursor: question.trim() && !loading ? "pointer" : "default",
          fontSize: 12, fontWeight: 500, fontFamily: "var(--font-sans)",
        }}>Ask</button>
      </div>
    </div>
  );
}

// ─── Right Panel: Electronic Medical Record ───────────────────────────────────

function EMRSection({ title, fields, data, emptyMsg }) {
  const entries = fields.filter(f => data[f.key]);
  if (entries.length === 0) return (
    <div style={{ marginBottom: 14 }}>
      <div style={emrGroupLabel}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 0", fontStyle: "italic" }}>{emptyMsg}</div>
    </div>
  );
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={emrGroupLabel}>{title}</div>
      {entries.map(f => (
        <div key={f.key} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{f.label}</div>
          <div style={{
            fontSize: 12, color: "var(--text-primary)", lineHeight: 1.6,
            padding: "6px 9px", background: "var(--surface-0)",
            border: "1px solid var(--border)", borderRadius: 5, fontFamily: "var(--font-sans)",
          }}>
            {Array.isArray(data[f.key])
              ? <ul style={{ margin: 0, paddingLeft: 14 }}>{data[f.key].map((v, i) => <li key={i} style={{ marginBottom: 2 }}>{v}</li>)}</ul>
              : String(data[f.key])
            }
          </div>
        </div>
      ))}
    </div>
  );
}

const emrGroupLabel = {
  fontSize: 11, fontWeight: 700, color: "var(--text-secondary)",
  textTransform: "uppercase", letterSpacing: "0.07em",
  borderBottom: "1px solid var(--border)", paddingBottom: 4, marginBottom: 8,
};

function EMRPanel({ module, emrData, hasHistoryModule }) {
  const data = emrData || {};
  const isEmpty = Object.keys(data).length === 0;

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "12px 12px 20px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>
        Electronic Medical Record
      </div>

      {isEmpty ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, fontFamily: "var(--font-sans)", fontStyle: "italic" }}>
          {hasHistoryModule
            ? "Information gathered about the patient will appear here as you take the history."
            : "Clinical details will populate here as the case progresses."}
        </div>
      ) : (
        <>
          {/* 1. Patient History */}
          <EMRSection
            title="Patient History"
            data={data}
            emptyMsg="No history gathered yet."
            fields={[
              { key: "chief_complaint", label: "Chief Complaint" },
              { key: "hpi", label: "History of Present Illness" },
              { key: "pmh", label: "Past Medical History" },
              { key: "surgical_history", label: "Surgical History" },
              { key: "social_history", label: "Social History" },
              { key: "family_history", label: "Family History" },
              { key: "allergies", label: "Allergies" },
              { key: "medications", label: "Medications" },
            ]}
          />

          {/* 2. Examination Findings */}
          <EMRSection
            title="Examination Findings"
            data={data}
            emptyMsg="No examination findings yet."
            fields={[
              { key: "vitals", label: "Vital Signs" },
              { key: "exam", label: "Physical Examination" },
              { key: "review_of_systems", label: "Review of Systems" },
            ]}
          />

          {/* 3. Investigations */}
          <div style={{ marginBottom: 14 }}>
            <div style={emrGroupLabel}>Investigations</div>

            {/* Labs sub-group */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Laboratories</div>
              {[
                { key: "labs", label: "General" },
                { key: "cbc", label: "CBC" },
                { key: "chemistries", label: "Chemistries" },
                { key: "lft", label: "LFTs" },
                { key: "coagulation", label: "Coagulation" },
              ].filter(f => data[f.key]).length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>No labs yet.</div>
              ) : (
                [
                  { key: "labs", label: "General" },
                  { key: "cbc", label: "CBC" },
                  { key: "chemistries", label: "Chemistries" },
                  { key: "lft", label: "LFTs" },
                  { key: "coagulation", label: "Coagulation" },
                ].filter(f => data[f.key]).map(f => (
                  <div key={f.key} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 1 }}>{f.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-primary)", padding: "5px 8px", background: "var(--surface-0)", border: "1px solid var(--border)", borderRadius: 5 }}>
                      {Array.isArray(data[f.key]) ? data[f.key].join(", ") : String(data[f.key])}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Microbiology */}
            {data.microbiology && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Microbiology</div>
                <div style={{ fontSize: 12, color: "var(--text-primary)", padding: "5px 8px", background: "var(--surface-0)", border: "1px solid var(--border)", borderRadius: 5 }}>
                  {Array.isArray(data.microbiology)
                    ? <ul style={{ margin: 0, paddingLeft: 14 }}>{data.microbiology.map((v, i) => <li key={i}>{v}</li>)}</ul>
                    : String(data.microbiology)
                  }
                </div>
              </div>
            )}

            {/* Histopathology */}
            {data.histopathology && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Histopathology</div>
                <div style={{ fontSize: 12, color: "var(--text-primary)", padding: "5px 8px", background: "var(--surface-0)", border: "1px solid var(--border)", borderRadius: 5 }}>
                  {String(data.histopathology)}
                </div>
              </div>
            )}
          </div>

          {/* 4. Radiology */}
          <EMRSection
            title="Radiology"
            data={data}
            emptyMsg="No imaging ordered yet."
            fields={[
              { key: "imaging", label: "Imaging" },
              { key: "xray", label: "X-Ray" },
              { key: "ct", label: "CT" },
              { key: "mri", label: "MRI" },
              { key: "ultrasound", label: "Ultrasound" },
            ]}
          />

          {/* 5. Special Tests */}
          <EMRSection
            title="Special Tests"
            data={data}
            emptyMsg="No special tests yet."
            fields={[
              { key: "special_tests", label: "Special Tests" },
              { key: "serology", label: "Serology" },
              { key: "pcr", label: "PCR / Molecular" },
              { key: "biopsy", label: "Biopsy" },
              { key: "other", label: "Other" },
            ]}
          />
        </>
      )}
    </div>
  );
}

// ─── Module Progress Bar ──────────────────────────────────────────────────────

function ModuleProgressBar({ modules, activeModule, onSwitchModule, progress }) {
  return (
    <div style={{
      display: "flex", gap: 6, padding: "8px 12px",
      borderBottom: "1px solid var(--border)", background: "var(--surface-1)",
      flexShrink: 0, overflowX: "auto",
    }}>
      {MODULES.map(mod => {
        const selected = modules.includes(mod.id);
        const active = mod.id === activeModule;
        const pct = selected ? (progress[mod.id] || 0) : 0;
        return (
          <button
            key={mod.id}
            onClick={() => selected && onSwitchModule(mod.id)}
            disabled={!selected}
            style={{
              display: "flex", flexDirection: "column", gap: 4,
              padding: "6px 12px", borderRadius: 8, flexShrink: 0,
              border: active ? "1.5px solid var(--border-accent)" : "1px solid var(--border)",
              background: active ? "var(--bg-accent)" : "transparent",
              cursor: selected ? "pointer" : "default",
              opacity: selected ? 1 : 0.35,
              minWidth: 120,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 12 }}>{mod.icon}</span>
              <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? "var(--text-accent)" : "var(--text-secondary)", fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}>
                {mod.label}
              </span>
            </div>
            <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: active ? "var(--fill-accent)" : "var(--border-strong)", borderRadius: 2, transition: "width 0.4s" }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Chat Screen ──────────────────────────────────────────────────────────────

function ChatScreen({ organism, modules, isRandom, onEndCase }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [caseActive, setCaseActive] = useState(false);
  const [caseId] = useState(generateCaseId);
  const [activeModule, setActiveModule] = useState(modules[0] || "history_taking");
  const [currentPhase, setCurrentPhase] = useState("information_gathering");
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(true);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [caseContext, setCaseContext] = useState(null);
  const [revealedInfo, setRevealedInfo] = useState({});
  const [progress, setProgress] = useState({});
  // EMR data persists across module switches; initialized from caseContext for non-history modules
  const [emrData, setEmrData] = useState({});
  const hasHistoryModule = modules.includes("history_taking");

  const historyRef = useRef([]);
  const chatboxRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (chatboxRef.current) chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/start_case`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organism, case_id: caseId, model_name: null, enable_guidelines: false }),
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();
        const msg = { role: "assistant", content: data.initial_message };
        historyRef.current = [msg];
        setMessages([msg]);
        // Extract chief complaint from first message (first sentence of patient speech)
        const firstSentence = data.initial_message.split(/[.!?]/)[0]?.trim();
        if (firstSentence) setChiefComplaint(firstSentence + ".");
        // Extract structured context from history
        if (data.history) extractCaseContext(data);
        setCaseActive(true);
      } catch (err) {
        setError(`Could not connect to server: ${err.message}`);
      } finally {
        setStarting(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    })();
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !caseActive) return;
    setInput("");
    setError(null);

    const userMsg = { role: "user", content: text };
    historyRef.current = [...historyRef.current, userMsg];
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const streamingId = Date.now();
    setMessages(prev => [...prev, { id: streamingId, role: "assistant", content: "", streaming: true }]);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: historyRef.current, organism_key: organism, case_id: caseId, model_name: null, feedback_enabled: true, current_phase: currentPhase }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const contentType = res.headers.get("content-type") || "";
      let responseText = "";

      if (contentType.includes("text/event-stream")) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of decoder.decode(value).split("\n")) {
            if (line.startsWith("data: ") && line.slice(6) !== "[DONE]") {
              try {
                const p = JSON.parse(line.slice(6));
                if (p.content) { responseText += p.content; setMessages(prev => prev.map(m => m.id === streamingId ? { ...m, content: responseText } : m)); }
                if (p.phase) setCurrentPhase(p.phase);
                if (p.revealed_info) setRevealedInfo(prev => ({ ...prev, ...p.revealed_info }));
              } catch {}
            }
          }
        }
      } else {
        const data = await res.json();
        responseText = data.response || data.content || data.message || JSON.stringify(data);
        if (data.metadata?.current_phase) setCurrentPhase(data.metadata.current_phase);
        if (data.metadata?.revealed_info) {
          setRevealedInfo(prev => ({ ...prev, ...data.metadata.revealed_info }));
          setEmrData(prev => ({ ...prev, ...data.metadata.revealed_info }));
        }
        // Increment progress for active module
        setProgress(prev => ({
          ...prev,
          [activeModule]: Math.min(100, (prev[activeModule] || 0) + 12),
        }));
      }

      const aMsg = { role: "assistant", content: responseText };
      historyRef.current = [...historyRef.current, aMsg];
      setMessages(prev => prev.map(m => m.id === streamingId ? aMsg : m));
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== streamingId));
      setError(`Message failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [input, loading, caseActive, organism, caseId, currentPhase, activeModule]);

  const handleFeedback = useCallback(async (msg, rating) => {
    try {
      await fetch(`${API_BASE}/feedback`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, message: msg.content, history: historyRef.current, case_id: caseId, organism }),
      });
    } catch {}
  }, [caseId, organism]);

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const [revealed, setRevealed] = useState(false);
  const orgLabel = ORGANISMS.find(o => o.value === organism)?.label || organism;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", fontFamily: "var(--font-sans)" }}>

      {/* ── Top bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 12px", height: 44, background: "var(--surface-1)",
        borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        {/* Organism name / dots + reveal toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isRandom && !revealed ? (
            <>
              <span style={{ fontSize: 18, letterSpacing: 4, color: "var(--text-muted)", userSelect: "none" }}>••••••</span>
              <button
                onClick={() => setRevealed(true)}
                title="Reveal organism"
                style={{
                  padding: "3px 10px", borderRadius: "var(--radius)",
                  border: "1px solid var(--border-strong)", background: "transparent",
                  color: "var(--text-secondary)", cursor: "pointer", fontSize: 11,
                  fontFamily: "var(--font-sans)",
                }}
              >
                Reveal
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic" }}>{orgLabel}</span>
              {isRandom && revealed && (
                <button
                  onClick={() => setRevealed(false)}
                  title="Hide organism"
                  style={{
                    padding: "3px 10px", borderRadius: "var(--radius)",
                    border: "1px solid var(--border-strong)", background: "transparent",
                    color: "var(--text-muted)", cursor: "pointer", fontSize: 11,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Hide
                </button>
              )}
            </>
          )}
        </div>

        {/* New case button — prominent */}
        <button onClick={onEndCase} style={{
          padding: "6px 16px", borderRadius: "var(--radius)",
          border: "none",
          background: "var(--fill-accent)",
          color: "var(--on-accent)",
          cursor: "pointer", fontSize: 13, fontWeight: 500,
          fontFamily: "var(--font-sans)",
        }}>← New case</button>
      </div>

      {/* ── Module progress tabs ── */}
      <ModuleProgressBar
        modules={modules}
        activeModule={activeModule}
        onSwitchModule={setActiveModule}
        progress={progress}
      />

      {/* ── 3-column body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left column */}
        <div style={{
          width: 300, flexShrink: 0, borderRight: "1px solid var(--border)",
          background: "var(--surface-1)", display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <ContextPanel
            module={activeModule}
            chiefComplaint={chiefComplaint}
            caseContext={caseContext}
            revealedInfo={revealedInfo}
            onImportToEMR={(ctx) => {
              const mapped = {};
              if (ctx.presentation) mapped.hpi = ctx.presentation;
              if (ctx.examFindings) mapped.exam = Array.isArray(ctx.examFindings) ? ctx.examFindings.join("\n") : ctx.examFindings;
              if (ctx.investigations) mapped.labs = Array.isArray(ctx.investigations) ? ctx.investigations.join("\n") : ctx.investigations;
              if (ctx.diagnosis) mapped.diagnosis = ctx.diagnosis;
              if (ctx.assessment) mapped.assessment = ctx.assessment;
              setEmrData(prev => ({ ...prev, ...mapped }));
            }}
          />
        </div>

        {/* Middle column: chat */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minWidth: 0 }}>
          <div ref={chatboxRef} style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
            {starting && (
              <div style={{ color: "var(--text-muted)", fontSize: 14, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid var(--border-strong)", borderTopColor: "var(--text-accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                Starting case…
              </div>
            )}
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} onFeedback={msg.role === "assistant" && !msg.streaming ? handleFeedback : null} />
            ))}
            {loading && !messages.find(m => m.streaming) && (
              <div style={{ color: "var(--text-muted)", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid var(--border-strong)", borderTopColor: "var(--text-accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                Thinking…
              </div>
            )}
          </div>

          {error && (
            <div style={{ padding: "6px 14px", background: "var(--bg-danger)", color: "var(--text-danger)", fontSize: 12, display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
              {error}
              <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}>×</button>
            </div>
          )}

          {/* Input bar */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", background: "var(--surface-1)", display: "flex", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
            <textarea ref={inputRef} value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
              onKeyDown={handleKeyDown}
              placeholder={caseActive ? "Message the tutor…" : "Waiting for case to start…"}
              disabled={!caseActive || loading} rows={1}
              style={{
                flex: 1, padding: "8px 10px", borderRadius: "var(--radius)",
                border: "1px solid var(--border-strong)", background: "var(--surface-0)",
                color: "var(--text-primary)", fontSize: 14, lineHeight: 1.5,
                fontFamily: "var(--font-sans)", outline: "none",
                minHeight: 36, maxHeight: 120, overflowY: "auto", resize: "none",
              }}
            />
            <button onClick={sendMessage} disabled={!input.trim() || loading || !caseActive} style={{
              padding: "8px 14px", borderRadius: "var(--radius)", border: "1px solid var(--border-strong)",
              background: input.trim() && !loading && caseActive ? "var(--fill-accent)" : "var(--fill-disabled)",
              color: input.trim() && !loading && caseActive ? "var(--on-accent)" : "var(--text-disabled)",
              cursor: input.trim() && !loading && caseActive ? "pointer" : "default",
              fontSize: 13, fontWeight: 500, fontFamily: "var(--font-sans)", flexShrink: 0,
            }}>Send</button>
          </div>
        </div>

        {/* Right column: EMR */}
        <div style={{
          width: 300, flexShrink: 0, borderLeft: "1px solid var(--border)",
          background: "var(--surface-1)", overflow: "hidden",
        }}>
          <EMRPanel
            module={activeModule}
            emrData={emrData}
            hasHistoryModule={hasHistoryModule}
          />
        </div>
      </div>
    </div>
  );

  // Extract initial case context from start_case response (used in context panel)
  function extractCaseContext(data) {
    // Placeholder — populate from case data when backend sends structured fields
    // When the history module is NOT selected, pre-fill emrData with detailed summary
    if (!hasHistoryModule && data.case_data) {
      const d = data.case_data;
      setEmrData({
        hpi: d.hpi || d.history_of_present_illness || "",
        pmh: d.pmh || d.past_medical_history || "",
        surgical_history: d.surgical_history || "",
        social_history: d.social_history || "",
        family_history: d.family_history || "",
        allergies: d.allergies || "",
        medications: d.medications || "",
        vitals: d.vitals || "",
        exam: d.physical_exam || d.exam || "",
        labs: d.labs || d.laboratory_results || "",
        microbiology: d.microbiology || "",
        imaging: d.imaging || "",
      });
    }
    setCaseContext(null);
  }
}

// ─── About: Overview ─────────────────────────────────────────────────────────

function AboutOverviewPage({ onBack }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "40px 24px", fontFamily: "var(--font-sans)" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <button onClick={onBack} style={{ ...backBtn, marginBottom: 24 }}>← Back</button>
        <h1 style={pageH1}>Overview</h1>
        <p style={pageP}>
          docent.ID is an AI-powered clinical microbiology tutor built for medical students and trainees. It uses real cases, Socratic teaching, and evidence-based resources to help learners reason through infectious disease — not just recall it.
        </p>
        <p style={pageP}>
          Rather than presenting information to read, docent.ID puts you inside a case. You interview a patient, gather findings, reason through a differential diagnosis, and justify your management plan — guided throughout by questioning that never gives away the answer.
        </p>
        <p style={pageP}>
          Each session draws on real cases from the MGH ID Images library and is grounded in Mandell's Principles and Practices of Infectious Diseases. The tutor adapts to your reasoning in real time, probing gaps and reinforcing strong thinking.
        </p>
        <p style={{ ...pageP, color: "var(--text-muted)", fontStyle: "italic" }}>Full overview coming soon.</p>
      </div>
    </div>
  );
}

// ─── About: Architecture ──────────────────────────────────────────────────────

function AboutArchitecturePage({ onBack }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "40px 24px", fontFamily: "var(--font-sans)" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <button onClick={onBack} style={{ ...backBtn, marginBottom: 24 }}>← Back</button>
        <h1 style={pageH1}>Architecture</h1>
        <p style={pageP}>
          docent.ID is built on a multi-agent pipeline that coordinates a patient agent, a preceptor agent, and a RAG-backed knowledge layer. This section will describe how those components interact, how cases are generated and retrieved, and how the LLM is guided to teach rather than tell.
        </p>
        <p style={{ ...pageP, color: "var(--text-muted)", fontStyle: "italic" }}>Detailed architecture documentation coming soon.</p>
      </div>
    </div>
  );
}

// ─── About: Team ─────────────────────────────────────────────────────────────

function AboutTeamPage({ onBack }) {
  const members = [
    { name: "Team Member 1", role: "Role TBD", bio: "Bio coming soon." },
    { name: "Team Member 2", role: "Role TBD", bio: "Bio coming soon." },
    { name: "Team Member 3", role: "Role TBD", bio: "Bio coming soon." },
    { name: "Team Member 4", role: "Role TBD", bio: "Bio coming soon." },
    { name: "Team Member 5", role: "Role TBD", bio: "Bio coming soon." },
  ];
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "40px 24px", fontFamily: "var(--font-sans)" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <button onClick={onBack} style={{ ...backBtn, marginBottom: 24 }}>← Back</button>
        <h1 style={pageH1}>The team</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
          {members.map((m, i) => (
            <div key={i} style={{
              padding: "16px 20px", background: "var(--surface-1)",
              border: "1px solid var(--border)", borderRadius: 10,
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{m.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-accent)", marginBottom: 8, fontWeight: 500 }}>{m.role}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{m.bio}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Case Library ─────────────────────────────────────────────────────────────

const CASE_TABS = ["History", "Exam / Studies", "Diagnosis", "More Info", "Single Page"];

// Render text with figure references replaced by collapsible images
function CaseText({ text, figures, caseId }) {
  if (!text) return null;

  // Split on figure references like "Figure 1." or "Figure 1,"
  const parts = text.split(/(Figure \d+\.?[^.]*?\.)/).filter(Boolean);

  return (
    <>
      {parts.map((part, i) => {
        const figMatch = part.match(/Figure (\d+)\.(.*)/);
        if (figMatch) {
          const figNum = parseInt(figMatch[1]);
          const caption = figMatch[2].trim();
          const filename = `figure${figNum}.jpg`;
          if (figures && figures.includes(filename)) {
            return (
              <CollapsibleImage
                key={i}
                title={`Figure ${figNum}${caption ? ` — ${caption}` : ""}`}
                src={`/case-images/${caseId}/${filename}`}
              />
            );
          }
        }
        // Regular text — split into paragraphs
        return part.split("\n\n").filter(p => p.trim()).map((p, j) => (
          <p key={`${i}-${j}`} style={caseBodyP}>{p.trim()}</p>
        ));
      })}
    </>
  );
}

function CaseDetailPage({ caseId, onBack }) {
  const [activeTab, setActiveTab] = useState("History");
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadAllCases()
      .then(all => {
        const found = all.find(c => c.id === caseId);
        if (!found) throw new Error("Case not found");
        setCaseData(found);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [caseId]);

  if (loading) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--text-muted)" }}>
        <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid var(--border-strong)", borderTopColor: "var(--text-accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        Loading case…
      </div>
    </div>
  );

  if (error || !caseData) return (
    <div style={{ flex: 1, padding: 40, fontFamily: "var(--font-sans)" }}>
      <button onClick={onBack} style={{ ...backBtn, marginBottom: 20 }}>← Back to library</button>
      <div style={{ color: "var(--text-danger)" }}>Could not load case: {error}</div>
    </div>
  );

  const figures = caseData.figures || [];

  const renderContent = () => {
    if (activeTab === "Diagnosis") {
      return (
        <>
          <CaseText text={caseData.diagnosis} figures={figures} caseId={caseId} />
        </>
      );
    }
    if (activeTab === "Single Page") {
      return (
        <>
          {[
            { label: "History", text: caseData.history },
            { label: "Exam & Studies", text: caseData.exam_studies },
            { label: "Diagnosis & Discussion", text: caseData.diagnosis },
            { label: "More Information", text: caseData.more_info },
          ].filter(s => s.text).map(sec => (
            <div key={sec.label} style={{ marginBottom: 28 }}>
              <h3 style={caseH3}>{sec.label}</h3>
              <CaseText text={sec.text} figures={figures} caseId={caseId} />
            </div>
          ))}
        </>
      );
    }
    const textMap = {
      "History": caseData.history,
      "Exam / Studies": caseData.exam_studies,
      "More Info": caseData.more_info,
    };
    return <CaseText text={textMap[activeTab] || ""} figures={figures} caseId={caseId} />;
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--surface-0)", fontFamily: "var(--font-sans)" }}>
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "24px 24px 60px" }}>

        <button onClick={onBack} style={{ ...backBtn, marginBottom: 20 }}>← Back to library</button>

        {/* Title row — thumbnail + heading */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 18, marginBottom: 24 }}>
          {figures.length > 0 ? (
            <img
              src={`/case-images/${caseId}/figure1.jpg`}
              alt="Case figure"
              style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, flexShrink: 0, border: "1px solid var(--border)" }}
              onError={e => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <div style={{
              width: 72, height: 72, flexShrink: 0, borderRadius: 6,
              background: "var(--surface-1)", border: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
            }}>🦠</div>
          )}
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{caseId}</div>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: "var(--text-primary)", margin: 0, lineHeight: 1.3, letterSpacing: "-0.02em" }}>
              {caseData.title}
            </h1>
          </div>
        </div>

        {/* Tab bar + content + sidebar */}
        <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "2px solid var(--border)", marginBottom: 24, overflowX: "auto" }}>
              {CASE_TABS.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: "9px 18px",
                  border: "1px solid var(--border)",
                  borderBottom: tab === activeTab ? "2px solid var(--surface-0)" : "1px solid var(--border)",
                  marginBottom: tab === activeTab ? "-2px" : 0,
                  background: tab === activeTab ? "var(--surface-0)" : "var(--surface-1)",
                  color: tab === activeTab ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: tab === activeTab ? 600 : 400,
                  cursor: "pointer", fontSize: 13, fontFamily: "var(--font-sans)", whiteSpace: "nowrap",
                }}>
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 15, lineHeight: 1.75, color: "var(--text-primary)" }}>
              {renderContent()}
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ width: 220, flexShrink: 0 }}>
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--surface-1)", marginBottom: 14 }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface-0)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>About This Case</div>
              </div>
              <div style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Case ID:</span> {caseId}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Figures:</span> {figures.length}
                </div>
              </div>
            </div>

            {/* Figures panel */}
            {figures.length > 0 && (
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--surface-1)", marginBottom: 14 }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface-0)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Figures</div>
                </div>
                <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {figures.map((f, idx) => (
                    <CollapsibleImage key={f} title={`Figure ${idx + 1}`} src={`/case-images/${caseId}/${f}`} />
                  ))}
                </div>
              </div>
            )}

            <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--surface-1)" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface-0)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Tools</div>
              </div>
              <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                {["Single Page View", "Print Case"].map(tool => (
                  <button key={tool} onClick={tool === "Single Page View" ? () => setActiveTab("Single Page") : () => window.print()}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-accent)", fontSize: 13, textAlign: "left", fontFamily: "var(--font-sans)" }}>
                    {tool}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CaseRow({ c, i, onOpen }) {
  return (
    <div
      onClick={onOpen}
      style={{
        display: "grid", gridTemplateColumns: "100px 1fr 90px",
        padding: "11px 14px", borderTop: i > 0 ? "1px solid var(--border)" : "none",
        background: i % 2 === 0 ? "var(--surface-1)" : "var(--surface-0)",
        alignItems: "center", gap: 12, cursor: "pointer",
        transition: "background 0.1s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--bg-accent)"}
      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "var(--surface-1)" : "var(--surface-0)"}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-accent)", fontFamily: "monospace" }}>{c.id}</div>
      <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.4 }}>{c.title}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.figures?.length || 0} figure{c.figures?.length !== 1 ? "s" : ""}</div>
    </div>
  );
}

// Shared case data cache — loaded once, used by both list and detail views
let _caseCachePromise = null;
function loadAllCases() {
  if (!_caseCachePromise) {
    _caseCachePromise = fetch("/case_library.json")
      .then(r => { if (!r.ok) throw new Error("static"); return r.json(); })
      .catch(() =>
        fetch("/api/v1/cases?limit=600")
          .then(r => r.json())
          .then(d => d.cases || [])
      );
  }
  return _caseCachePromise;
}

function CaseLibraryPage({ onBack, onOpenCase }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    loadAllCases().then(data => { setCases(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = debouncedSearch
    ? cases.filter(c => {
        const q = debouncedSearch.toLowerCase();
        return c.title?.toLowerCase().includes(q)
          || c.history?.toLowerCase().includes(q)
          || c.diagnosis?.toLowerCase().includes(q);
      })
    : cases;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "var(--font-sans)" }}>
      {/* Sticky header — back button, title, search */}
      <div style={{
        padding: "20px 24px 12px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-0)",
        flexShrink: 0,
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <button onClick={onBack} style={{ ...backBtn, marginBottom: 14 }}>← Back</button>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h1 style={{ ...pageH1, margin: 0 }}>Case library</h1>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {loading ? "Loading…" : `${filtered.length} of ${cases.length} cases`}
            </span>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, history, or diagnosis…"
            style={{
              width: "100%", padding: "9px 14px", borderRadius: "var(--radius)",
              border: "1px solid var(--border-strong)", background: "var(--surface-1)",
              color: "var(--text-primary)", fontSize: 14, fontFamily: "var(--font-sans)", outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Scrollable table area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 40px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            {/* Sticky column headers */}
            <div style={{
              display: "grid", gridTemplateColumns: "100px 1fr 90px",
              padding: "9px 14px", background: "var(--surface-0)",
              borderBottom: "1px solid var(--border)", gap: 12,
              position: "sticky", top: 0, zIndex: 2,
            }}>
              {["Case ID", "Title", "Figures"].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
              ))}
            </div>

            {loading ? (
              <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid var(--border-strong)", borderTopColor: "var(--text-accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                Loading cases…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "24px 14px", fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>No cases match your search.</div>
            ) : (
              filtered.map((c, i) => (
                <CaseRow key={c.id} c={c} i={i} onOpen={() => onOpenCase(c.id)} />
              ))
            )}
          </div>

          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12, lineHeight: 1.5 }}>
            {cases.length} cases from the MGH ID Images library. Click any row to open the full case.
            {filtered.length < cases.length && ` Showing ${filtered.length} matching results.`}
          </p>
        </div>
      </div>
    </div>
  );
}
const caseH3 = { fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px", fontFamily: "var(--font-sans)" };
const caseBodyP = { fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.75, margin: "0 0 14px", fontFamily: "var(--font-sans)" };
const pageH1 = { fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px", letterSpacing: "-0.02em" };
const pageP = { fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.75, margin: "0 0 14px" };
const backBtn = {
  padding: "5px 12px", borderRadius: "var(--radius)",
  border: "1px solid var(--border-strong)", background: "transparent",
  color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "var(--font-sans)",
};

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function DocentID() {
  const [dark, setDark] = useDarkMode();
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState("login");
  const [caseOrganism, setCaseOrganism] = useState(null);
  const [caseModules, setCaseModules] = useState([]);
  const [modal, setModal] = useState(null);

  const [caseIsRandom, setCaseIsRandom] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const handleLogin = (username) => { setUser(username); setScreen("setup"); };
  const handleLogout = () => { setUser(null); setScreen("login"); setCaseOrganism(null); setCaseModules([]); setCaseIsRandom(false); setModal(null); };
  const handleStartCase = (organism, modules, isRandom) => { setCaseOrganism(organism); setCaseModules(modules); setCaseIsRandom(!!isRandom); setScreen("chat"); };
  const handleEndCase = () => { setCaseOrganism(null); setCaseModules([]); setCaseIsRandom(false); setScreen("setup"); };

  const navigate = (dest) => { setScreen(dest); setModal(null); };
  const openCase = (id) => { setSelectedCase(id); setScreen("case_detail"); };

  if (screen === "login") {
    return (
      <>
        <style>{globalStyles}</style>
        <LoginPage onLogin={handleLogin} dark={dark} onToggleDark={() => setDark(d => !d)} />
      </>
    );
  }

  const pageScreens = ["about_overview", "about_architecture", "about_team", "case_library"];
  const isPageScreen = pageScreens.includes(screen);

  return (
    <>
      <style>{globalStyles}</style>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--surface-0)", overflow: "hidden" }}>
        <AppHeader
          user={user}
          onLogout={handleLogout}
          dark={dark}
          onToggleDark={() => setDark(d => !d)}
          onNavigate={navigate}
          onShowHowItWorks={() => setModal("howitworks")}
          onShowHistory={() => setModal("history")}
          onShowProfile={() => setModal("profile")}
        />

        {screen === "setup" && <SetupScreen onStart={handleStartCase} />}
        {screen === "chat" && caseOrganism && <ChatScreen organism={caseOrganism} modules={caseModules} isRandom={caseIsRandom} onEndCase={handleEndCase} />}
        {screen === "about_overview" && <AboutOverviewPage onBack={() => navigate("setup")} />}
        {screen === "about_architecture" && <AboutArchitecturePage onBack={() => navigate("setup")} />}
        {screen === "about_team" && <AboutTeamPage onBack={() => navigate("setup")} />}
        {screen === "case_library" && <CaseLibraryPage onBack={() => navigate("setup")} onOpenCase={openCase} />}
        {screen === "case_detail" && selectedCase && <CaseDetailPage caseId={selectedCase} onBack={() => navigate("case_library")} />}

        {modal === "howitworks" && (
          <Modal title="How it works" onClose={() => setModal(null)}>
            {HOW_IT_WORKS_CONTENT.map((para, i) => (
              <p key={i} style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, margin: i === 0 ? 0 : "12px 0 0", fontFamily: "var(--font-sans)" }}>{para}</p>
            ))}
          </Modal>
        )}

        {modal === "history" && (
          <Modal title="My history" onClose={() => setModal(null)}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, margin: 0, fontFamily: "var(--font-sans)" }}>
              Your past case sessions will appear here once session tracking is connected to the backend.
            </p>
          </Modal>
        )}

        {modal === "profile" && (
          <Modal title="User profile" onClose={() => setModal(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: "var(--font-sans)" }}>
              <div style={{ padding: "12px 16px", background: "var(--surface-0)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>Username</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>{user}</div>
              </div>
              <div style={{ padding: "12px 16px", background: "var(--surface-0)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>Role</div>
                <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Administrator</div>
              </div>
              <button onClick={handleLogout} style={{ padding: "9px", background: "var(--bg-danger)", color: "var(--text-danger)", border: "1px solid var(--border-danger)", borderRadius: "var(--radius)", cursor: "pointer", fontSize: 14, fontFamily: "var(--font-sans)" }}>
                Sign out
              </button>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
}

// ─── Global styles ────────────────────────────────────────────────────────────

const globalStyles = `
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes spin { to { transform: rotate(360deg); } }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
  textarea { resize: none; font-family: inherit; }
  input, select, button { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }
`;

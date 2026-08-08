import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Trash2, Pencil, Check, Search, Download, BarChart2, List } from 'lucide-react';

// ---------------------------------------------------------------------------
// Storage adapter
// Uses window.storage when available (Claude.ai artifacts sandbox), and
// transparently falls back to localStorage for any other environment
// (plain browser, standalone React app, etc.) so this component works
// as a normal, portable piece of code outside that sandbox too.
// ---------------------------------------------------------------------------
const storage = {
  async get(key) {
    if (typeof window !== 'undefined' && window.storage) {
      try {
        const result = await window.storage.get(key, false);
        return result ? result.value : null;
      } catch {
        return null;
      }
    }
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  async set(key, value) {
    if (typeof window !== 'undefined' && window.storage) {
      try {
        await window.storage.set(key, value, false);
        return true;
      } catch {
        return false;
      }
    }
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
};

const BG = '#14171C';
const PANEL = '#1B1F27';
const BORDER = '#2A2F3A';
const PRIMARY = '#E8EAED';
const SECONDARY = '#8B93A3';
const ACCENT = '#E8A33D';

const STATUTS = {
  attente: { label: 'En attente', color: '#5B9DD9', bg: 'rgba(91,157,217,0.12)' },
  vivier: { label: 'Vivier / pause', color: '#E8A33D', bg: 'rgba(232,163,61,0.12)' },
  refuse: { label: 'Refusé', color: '#D9614F', bg: 'rgba(217,97,79,0.12)' },
  sans_suite: { label: 'Sans suite', color: '#8B93A3', bg: 'rgba(139,147,163,0.12)' },
};

const CANAUX = {
  directe: 'Candidature directe',
  reseau: 'LinkedIn / réseau',
  entrante: 'Sollicitation entrante',
  autre: 'Autre',
};

const FILTERS = [
  { key: 'toutes', label: 'Toutes' },
  { key: 'attente', label: 'En attente' },
  { key: 'vivier', label: 'Vivier' },
  { key: 'refuse', label: 'Refusé' },
  { key: 'sans_suite', label: 'Sans suite' },
];

const EMPTY_FORM = { entreprise: '', poste: '', lieu: '', statut: 'attente', canal: 'directe', date: '', contact: '', note: '', action: '' };

// Demo data only — no real personal or company data ships in this repo.
const SEED = [
  { id: 'demo-1', entreprise: 'Entreprise Exemple SA', poste: 'Testeur QA Junior', lieu: 'Paris', statut: 'attente', canal: 'directe', date: '2026-07-20', contact: '', note: 'Candidature envoyée avec CV et lettre adaptés.', action: 'Relancer si toujours sans nouvelle après 2 semaines.', historique: [] },
  { id: 'demo-2', entreprise: 'Société Démo', poste: 'QA Engineer', lieu: 'Lyon', statut: 'refuse', canal: 'directe', date: '2026-07-15', contact: 'RH Démo', note: 'Entretien réalisé.', action: 'Refus reçu — autre profil retenu.', historique: [] },
  { id: 'demo-3', entreprise: 'Client Fictif', poste: 'Consultant tests', lieu: 'Remote', statut: 'vivier', canal: 'reseau', date: '2026-07-10', contact: '', note: 'Process en pause côté client.', action: 'Surveiller les mails.', historique: [] },
  { id: 'demo-4', entreprise: 'Contact Réseau', poste: 'Avis CV', lieu: '', statut: 'sans_suite', canal: 'entrante', date: '', contact: '', note: 'Sollicitation ancienne, restée sans réponse.', action: '', historique: [] },
];

function joursDepuis(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const diff = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function exportCSV(candidatures) {
  const headers = ['Entreprise', 'Poste', 'Lieu', 'Statut', 'Canal', 'Dernière action', 'Contact', 'Note', 'Prochaine action'];
  const rows = candidatures.map((c) => [
    c.entreprise, c.poste, c.lieu,
    STATUTS[c.statut] ? STATUTS[c.statut].label : c.statut,
    CANAUX[c.canal] ? CANAUX[c.canal] : (c.canal || ''),
    formatDate(c.date), c.contact, c.note, c.action,
  ]);
  const escape = (cell) => `"${String(cell == null ? '' : cell).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'candidatures.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Turns a visible label into a stable id ("Entreprise *" -> "field-entreprise").
// Used to tie every <label> to its control: better accessibility, and stable
// selectors for the automated tests (get_by_label) instead of brittle CSS paths.
function fieldId(label) {
  return 'field-' + label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function FieldInput({ label, value, onChange, type = 'text' }) {
  const id = fieldId(label);
  return (
    <div>
      <label htmlFor={id} className="text-xs font-mono uppercase tracking-wide" style={{ color: SECONDARY }}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 rounded px-2.5 py-2 text-sm"
        style={{ backgroundColor: BG, color: PRIMARY, border: `1px solid ${BORDER}` }}
      />
    </div>
  );
}

function FieldTextarea({ label, value, onChange }) {
  const id = fieldId(label);
  return (
    <div>
      <label htmlFor={id} className="text-xs font-mono uppercase tracking-wide" style={{ color: SECONDARY }}>{label}</label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full mt-1 rounded px-2.5 py-2 text-sm resize-none"
        style={{ backgroundColor: BG, color: PRIMARY, border: `1px solid ${BORDER}` }}
      />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options }) {
  const id = fieldId(label);
  return (
    <div>
      <label htmlFor={id} className="text-xs font-mono uppercase tracking-wide" style={{ color: SECONDARY }}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 rounded px-2.5 py-2 text-sm font-mono"
        style={{ backgroundColor: BG, color: PRIMARY, border: `1px solid ${BORDER}` }}
      >
        {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{typeof v === 'string' ? v : v.label}</option>)}
      </select>
    </div>
  );
}

function Card({ c, isEditing, onToggleEdit, onUpdateStatut, onSaveEdit, onDelete }) {
  const [draft, setDraft] = useState(c);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isEditing) { setDraft(c); setConfirmDelete(false); }
  }, [isEditing, c]);

  const statutInfo = STATUTS[c.statut] || STATUTS.attente;
  const jours = c.statut === 'attente' ? joursDepuis(c.date) : null;
  const historique = c.historique || [];

  if (isEditing) {
    return (
      <div data-testid="candidature-edit" className="rounded-lg p-4 mb-3" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
        <div className="space-y-2.5">
          <FieldInput label="Entreprise" value={draft.entreprise} onChange={(v) => setDraft({ ...draft, entreprise: v })} />
          <FieldInput label="Poste" value={draft.poste} onChange={(v) => setDraft({ ...draft, poste: v })} />
          <FieldInput label="Lieu" value={draft.lieu} onChange={(v) => setDraft({ ...draft, lieu: v })} />
          <FieldInput label="Contact" value={draft.contact} onChange={(v) => setDraft({ ...draft, contact: v })} />
          <FieldInput label="Date" type="date" value={draft.date} onChange={(v) => setDraft({ ...draft, date: v })} />
          <FieldSelect label="Statut" value={draft.statut} onChange={(v) => setDraft({ ...draft, statut: v })} options={STATUTS} />
          <FieldSelect label="Canal" value={draft.canal || 'autre'} onChange={(v) => setDraft({ ...draft, canal: v })} options={CANAUX} />
          <FieldTextarea label="Note" value={draft.note} onChange={(v) => setDraft({ ...draft, note: v })} />
          <FieldTextarea label="Prochaine action" value={draft.action} onChange={(v) => setDraft({ ...draft, action: v })} />
        </div>
        {historique.length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <p className="text-xs font-mono uppercase tracking-wide mb-1" style={{ color: SECONDARY }}>Historique</p>
            {historique.map((h, i) => (
              <p key={i} className="text-xs font-mono" style={{ color: SECONDARY }}>
                {formatDate(h.date)} → {STATUTS[h.statut] ? STATUTS[h.statut].label : h.statut}
              </p>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-3">
          <button onClick={() => onSaveEdit(c.id, draft)} className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ backgroundColor: ACCENT, color: BG }}>
            Enregistrer
          </button>
          <button onClick={() => onToggleEdit(null)} className="px-4 rounded-lg py-2 text-sm" style={{ color: SECONDARY, border: `1px solid ${BORDER}` }}>
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="candidature-card" className="rounded-lg mb-3 overflow-hidden" style={{ backgroundColor: PANEL, borderTop: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, borderLeft: `3px solid ${statutInfo.color}` }}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="font-mono text-xs tracking-wide px-1.5 py-0.5 rounded" style={{ color: statutInfo.color, backgroundColor: statutInfo.bg }}>
                {statutInfo.label.toUpperCase()}
              </span>
              {jours !== null && (
                <span className="text-xs font-mono" style={{ color: SECONDARY }}>{jours} j</span>
              )}
              {c.canal && (
                <span className="text-xs font-mono" style={{ color: SECONDARY, opacity: 0.7 }}>· {CANAUX[c.canal] || c.canal}</span>
              )}
            </div>
            <h3 className="font-semibold text-base" style={{ color: PRIMARY }}>{c.entreprise}</h3>
            {c.poste && <p className="text-sm mt-0.5" style={{ color: SECONDARY }}>{c.poste}{c.lieu ? ` · ${c.lieu}` : ''}</p>}
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => onToggleEdit(c.id)} className="p-1.5 rounded" style={{ color: SECONDARY }} aria-label="Modifier">
              <Pencil size={14} />
            </button>
            <button
              onClick={() => confirmDelete ? onDelete(c.id) : setConfirmDelete(true)}
              className="p-1.5 rounded"
              style={{ color: confirmDelete ? '#D9614F' : SECONDARY }}
              aria-label="Supprimer"
            >
              {confirmDelete ? <Check size={14} /> : <Trash2 size={14} />}
            </button>
          </div>
        </div>

        {c.contact && <p className="text-xs mt-2" style={{ color: SECONDARY }}>Contact : {c.contact}</p>}
        {c.note && <p className="text-sm mt-2 leading-relaxed" style={{ color: PRIMARY, opacity: 0.85 }}>{c.note}</p>}
        {c.action && (
          <p className="text-sm mt-2 pl-2" style={{ color: ACCENT, borderLeft: `2px solid ${ACCENT}` }}>
            → {c.action}
          </p>
        )}
        {c.date && (
          <p className="text-xs mt-2 font-mono" style={{ color: SECONDARY, opacity: 0.7 }}>
            Dernière action : {formatDate(c.date)}
          </p>
        )}

        <select
          data-testid="card-statut"
          aria-label="Changer le statut"
          value={c.statut}
          onChange={(e) => onUpdateStatut(c.id, e.target.value)}
          className="mt-3 text-xs font-mono rounded px-2 py-1.5"
          style={{ backgroundColor: BG, color: PRIMARY, border: `1px solid ${BORDER}` }}
        >
          {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
    </div>
  );
}

function Bar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span style={{ color: PRIMARY }}>{label}</span>
        <span className="font-mono" style={{ color: SECONDARY }}>{count} · {pct}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: BORDER }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function StatsView({ candidatures }) {
  const total = candidatures.length;
  const parStatut = useMemo(() => {
    const c = {};
    candidatures.forEach((x) => { c[x.statut] = (c[x.statut] || 0) + 1; });
    return c;
  }, [candidatures]);
  const parCanal = useMemo(() => {
    const c = {};
    candidatures.forEach((x) => { const k = x.canal || 'autre'; c[k] = (c[k] || 0) + 1; });
    return c;
  }, [candidatures]);
  const aEuReponse = (parStatut.refuse || 0) + (parStatut.vivier || 0);
  const tauxReponse = total > 0 ? Math.round((aEuReponse / total) * 100) : 0;

  if (total === 0) {
    return <p className="text-sm text-center py-12" style={{ color: SECONDARY }}>Pas encore de données à analyser.</p>;
  }

  return (
    <div className="pb-4">
      <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
        <p className="text-xs font-mono uppercase tracking-wide mb-1" style={{ color: SECONDARY }}>Taux de réponse</p>
        <p className="text-2xl font-semibold" style={{ color: ACCENT }}>{tauxReponse}%</p>
        <p className="text-xs mt-1" style={{ color: SECONDARY }}>{aEuReponse} / {total} candidatures ont obtenu une réponse (refus ou mise en vivier)</p>
      </div>

      <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
        <p className="text-xs font-mono uppercase tracking-wide mb-3" style={{ color: SECONDARY }}>Par statut</p>
        {Object.entries(STATUTS).map(([k, v]) => (
          <Bar key={k} label={v.label} count={parStatut[k] || 0} total={total} color={v.color} />
        ))}
      </div>

      <div className="rounded-lg p-4" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
        <p className="text-xs font-mono uppercase tracking-wide mb-3" style={{ color: SECONDARY }}>Par canal</p>
        {Object.entries(CANAUX).map(([k, label]) => (
          parCanal[k] ? <Bar key={k} label={label} count={parCanal[k] || 0} total={total} color={ACCENT} /> : null
        ))}
      </div>
    </div>
  );
}

export default function CandidatureTracker() {
  const [candidatures, setCandidatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('toutes');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('liste');
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const raw = await storage.get('candidatures');
      if (cancelled) return;
      if (raw) {
        try {
          setCandidatures(JSON.parse(raw));
        } catch {
          setCandidatures(SEED);
        }
      } else {
        setCandidatures(SEED);
        storage.set('candidatures', JSON.stringify(SEED));
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function persist(updated) {
    setCandidatures(updated);
    const ok = await storage.set('candidatures', JSON.stringify(updated));
    setSaveError(!ok);
  }

  function handleUpdateStatut(id, statut) {
    const today = todayStr();
    persist(candidatures.map((c) => {
      if (c.id !== id || c.statut === statut) return c;
      const historique = [...(c.historique || []), { date: today, statut }];
      return { ...c, statut, historique };
    }));
  }
  function handleSaveEdit(id, draft) {
    const prev = candidatures.find((c) => c.id === id);
    let historique = draft.historique || [];
    if (prev && prev.statut !== draft.statut) {
      historique = [...historique, { date: todayStr(), statut: draft.statut }];
    }
    persist(candidatures.map((c) => (c.id === id ? { ...draft, historique } : c)));
    setEditingId(null);
  }
  function handleDelete(id) {
    persist(candidatures.filter((c) => c.id !== id));
  }
  function handleAdd() {
    if (!form.entreprise.trim()) return;
    const entry = { ...form, id: 'c' + Date.now(), historique: [{ date: todayStr(), statut: form.statut }] };
    persist([entry, ...candidatures]);
    setForm(EMPTY_FORM);
    setShowAddForm(false);
  }

  const counts = useMemo(() => {
    const c = { attente: 0, vivier: 0, refuse: 0, sans_suite: 0 };
    candidatures.forEach((x) => { c[x.statut] = (c[x.statut] || 0) + 1; });
    return c;
  }, [candidatures]);

  const filtered = useMemo(() => {
    let list = filter === 'toutes' ? candidatures : candidatures.filter((c) => c.statut === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        (c.entreprise || '').toLowerCase().includes(q) ||
        (c.poste || '').toLowerCase().includes(q) ||
        (c.note || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [candidatures, filter, search]);

  if (loading) {
    return (
      <div style={{ backgroundColor: BG, minHeight: '100vh' }} className="flex items-center justify-center">
        <p className="font-mono text-sm" style={{ color: SECONDARY }}>Chargement…</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: BG, minHeight: '100vh' }} className="pb-24">
      <header className="sticky top-0 z-10 px-4 pt-5 pb-3" style={{ backgroundColor: BG, borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between">
          <h1 className="font-mono text-sm tracking-widest" style={{ color: ACCENT }}>SUIVI_CANDIDATURES.LOG</h1>
          <div className="flex gap-1">
            <button onClick={() => setView('liste')} className="p-1.5 rounded" style={{ color: view === 'liste' ? ACCENT : SECONDARY, backgroundColor: view === 'liste' ? 'rgba(232,163,61,0.12)' : 'transparent' }} aria-label="Liste">
              <List size={16} />
            </button>
            <button onClick={() => setView('stats')} className="p-1.5 rounded" style={{ color: view === 'stats' ? ACCENT : SECONDARY, backgroundColor: view === 'stats' ? 'rgba(232,163,61,0.12)' : 'transparent' }} aria-label="Statistiques">
              <BarChart2 size={16} />
            </button>
            <button onClick={() => exportCSV(candidatures)} className="p-1.5 rounded" style={{ color: SECONDARY }} aria-label="Exporter en CSV">
              <Download size={16} />
            </button>
          </div>
        </div>
        <p data-testid="compteur" className="font-mono text-xs mt-1" style={{ color: SECONDARY }}>
          {candidatures.length} pistes · {counts.attente} attente · {counts.vivier} pause · {counts.refuse} refus · {counts.sans_suite} sans suite
        </p>
        {saveError && (
          <p className="text-xs mt-1" style={{ color: '#D9614F' }}>Sauvegarde impossible — vérifie ta connexion.</p>
        )}

        {view === 'liste' && (
          <>
            <div className="relative mt-3">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: SECONDARY }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher (entreprise, poste, note)"
                className="w-full pl-8 pr-2.5 py-1.5 rounded text-sm"
                style={{ backgroundColor: PANEL, color: PRIMARY, border: `1px solid ${BORDER}` }}
              />
            </div>
            <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="text-xs font-mono px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={filter === f.key
                    ? { backgroundColor: ACCENT, color: BG, border: `1px solid ${ACCENT}` }
                    : { backgroundColor: 'transparent', color: SECONDARY, border: `1px solid ${BORDER}` }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </>
        )}
      </header>

      <main className="px-4 pt-4 max-w-xl mx-auto">
        {view === 'stats' ? (
          <StatsView candidatures={candidatures} />
        ) : (
          <>
            {filtered.length === 0 && (
              <p className="text-sm text-center py-12" style={{ color: SECONDARY }}>Aucune piste ne correspond.</p>
            )}
            {filtered.map((c) => (
              <Card
                key={c.id}
                c={c}
                isEditing={editingId === c.id}
                onToggleEdit={setEditingId}
                onUpdateStatut={handleUpdateStatut}
                onSaveEdit={handleSaveEdit}
                onDelete={handleDelete}
              />
            ))}
          </>
        )}
      </main>

      <button
        onClick={() => setShowAddForm(true)}
        className="fixed bottom-5 right-5 rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-20"
        style={{ backgroundColor: ACCENT, color: BG }}
        aria-label="Ajouter une candidature"
      >
        <Plus size={24} />
      </button>

      {showAddForm && (
        <div className="fixed inset-0 z-30 flex items-end">
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setShowAddForm(false)} />
          <div
            data-testid="add-form"
            className="relative w-full rounded-t-2xl p-4 overflow-y-auto"
            style={{ backgroundColor: PANEL, borderTop: `1px solid ${BORDER}`, maxHeight: '85vh' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-sm tracking-wide" style={{ color: PRIMARY }}>NOUVELLE PISTE</h2>
              <button onClick={() => setShowAddForm(false)} aria-label="Fermer">
                <X size={18} style={{ color: SECONDARY }} />
              </button>
            </div>
            <div className="space-y-2.5">
              <FieldInput label="Entreprise *" value={form.entreprise} onChange={(v) => setForm({ ...form, entreprise: v })} />
              <FieldInput label="Poste" value={form.poste} onChange={(v) => setForm({ ...form, poste: v })} />
              <FieldInput label="Lieu" value={form.lieu} onChange={(v) => setForm({ ...form, lieu: v })} />
              <FieldInput label="Contact" value={form.contact} onChange={(v) => setForm({ ...form, contact: v })} />
              <FieldInput label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
              <FieldSelect label="Statut" value={form.statut} onChange={(v) => setForm({ ...form, statut: v })} options={STATUTS} />
              <FieldSelect label="Canal" value={form.canal} onChange={(v) => setForm({ ...form, canal: v })} options={CANAUX} />
              <FieldTextarea label="Note" value={form.note} onChange={(v) => setForm({ ...form, note: v })} />
              <FieldTextarea label="Prochaine action" value={form.action} onChange={(v) => setForm({ ...form, action: v })} />
            </div>
            <button
              onClick={handleAdd}
              disabled={!form.entreprise.trim()}
              className="w-full mt-4 rounded-lg py-2.5 font-medium text-sm disabled:opacity-40"
              style={{ backgroundColor: ACCENT, color: BG }}
            >
              Ajouter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

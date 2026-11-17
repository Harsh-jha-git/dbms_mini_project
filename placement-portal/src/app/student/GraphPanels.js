'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { Badge } from '../components';

const GraphContext = createContext(null);

export function useGraph() {
  return useContext(GraphContext);
}

export function SaveButton({ opportunityId }) {
  const ctx = useGraph();
  if (!ctx) return null;
  const { savedIds, savingId, saveOpportunity } = ctx;
  const isSaved = savedIds.has(opportunityId);
  const isSaving = savingId === opportunityId;

  if (isSaved) {
    return (
      <span className="btn-off text-xs" title="Already saved">
        Saved ✓
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => saveOpportunity(opportunityId)}
      disabled={isSaving}
      className="btn-ghost text-xs"
    >
      {isSaving ? 'Saving...' : 'Save'}
    </button>
  );
}

export default function GraphPanels({ children }) {
  // Recommendations state
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [recError, setRecError] = useState(null);

  // Saved list state
  const [saved, setSaved] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [savedError, setSavedError] = useState(null);

  // Action states
  const [savingId, setSavingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  // Inline note editing state
  const [editingId, setEditingId] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [savingNoteId, setSavingNoteId] = useState(null);
  const [noteError, setNoteError] = useState(null);

  const savedIds = new Set(saved.map((s) => s.id));

  const fetchRecommendations = async () => {
    setLoadingRecs(true);
    setRecError(null);
    try {
      const res = await fetch('/api/graph?view=recommend');
      if (!res.ok) {
        throw new Error(`Failed to load recommendations (${res.status})`);
      }
      const data = await res.json();
      setRecommendations(Array.isArray(data) ? data : []);
    } catch (err) {
      setRecError(err.message);
    } finally {
      setLoadingRecs(false);
    }
  };

  const fetchSaved = async () => {
    setLoadingSaved(true);
    setSavedError(null);
    try {
      const res = await fetch('/api/graph?view=saved');
      if (!res.ok) {
        throw new Error(`Failed to load saved items (${res.status})`);
      }
      const data = await res.json();
      setSaved(Array.isArray(data) ? data : []);
    } catch (err) {
      setSavedError(err.message);
    } finally {
      setLoadingSaved(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
    fetchSaved();
  }, []);

  const saveOpportunity = async (opportunityId) => {
    setSavingId(opportunityId);
    setActionError(null);
    try {
      const res = await fetch('/api/graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to save opportunity (${res.status})`);
      }
      await fetchSaved();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const removeSaved = async (opportunityId) => {
    setRemovingId(opportunityId);
    setActionError(null);
    try {
      const res = await fetch(`/api/graph?opportunityId=${opportunityId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to remove opportunity (${res.status})`);
      }
      setSaved((prev) => prev.filter((item) => item.id !== opportunityId));
      if (editingId === opportunityId) {
        setEditingId(null);
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      setRemovingId(null);
    }
  };

  const startEditingNote = (item) => {
    setEditingId(item.id);
    setNoteText(item.note || '');
    setNoteError(null);
  };

  const cancelEditingNote = () => {
    setEditingId(null);
    setNoteText('');
    setNoteError(null);
  };

  const saveNote = async (opportunityId) => {
    setSavingNoteId(opportunityId);
    setNoteError(null);
    try {
      const res = await fetch('/api/graph', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId, note: noteText }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to update note (${res.status})`);
      }
      setSaved((prev) =>
        prev.map((item) => (item.id === opportunityId ? { ...item, note: noteText } : item))
      );
      setEditingId(null);
      setNoteText('');
    } catch (err) {
      setNoteError(err.message);
    } finally {
      setSavingNoteId(null);
    }
  };

  return (
    <GraphContext.Provider value={{ saved, savedIds, savingId, saveOpportunity }}>
      {actionError && (
        <div className="mb-4 border-l-4 border-accent bg-card px-3 py-2 text-sm text-accent flex justify-between items-center">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs text-mute hover:text-ink ml-2"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recommended Panel */}
        <section className="border border-rule bg-card p-4">
          <div className="flex items-center justify-between mb-3 border-b border-rule pb-2">
            <div>
              <h2 className="text-lg">Recommended for you</h2>
              <p className="text-xs text-mute">
                Collaborative filtering based on what peers with shared interests applied to
              </p>
            </div>
            <button
              type="button"
              onClick={fetchRecommendations}
              className="text-xs text-mute hover:text-ink underline"
              title="Refresh recommendations"
            >
              Refresh
            </button>
          </div>

          {loadingRecs ? (
            <p className="py-6 text-sm text-mute">Loading recommendations...</p>
          ) : recError ? (
            <div className="py-4">
              <p className="text-sm text-accent mb-2">{recError}</p>
              <button
                type="button"
                onClick={fetchRecommendations}
                className="btn-ghost text-xs"
              >
                Retry
              </button>
            </div>
          ) : recommendations.length === 0 ? (
            <p className="py-6 text-sm text-mute">
              No peer recommendations yet. Once you apply to opportunities, tailored suggestions from your peers will appear here.
            </p>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec) => {
                const isSaved = savedIds.has(rec.id);
                const isSaving = savingId === rec.id;
                return (
                  <div
                    key={rec.id}
                    className="border border-rule bg-paper p-3 flex flex-col justify-between sm:flex-row sm:items-center gap-3"
                  >
                    <div className="space-y-1">
                      <div className="font-medium text-ink">{rec.title}</div>
                      <div className="text-xs text-mute">
                        {rec.company} · {rec.type}
                        {rec.tier && ` (${rec.tier})`}
                      </div>
                      <div className="pt-1">
                        <span className="inline-block border border-moss text-moss px-1.5 text-xs font-medium">
                          ★ {rec.shared_peers} {rec.shared_peers === 1 ? 'peer' : 'peers'} applied
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {isSaved ? (
                        <span className="btn-off text-xs">Saved ✓</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => saveOpportunity(rec.id)}
                          disabled={isSaving}
                          className="btn-ghost text-xs"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Saved List Panel */}
        <section className="border border-rule bg-card p-4">
          <div className="flex items-center justify-between mb-3 border-b border-rule pb-2">
            <div>
              <h2 className="text-lg">Saved Opportunities ({saved.length})</h2>
              <p className="text-xs text-mute">Bookmarked roles with private notes</p>
            </div>
            <button
              type="button"
              onClick={fetchSaved}
              className="text-xs text-mute hover:text-ink underline"
              title="Refresh saved items"
            >
              Refresh
            </button>
          </div>

          {loadingSaved ? (
            <p className="py-6 text-sm text-mute">Loading saved opportunities...</p>
          ) : savedError ? (
            <div className="py-4">
              <p className="text-sm text-accent mb-2">{savedError}</p>
              <button
                type="button"
                onClick={fetchSaved}
                className="btn-ghost text-xs"
              >
                Retry
              </button>
            </div>
          ) : saved.length === 0 ? (
            <p className="py-6 text-sm text-mute">
              No saved opportunities yet. Click <b>Save</b> on any opportunity card to keep track of it here.
            </p>
          ) : (
            <div className="space-y-3">
              {saved.map((item) => {
                const isEditing = editingId === item.id;
                const isSavingNote = savingNoteId === item.id;
                const isRemoving = removingId === item.id;
                return (
                  <div key={item.id} className="border border-rule bg-paper p-3 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-medium text-ink">{item.title}</div>
                        <div className="text-xs text-mute">
                          {item.company} · {item.type}
                          {item.tier && ` (${item.tier})`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge>{item.open ? 'Open' : 'Closed'}</Badge>
                        <button
                          type="button"
                          onClick={() => removeSaved(item.id)}
                          disabled={isRemoving}
                          className="btn-ghost text-xs text-accent hover:border-accent ml-2"
                          title="Remove from saved"
                        >
                          {isRemoving ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </div>

                    {/* Inline Note Editor */}
                    <div className="pt-1 border-t border-rule/60">
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="relative">
                            <textarea
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value.slice(0, 200))}
                              maxLength={200}
                              rows={2}
                              className="field resize-none text-xs"
                              placeholder="Write a private note (max 200 chars)..."
                              autoFocus
                            />
                            <div className="text-[10px] text-mute text-right mt-0.5">
                              {noteText.length}/200
                            </div>
                          </div>
                          {noteError && (
                            <p className="text-xs text-accent">{noteError}</p>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => saveNote(item.id)}
                              disabled={isSavingNote}
                              className="btn text-xs py-0.5 px-2"
                            >
                              {isSavingNote ? 'Saving...' : 'Save Note'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingNote}
                              disabled={isSavingNote}
                              className="btn-ghost text-xs py-0.5 px-2"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs text-mute flex-1">
                            {item.note ? (
                              <p className="bg-card border-l-2 border-ink px-2 py-1 text-ink italic">
                                {item.note}
                              </p>
                            ) : (
                              <span className="italic">No note added</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => startEditingNote(item)}
                            className="btn-ghost text-xs py-0.5 px-2 text-mute hover:text-ink whitespace-nowrap"
                          >
                            {item.note ? 'Edit note' : '+ Add note'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {children}
    </GraphContext.Provider>
  );
}

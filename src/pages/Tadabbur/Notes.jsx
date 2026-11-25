import { useCallback, useEffect, useRef, useState } from 'react';
import { FileDown, LockKeyhole } from 'lucide-react';
import { meetingNote, meetingNoteLimit } from './meetingNotes';

const empty = Object.freeze({ text: '', tag: '' });

export function useNotes(call, enabled, draftKey, activeKey = 'private') {
  const limit = activeKey === 'meeting' ? meetingNoteLimit : 18000;
  const [notes, setNotes] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [hasPending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(new Map());
  const inflight = useRef(null);
  const timeout = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    let drafts = {};
    try {
      const raw = JSON.parse(localStorage.getItem(draftKey) || '{}');
      drafts = raw?.text !== undefined ? { private: raw } : raw || {};
      pending.current = new Map(Object.entries(drafts));
      setPending(Boolean(pending.current.size));
    } catch { /* Storage can be disabled in private browsing. */ }
    const controller = new AbortController();
    call('/notes', { signal: controller.signal }).then(items => {
      if (controller.signal.aborted) return;
      const combined = { ...Object.fromEntries(items.map(item => [item.key, item])), ...drafts };
      if (activeKey === 'meeting') combined.meeting = meetingNote(combined);
      setNotes(combined);
      setLoaded(true);
    }).catch(error => {
      if (!controller.signal.aborted) setError(error.message);
    });
    return () => controller.abort();
  }, [attempt, call, draftKey, enabled, activeKey]);

  const persist = useCallback(() => {
    try {
      if (pending.current.size) localStorage.setItem(draftKey, JSON.stringify(Object.fromEntries(pending.current)));
      else localStorage.removeItem(draftKey);
    } catch { /* Keep an in-memory draft when storage is unavailable. */ }
  }, [draftKey]);

  const save = useCallback(() => {
    if (inflight.current) return inflight.current;
    if (!pending.current.size) return Promise.resolve(true);
    const operation = (async () => {
      try {
        while (pending.current.size) {
          const [key, value] = pending.current.entries().next().value;
          await call('/notes/' + key, { method: 'PUT', body: value });
          if (pending.current.get(key) === value) pending.current.delete(key);
          persist();
        }
        setPending(false);
        setError('');
        return true;
      } catch (error) {
        setError(error.message);
        return false;
      } finally { inflight.current = null; }
    })();
    inflight.current = operation;
    return operation;
  }, [call, persist]);

  useEffect(() => {
    const online = () => { void save(); };
    const warn = event => { if (pending.current.size) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('online', online);
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('beforeunload', warn);
      clearTimeout(timeout.current);
      if (pending.current.size) void save();
    };
  }, [save]);

  function edit(next) {
    if (!loaded) return;
    if (typeof next === 'function') next = next(pending.current.get(activeKey) || notes[activeKey] || empty);
    const value = { text: next.text.slice(0, limit), tag: next.tag || '' };
    pending.current.set(activeKey, value);
    persist();
    setPending(true);
    setNotes(previous => ({ ...previous, [activeKey]: value }));
    clearTimeout(timeout.current);
    timeout.current = setTimeout(save, 700);
  }

  return {
    note: notes[activeKey] || empty, limit, notes, loaded, error, hasPending, edit, save,
    retry: () => { setError(''); setLoaded(false); setAttempt(value => value + 1); }
  };
}

export function NotePreview({ text }) {
  return <div className="td-note-preview" dir="auto">
    {text.split('\n').map((line, i) => <div key={i}>
      {line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__)/).map((part, j) => part.startsWith('**') && part.endsWith('**') && part.length > 4
        ? <strong key={j}>{part.slice(2, -2)}</strong>
        : part.startsWith('*') && part.endsWith('*') && part.length > 2
          ? <em key={j}>{part.slice(1, -1)}</em>
          : part.startsWith('__') && part.endsWith('__') && part.length > 4 ? <u key={j}>{part.slice(2, -2)}</u> : part || (line ? null : <br key={j} />))}
    </div>)}
  </div>;
}

export function printNotes(title, text) {
  const print = window.open('', '_blank', 'width=780,height=700');
  if (!print) throw new Error('Allow pop-ups for Mauiza, then try the PDF export again.');
  print.document.title = 'Mauiza Private Notes';
  const style = print.document.createElement('style');
  style.textContent = 'body{font:16px/1.6 system-ui,sans-serif;margin:2rem}h1{color:#063d32}p{white-space:pre-wrap;overflow-wrap:anywhere}@page{margin:18mm}';
  print.document.head.append(style);
  const heading = print.document.createElement('h1');
  heading.textContent = title;
  const body = print.document.createElement('p');
  for (const part of text.split(/(https?:\/\/[^\s<>]+|\*\*[^*\n]+\*\*|\*[^*\n]+\*|__[^_\n]+__)/g)) {
    if (/^https?:\/\//.test(part)) {
      const link = print.document.createElement('a');
      link.href = part;
      link.textContent = part;
      body.append(link);
    } else if (/^\*\*[^*]+\*\*$|^\*[^*]+\*$|^__[^_]+__$/.test(part)) {
      const double = part.startsWith('**') || part.startsWith('__');
      const node = print.document.createElement(part.startsWith('**') ? 'strong' : part.startsWith('__') ? 'u' : 'em');
      node.textContent = part.slice(double ? 2 : 1, double ? -2 : -1);
      body.append(node);
    } else body.append(part);
  }
  body.dir = 'auto';
  print.document.body.append(heading, body);
  print.opener = null;
  print.focus();
  print.print();
}

export function Notes({ state, title }) {
  const [preview, showPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState('');
  const editor = useRef(null);
  const note = state.note;

  function change(next) { state.edit({ ...note, ...next }); }
  function format(mark) {
    const field = editor.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    change({ text: note.text.slice(0, start) + mark + note.text.slice(start, end) + mark + note.text.slice(end) });
    requestAnimationFrame(() => { field.focus(); field.setSelectionRange(start + mark.length, end + mark.length); });
  }
  async function save() {
    setBusy(true);
    setExportError('');
    const saved = await state.save();
    if (!saved) setExportError(state.error || 'Your note could not be saved. Your draft is still available in this browser.');
    setBusy(false);
    return saved;
  }
  return <section className="td-card td-notes">
    <div className="td-headline"><h2><LockKeyhole size={19} /> My private notes</h2><small role="status">{state.hasPending ? 'Unsaved changes' : state.loaded ? 'Up to date' : 'Loading…'}</small></div>
    <p className="td-note-privacy">Only you can see these notes.</p>
    {state.error && <p role="alert" className="td-error">{state.error} <button className="td-quiet" type="button" onClick={state.retry}>Retry</button></p>}
    {state.loaded && <div className="td-form">
      <div className="td-actions">
        <button className="td-quiet" type="button" onClick={() => format('**')} disabled={preview}><strong>Bold</strong></button>
        <button className="td-quiet" type="button" onClick={() => format('*')} disabled={preview}><em>Italic</em></button>
        <button className="td-quiet" type="button" onClick={() => showPreview(!preview)} aria-pressed={preview}>{preview ? 'Edit note' : 'Preview formatting'}</button>
      </div>
      {preview ? <NotePreview text={note.text} /> : <label>Notes<textarea aria-label="Private meeting notes" dir="auto" ref={editor} maxLength="18000" value={note.text} onChange={event => change({ text: event.target.value })} rows="9" /></label>}
      <div className="td-actions">
        <button className="td-quiet" type="button" disabled={!state.hasPending || busy} onClick={() => void save()}>Save Notes</button>
        <button className="td-quiet" type="button" disabled={busy} onClick={() => {
          setBusy(true);
          setExportError('');
          try { printNotes(title, note.text); }
          catch (error) { setExportError(error.message); }
          finally { setBusy(false); }
        }}><FileDown size={16} /> Export PDF</button>
      </div>
    </div>}
    {exportError && <p role="alert" className="td-error">{exportError}</p>}
  </section>;
}

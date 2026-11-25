import { useRef, useState } from 'react';

export function usePanelAppearance(name) {
  const [appearance, set] = useState(() => {
    try { return { size: JSON.parse(localStorage.getItem('mauiza-panel-' + name))?.size || 1 }; }
    catch { return { size: 1 }; }
  });
  function update(next) {
    set(next);
    try { localStorage.setItem('mauiza-panel-' + name, JSON.stringify(next)); } catch {}
  }
  return { appearance, update };
}

export function TextControls({ panel, settings }) {
  const { appearance, update } = settings;
  return <div className="qs-actions qs-text-controls">
    <button type="button" className="qs-button" aria-label={'Decrease ' + panel + ' text size'} onClick={() => update({ ...appearance, size: Math.max(.8, appearance.size - .1) })}>A−</button>
    <button type="button" className="qs-button" aria-label={'Increase ' + panel + ' text size'} onClick={() => update({ ...appearance, size: Math.min(1.75, appearance.size + .1) })}>A+</button>
  </div>;
}

export function ResourceChooser({ title, items = [], value, choose, error, retry }) {
  const dialog = useRef(null);
  const [filter, setFilter] = useState('');
  const filtered = items.filter(item => (item.name + ' ' + item.language).toLowerCase().includes(filter.toLowerCase()));
  return <>
    <button type="button" className="qs-button qs-subtle" aria-haspopup="dialog" onClick={() => { setFilter(''); dialog.current.showModal(); }}>{title}</button>
    <dialog ref={dialog} className="qs-modal qs-resource-chooser" aria-label={title}>
      <div className="qs-line"><h2>{title}</h2><button type="button" className="qs-button" onClick={() => dialog.current.close()}>Close</button></div>
      <input type="search" aria-label={'Search ' + title.toLowerCase()} placeholder="Filter by language or source" value={filter} onChange={event => setFilter(event.target.value)} />
      {error && <p role="alert">{error} <button className="qs-link" type="button" onClick={retry}>Retry</button></p>}
      <div className="qs-resource-list">{filtered.map(item => <button type="button" className={'qs-button ' + (String(item.id) === String(value) ? 'qs-tab-selected' : '')}
        aria-pressed={String(item.id) === String(value)} key={item.id} onClick={() => { choose(String(item.id)); dialog.current.close(); }}>{item.name} · {item.language}</button>)}</div>
      {!error && !filtered.length && <p>{items.length ? 'No matching resources.' : 'No resources are available yet.'}</p>}
    </dialog>
  </>;
}

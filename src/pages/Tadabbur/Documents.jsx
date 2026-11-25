import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, FileImage, FileText, X, Upload, ZoomIn, ZoomOut } from 'lucide-react';

export function Documents({ call, records, reload, presenter, controlsRef, onDocumentReady, active, me, host, openQuran, onError }) {
  const [local, setLocal] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState('');
  const [follow, setFollow] = useState(true);
  const [ownPage, setOwnPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState({});
  const [pages, setPages] = useState(0);
  const [error, setError] = useState('');
  const uploads = useRef(new WeakMap());
  const fileInput = useRef(null);
  const canvas = useRef(null);
  const viewport = useRef(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const { width, height } = viewportSize;
  const current = (follow && presenter ? records.find(doc => doc.id === presenter.id)
    : selected === local?.id ? local : records.find(doc => doc.id === selected)) || records[0];
  const isLocal = Boolean(current?.file);
  const showLocalTab = local && (!local.serverId || selected === local.id || !records.some(record => record.id === local.serverId));
  const page = follow && presenter ? presenter.page : ownPage;
  const [deleting, setDeleting] = useState(false);
  const isPresenter = presenter?.presenter === me.id && presenter.id === current?.id;
  useEffect(() => {
    if (!active || !current || isLocal) return;
    const body = { mode: follow && presenter ? 'follow' : 'browse', document: current.id };
    const pulse = () => { void call('/study/reader', { method: 'POST', body }).catch(() => {}); };
    pulse();
    const interval = setInterval(pulse, 9000);
    return () => clearInterval(interval);
  }, [active, call, current?.id, follow, presenter?.id, isLocal]);

  useEffect(() => {
    if (!active || !current || isLocal) void call('/study/reader', { method: 'POST', body: { mode: 'leave' } }).catch(() => {});
  }, [active, call, current?.id, isLocal]);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width) setViewportSize({ width, height });
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [current?.id]);
  useEffect(() => {
    if (!current) return;
    const controller = new AbortController();
    let imageUrl, loadingTask;
    setPages(0); setLoaded({}); setError('');
    async function load() {
      try {
        const data = await (current.file ? current.file.arrayBuffer() : call('/study/documents/' + current.id, { signal: controller.signal, output: 'buffer' }));
        if (controller.signal.aborted) return;
        if (current.type === 'application/pdf') {
          const [pdf, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
          if (controller.signal.aborted) return;
          const workerUrl = new URL(worker.default, window.location.origin);
          workerUrl.searchParams.set('mauiza-worker', '2');
          pdf.GlobalWorkerOptions.workerSrc = workerUrl.href;
          loadingTask = pdf.getDocument({ data, isEvalSupported: false, useSystemFonts: true });
          const doc = await loadingTask.promise;
          if (!controller.signal.aborted) { setPages(doc.numPages); setLoaded({ id: current.id, doc }); }
        } else {
          imageUrl = URL.createObjectURL(new Blob([data], { type: current.type }));
          setPages(1); setLoaded({ id: current.id, imageUrl });
        }
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message || 'The document could not be opened.');
      }
    }
    void load();
    return () => { controller.abort(); if (loadingTask) void loadingTask.destroy().catch(() => {}); if (imageUrl) URL.revokeObjectURL(imageUrl); };
  }, [call, current?.id, current?.type, current?.file, retry]);
  useEffect(() => {
    if (!loaded.doc || loaded.id !== current?.id || !canvas.current || !width) return;
    let active = true, task;
    const target = canvas.current;
    async function render() {
      try {
        const pdfPage = await loaded.doc.getPage(Math.max(1, Math.min(page, loaded.doc.numPages)));
        if (!active) return;
        const natural = pdfPage.getViewport({ scale: 1 });
        const scale = Math.max(.18, Math.min(1.35, (width - 28) / natural.width, (height - 65) / natural.height)) * zoom;
        const dpr = Math.min(devicePixelRatio || 1, 2);
        const view = pdfPage.getViewport({ scale });
        target.width = view.width * dpr;
        target.height = view.height * dpr;
        target.style.width = view.width + 'px';
        target.style.height = view.height + 'px';
        task = pdfPage.render({ canvas: target, viewport: view, transform: dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0] });
        await task.promise;
      } catch (error) {
        if (active) setError(error.message);
      }
    }
    void render();
    return () => { active = false; task?.cancel(); };
  }, [loaded, current?.id, width, height, zoom, page]);

  function saveFile(draft) {
    const existing = uploads.current.get(draft.file);
    if (existing) return existing;
    const operation = call('/study/documents?' + new URLSearchParams({ name: draft.name }), { method: 'POST', binary: draft.file })
      .then(record => {
        setLocal(value => value?.id === draft.id ? { ...value, serverId: record.id } : value);
        void reload();
        return record.id;
      }).catch(error => {
        uploads.current.delete(draft.file);
        throw error;
      });
    uploads.current.set(draft.file, operation);
    return operation;
  }
  function openFile(file) {
    if (!file) return;
    setUploadError('');
    if (file.size > 8 * 1024 * 1024) { setUploadError('The document must be 8 MB or smaller.'); return; }
    const types = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
    const type = types[file.name.split('.').at(-1).toLowerCase()];
    if (!type) { setUploadError('Choose a PDF, PNG, JPEG or WebP file.'); return; }
    const draft = { id: 'local:' + crypto.randomUUID(), name: file.name, type, file };
    setLocal(draft);
    browse(draft.id);
    void saveFile(draft).catch(error => {
      setUploadError('Local preview is available. Saving this document to the room failed. ' + error.message);
    });
  }
  function browse(id, next = 1) {
    setFollow(false); setSelected(id); setOwnPage(next); setZoom(1);
  }
  async function present(nextPage = page, stop = false) {
    if (uploading) return;
    setUploading(true);
    setUploadError('');
    try {
      let id = current?.id;
      if (isLocal && !stop) id = local.serverId || await saveFile(local);
      await call('/study/present', { method: 'POST', body: { document: id, page: nextPage, stop } });
      if (!stop) {
        if (isLocal) { setSelected(id); await reload(); }
        setFollow(true);
      }
    } catch (error) {
      if (isLocal) setUploadError('The document is still open privately. Presenting failed. ' + error.message);
      else onError(error.message);
    } finally { setUploading(false); }
  }
  useImperativeHandle(controlsRef, () => ({ present: () => present(page), stop: () => present(page, true) }));
  const canPresent = Boolean(current && pages > 0 && loaded.id === current.id && !uploading && !error);
  useEffect(() => { onDocumentReady(canPresent); return () => onDocumentReady(false); }, [canPresent, onDocumentReady]);

  async function remove(record) {
    if (!window.confirm('Delete ' + record.name + ' from this room?')) return;
    setDeleting(true);
    setUploadError('');
    try {
      const id = record.file ? await uploads.current.get(record.file)?.catch(() => null) : record.id;
      if (id) await call('/study/documents/' + encodeURIComponent(id), { method: 'DELETE' });
      if (record.file || id === local?.serverId) setLocal(null);
      if (current?.id === record.id) browse('');
      await reload();
    } catch (error) { setUploadError(error.message); }
    finally { setDeleting(false); }
  }

  function turn(amount) {
    const next = page + amount;
    if (next < 1 || next > pages) return;
    if (isPresenter && follow) void present(next);
    else { setFollow(false); setSelected(current.id); setOwnPage(next); }
  }

  return <section className="qs-panel qs-docs"  aria-label="Documents">
    <header className="qs-toolbar">
      <div className="qs-actions"><button className="qs-button qs-subtle" type="button" onClick={openQuran}><BookOpen size={16} /> Quran</button><button className="qs-button qs-tab-selected" type="button"><FileText size={16} /> Documents <span className="qs-count">{records.length}</span></button></div>
      <div className="qs-actions qs-doc-actions">
        {presenter && <><button className={'qs-button ' + (follow ? 'qs-primary' : '')} type="button" onClick={() => setFollow(true)}>Follow {presenter.name}</button><button className={'qs-button ' + (!follow ? 'qs-tab-selected' : '')} type="button" onClick={() => browse(current?.id, page)}>Browse on my own</button></>}
        <input hidden ref={fileInput} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; openFile(file); }} />
        <button className="qs-button qs-primary" type="button" disabled={uploading} onClick={() => fileInput.current.click()}><Upload size={15} /> {uploading ? 'Working…' : 'Open my PDF or image'}</button>
      </div>
    </header>
    {(local || records.length > 0) && <div className="qs-document-tabs" aria-label="Open documents">
      {[...(showLocalTab ? [local] : []), ...records.filter(record => !showLocalTab || record.id !== local.serverId)].map(record => <div className="qs-doc-tab" key={record.id}><button className={'qs-button ' + (current?.id === record.id ? 'qs-tab-selected' : '')} key={record.id} type="button" onClick={() => browse(record.id)}>
        {record.type === 'application/pdf' ? <FileText size={16} /> : <FileImage size={16} />}
        <span><strong>{record.name}</strong><small>{presenter?.id === record.id ? presenter.name + ' · presenting' : record.shared ? record.ownerName : 'Only you until you present'}</small></span>
      </button>{(record.file || record.owner === me.id || host) && <button className="qs-icon qs-delete-document" type="button" disabled={deleting || uploading} aria-label={'Delete ' + record.name} onClick={() => void remove(record)}><X size={14} /></button>}</div>)}
    </div>}
    {error && <p className="qs-error" role="alert">{error} <button type="button" className="qs-link" onClick={() => setRetry(n => n + 1)}>Retry opening</button></p>}
    {uploadError && <p className="qs-error" role="alert">{uploadError}</p>}
    <div className="qs-document-grid">
      <section className="qs-document-view" ref={viewport}>
        {!current ? <div className="qs-empty"><FileText size={30} /><p>Open a PDF or image to read on your own or present to the room.</p></div> : loaded.id !== current.id && !error ? <p className="qs-empty" role="status">Opening {current.name}…</p> : null}
        {current && loaded.id === current.id && <div className="qs-paper">
          {loaded.imageUrl ? <img src={loaded.imageUrl} alt={current.name} style={{ width: zoom * 100 + '%' }} /> : <canvas ref={canvas} aria-label={'Page ' + page + ' of ' + current.name} />}
        </div>}
        {current && pages > 0 && <div className="qs-actions qs-document-pagination">
          <button className="qs-icon" type="button" aria-label="Previous document page" disabled={page <= 1 || Boolean(presenter && follow && !isPresenter)} onClick={() => turn(-1)}><ChevronLeft size={16} /></button>
          <small>Page {Math.min(page, pages)} of {pages}</small>
          <button className="qs-icon" type="button" aria-label="Next document page" disabled={page >= pages || Boolean(presenter && follow && !isPresenter)} onClick={() => turn(1)}><ChevronRight size={16} /></button>
          <button className="qs-icon" type="button" aria-label="Zoom out" disabled={zoom <= .6} onClick={() => setZoom(n => Math.max(.6, n - .2))}><ZoomOut size={16} /></button><button className="qs-icon" type="button" aria-label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom(n => Math.min(2, n + .2))}><ZoomIn size={16} /></button>
        </div>}
      </section>
    </div>
  </section>;
}

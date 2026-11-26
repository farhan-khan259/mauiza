import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Check, Hand, LockKeyhole, Maximize, MonitorUp, Pin, PinOff, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Documents } from './Documents';
import { PrivateNotes, Reader, Research, WebSearch, useVerse } from './Reader';
import { CallControls, MediaTrack, ParticipantTile, RoomAudio, useDeviceSettings, useRoomCall } from './Media';
import './StudyRoom.css';
import { peopleOrder } from './client';

const DeviceSettings = lazy(() => import('./DeviceSettings'));
const phases = ['Read', 'Reflect', 'Reveal', 'Discuss'];
const defaultStudy = { phase: 'Reflect', selection: { label: 'Al-Fatihah', keys: ['1:5', '1:6', '1:7'] }, index: 0, notes: [] };

function readSetting(name, fallback) {
  try { return localStorage.getItem('mauiza-study-' + name) ?? fallback; }
  catch { return fallback; }
}

function writeSetting(name, value) {
  try { localStorage.setItem('mauiza-study-' + name, value); } catch { /* Private storage may be disabled. */ }
}

function ResizeHandle({ className, label, axis, value, minimum, maximum, reverse = false, onChange }) {
  const drag = useRef(null);
  const point = event => axis === 'x' ? event.clientX : event.clientY;
  const update = next => onChange(Math.min(maximum, Math.max(minimum, Math.round(next))));
  return <div className={'qs-resize-handle ' + className} role="separator" tabIndex={0}
    aria-label={label} aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
    aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={Math.min(value, maximum)}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { point: point(event), value, size: event.currentTarget.parentElement.clientWidth };
    }}
    onPointerMove={event => {
      if (!drag.current) return;
      const offset = point(event) - drag.current.point;
      const delta = axis === 'x' ? -offset * 100 / drag.current.size : axis === 'up' ? -offset * 100 / window.innerHeight : offset * (reverse ? -1 : 1);
      update(drag.current.value + delta);
    }}
    onLostPointerCapture={() => { drag.current = null; }}
    onKeyDown={event => {
      const increase = axis === 'x' ? 'ArrowLeft' : axis === 'up' || reverse ? 'ArrowUp' : 'ArrowDown';
      const decrease = axis === 'x' ? 'ArrowRight' : axis === 'up' || reverse ? 'ArrowDown' : 'ArrowUp';
      if (![increase, decrease, 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const step = axis === 'y' ? 20 : 2;
      update(event.key === 'Home' ? minimum : event.key === 'End' ? maximum : value + (event.key === increase ? step : -step));
    }} />;
}

function SharedRecitation({ recitation, serverOffset, token, onProgress }) {
  const audio = useRef(null);
  const [blocked, setBlocked] = useState('');
  useEffect(() => {
    if (!recitation) return;
    const player = audio.current;
    let cancelled = false;
    const timer = setTimeout(() => {
      const offset = Math.max(0, (Date.now() + serverOffset.current - recitation.starts) / 1000);
      if (Number.isFinite(player.duration) && player.duration <= offset) return;
      try { player.currentTime = offset; } catch { /* Metadata may still be loading. */ }
      player.play().then(() => { if (!cancelled) setBlocked(''); }).catch(() => { if (!cancelled) setBlocked(token); });
    }, Math.max(0, recitation.starts - Date.now() - serverOffset.current));
    return () => { cancelled = true; clearTimeout(timer); player.pause(); };
  }, [recitation?.starts, serverOffset, token]);
  if (!recitation) return null;
  return <div className="qs-recitation-audio">
    <audio ref={audio} src={recitation.url} preload="auto" onTimeUpdate={event => {
      const { currentTime, duration } = event.currentTarget;
      if (Number.isFinite(duration) && duration > 0) onProgress({ token, currentTime, duration });
    }} />
    {blocked === token && <button className="qs-button" type="button" onClick={() => {
      const player = audio.current;
      try { player.currentTime = Math.max(0, (Date.now() + serverOffset.current - recitation.starts) / 1000); } catch {}
      player.play().then(() => setBlocked('')).catch(() => {});
    }}>Enable recitation audio</button>}
  </div>;
}

export default function Studio({ room, call, noteState, initialAudio, initialVideo, remaining, serverOffset, host, onHand, onLeave, onEnd, onFullscreen, fullscreen, onPeople, onInvite, onExtend, onOpenNotes, onError }) {
  const study = room.study || defaultStudy;
  const ayah = study.selection.keys[study.index];
  const [language, setLanguage] = useState('en');
  const [tab, setTab] = useState('ayah');
  const [word, setWordState] = useState(null);
  const [records, setRecords] = useState([]);
  const [recordError, setRecordError] = useState('');
  const [layout, setLayout] = useState(() => {
    let saved;
    try { saved = localStorage.getItem('mauiza-study-layout'); } catch {}
    return ['strip', 'rail', 'speaker', 'audio'].includes(saved) ? saved : 'strip';
  });
  const [settings, setSettings] = useDeviceSettings();
  const [mediaOpen, setMediaOpen] = useState(false);
  const [sideView, setSideView] = useState('notes');
  const [shareMenu, setShareMenu] = useState(false);
  const [documentReady, setDocumentReady] = useState(false);
  const documentControls = useRef(null);
  const [researchHeight, setResearchHeight] = useState(() => Number(readSetting('research-height', 65)) || 65);
  const [researchOpen, setResearchOpen] = useState(false);
  const [passageOpen, setPassageOpen] = useState(false);
  const [openShare, setOpenShare] = useState(true);
  const [pinned, setPinned] = useState('');
  const [showAyahPin, setShowAyahPin] = useState(() => readSetting('ayah-pin', 'yes') !== 'no');
  const [paneWidth, setPaneWidth] = useState(() => Number(readSetting('pane-width', 29)) || 29);
  const [researchPanelHeight, setResearchPanelHeight] = useState(() => Number(readSetting('research-panel-height', 0)) || 0);
  const [noteHeight, setNoteHeight] = useState(() => Number(readSetting('note-height', 0)) || 0);
  const [selectedShare, setSelectedShare] = useState('');
  const [shareZoom, setShareZoom] = useState(1);
  const [playback, setPlayback] = useState({});
  const shareFrame = useRef(null);
  const researchDialog = useRef(null);
  const reading = useVerse(call, ayah, language);
  const picked = word?.key === ayah && word?.language === language ? word.value : null;
  function selectWord(value) {
    setWordState({ key: ayah, language, value });
    if (window.matchMedia('(max-width: 760px)').matches) setResearchOpen(true);
  }
  const rtc = useRoomCall(call, { initialAudio, initialVideo, settings, layout });
  const share = rtc.shares.find(item => item.id === pinned) || rtc.shares.find(item => item.id === selectedShare) || rtc.shares[0];
  const showShare = Boolean(share && openShare && tab === 'ayah');
  const discussing = study.phase === 'Discuss';
  const people = [...room.members].sort(peopleOrder);
  const queue = people.filter(person => person.raised);
  const myShared = study.notes.some(note => note.owner === room.me.id && note.key === ayah);
  const activeSpeaker = rtc.connection.activeSpeakers[0]?.identity;
  const ordered = share ? [...room.members].sort((a, b) => Number(b.id === share.id) - Number(a.id === share.id)) : room.members;
  const reload = useCallback(async () => {
    try {
      const list = await call('/study/documents');
      setRecords(list); setRecordError('');
      return list;
    } catch (error) { setRecordError(error.message); return []; }
  }, [call]);

  useEffect(() => { void reload(); }, [reload, study.document?.id, room.revision]);
  useEffect(() => { if (study.document?.id) setTab('docs'); }, [study.document?.id]);
  useEffect(() => { if (study.phase === 'Discuss') setTab(current => current === 'ayah' ? 'docs' : current); }, [study.phase]);
  useEffect(() => { if (share) { setOpenShare(true); setTab('ayah'); } }, [share?.id]);
  useEffect(() => { setShareZoom(1); }, [share?.id]);
  useEffect(() => {
    if (researchOpen && !researchDialog.current.open) researchDialog.current.showModal();
    if (!researchOpen && researchDialog.current.open) researchDialog.current.close();
  }, [researchOpen]);

  function chooseLayout(nextLayout) {
    setLayout(nextLayout);
    try { localStorage.setItem('mauiza-study-layout', nextLayout); } catch {}
  }
  async function lead(action, value) {
    try {
      await call('/study/lead', { method: 'POST', body: { action, value } });
      if (action === 'phase' && value === 'Discuss') setTab('docs');
      if (action === 'passage') { setTab('ayah'); setPassageOpen(false); }
    } catch (error) { onError(error.message); }
  }
  async function reveal(hide, key = ayah) {
    try { await call('/study/reveal', { method: 'POST', body: { key, hide, text: noteState.note.text } }); }
    catch (error) { onError(error.message); }
  }
  const tiles = (members, className, audioOnly = false) => <div className={'qs-tiles ' + className}>
    {members.map(person => <ParticipantTile key={person.id} person={person} rtc={rtc} me={room.me.id} audioOnly={audioOnly} sharing={person.id === share?.id} mirror={settings.mirror} />)}
  </div>;
  const researchProps = { call, reading, word: picked };
  const privateNotes = <PrivateNotes state={noteState} title={room.title} phase={study.phase} ayah={ayah} word={picked} shared={myShared} reveal={reveal} />;
  function toggleAyahPin() {
    setShowAyahPin(!showAyahPin);
    writeSetting('ayah-pin', showAyahPin ? 'no' : 'yes');
  }
  function resize(name, setter, value) {
    setter(value);
    writeSetting(name, value);
  }
  const displayedNotes = study.notes;
  const roomBadge = <><LockKeyhole size={13} /> Private room</>;
  return <div className="qs-studio" data-tab={tab} data-layout={layout} data-share={showShare} style={{ "--qs-pane-width": paneWidth + "%", "--qs-note-height": noteHeight ? noteHeight + "px" : undefined, "--qs-research-panel-height": researchPanelHeight ? researchPanelHeight + "px" : undefined }}>
    <header className="qs-room-header">
      <div className="qs-identity"><span className="qs-app-icon"><BookOpen size={17} /></span><div><strong>{room.title}</strong><small>{study.selection.label} {study.selection.keys[0]}{study.selection.keys.length > 1 ? ' to ' + study.selection.keys.at(-1) : ''} · {room.members.length} in room</small></div></div>
      <nav className="qs-phases" aria-label="Study phases">{phases.map((phase, index) => {
        const active = phase === study.phase;
        return <button key={phase} type="button" disabled={!host} aria-current={active ? 'step' : undefined} className={active ? 'is-active' : ''} onClick={() => lead('phase', phase)}>{index < phases.indexOf(study.phase) && <Check size={13} />}{phase}{active && <span>{remaining}</span>}</button>;
      })}</nav>
      {host && <label className="qs-mobile-phase"><select aria-label="Study phase" value={study.phase} onChange={event => lead('phase', event.target.value)}>{phases.map(phase => <option value={phase} key={phase}>{phase}</option>)}</select><small>{remaining}</small></label>}
      <div className="qs-actions qs-header-actions">
        <small>{roomBadge}</small>
        <button type="button" className="qs-icon" aria-label="Participants and join requests" onClick={onPeople}><Hand size={15} /></button>
      </div>
    </header>
    <nav className="qs-mobile-tabs" aria-label="Room views">{[['ayah', 'Ayah'], ['notes', 'Notes'], ['docs', 'Docs'], ['people', 'People']].map(([id, name]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{name}</button>)}</nav>
    {(rtc.error || rtc.ready && !rtc.connection.canPlaybackAudio) && <div className="qs-room-status" role="status">
      {rtc.error && <span>{rtc.error} {!rtc.ready && <button className="qs-link" type="button" onClick={rtc.retry}>Retry call</button>}</span>}
      {rtc.ready && !rtc.connection.canPlaybackAudio && <button className="qs-link" type="button" onClick={() => rtc.perform(() => rtc.connection.startAudio())}>Enable call sound</button>}
    </div>}
    <main className="qs-room-body">
      {showShare && <div className="qs-left qs-share">
        {showAyahPin && <section className="qs-line qs-ayah is-current qs-pinned"><strong>Pinned {ayah}</strong><div className="qs-arabic" dir="rtl" lang="ar" translate="no">{reading.data?.arabic || <small dir="ltr">{reading.error ? 'Ayah unavailable' : 'Loading ayah…'}</small>}</div><button className="qs-button" type="button" onClick={toggleAyahPin}>Hide pinned ayah</button></section>}
        <section className="qs-panel qs-share-frame" ref={shareFrame}>
          <div className="qs-share-title"><span /><span /><span /> {share.name || 'Participant'}’s screen</div>
          <div className="qs-share-video"><div className="qs-share-content" style={{ '--qs-share-zoom': shareZoom }}><MediaTrack track={share.track} /></div>
            <div className="qs-line qs-share-overlay"><div className="qs-actions">
              {!showAyahPin && <button className="qs-button" type="button" onClick={toggleAyahPin}>Show pinned ayah</button>}
              <button className="qs-button" type="button" onClick={() => setOpenShare(false)}>Back to full ayah</button>
              {rtc.shares.length > 1 && <select aria-label="Shared screen" value={share.id} onChange={event => { setPinned(''); setSelectedShare(event.target.value); }}>{rtc.shares.map(item => <option key={item.id} value={item.id}>{item.name || 'Participant'}</option>)}</select>}
              <button className="qs-button" type="button" aria-pressed={pinned === share.id} onClick={() => setPinned(pinned === share.id ? '' : share.id)}>{pinned === share.id ? <PinOff size={15} /> : <Pin size={15} />}{pinned === share.id ? 'Unpin' : 'Pin'}</button>
              <button className="qs-icon" type="button" aria-label="Zoom out shared screen" title="Zoom out" disabled={shareZoom <= .5} onClick={() => setShareZoom(value => Math.max(.5, value - .25))}><ZoomOut size={15} /></button>
              <span className="qs-share-zoom-level" aria-live="polite">{Math.round(shareZoom * 100)}%</span>
              <button className="qs-icon" type="button" aria-label="Zoom in shared screen" title="Zoom in" disabled={shareZoom >= 3} onClick={() => setShareZoom(value => Math.min(3, value + .25))}><ZoomIn size={15} /></button>
              <button className="qs-button" type="button" onClick={async () => { try { if (document.fullscreenElement === shareFrame.current) await document.exitFullscreen(); else if (shareFrame.current?.requestFullscreen) await shareFrame.current.requestFullscreen(); else onFullscreen(); } catch (error) { onError(error.message); } }}><Maximize size={15} /> Full screen</button>
            </div></div>
          </div>
        </section>
      </div>}
      <div className="qs-left" hidden={showShare}>
        <div className="qs-view qs-view-reader" hidden={tab === 'docs'}>
          <Reader call={call} study={study} reading={reading} language={language} setLanguage={setLanguage} word={picked}
            setWord={selectWord} host={host} lead={lead} onPassage={() => setPassageOpen(true)}
            documentCount={records.length} openDocs={() => setTab('docs')} playback={playback.token === study.recitation?.starts ? playback : null} />
          {share && !openShare && <button className="qs-button qs-return-share" type="button" onClick={() => setOpenShare(true)}><MonitorUp size={16} /> Return to shared screen</button>}
          {layout === 'speaker' && activeSpeaker && tiles(room.members.filter(person => person.id === activeSpeaker), 'qs-speaker')}
          {layout === 'rail' && tiles(room.members, 'qs-side-tiles')}
        </div>
        <div className="qs-view qs-view-documents" hidden={tab !== 'docs'}>
          {recordError && <p className="qs-error" role="alert">{recordError} <button className="qs-link" type="button" onClick={reload}>Retry</button></p>}
          <Documents call={call} records={records} reload={reload} presenter={study.document} controlsRef={documentControls} onDocumentReady={setDocumentReady} active={tab === 'docs'} me={room.me} host={host} openQuran={() => setTab('ayah')} onError={onError} />
          {layout === 'speaker' && activeSpeaker && tiles(room.members.filter(person => person.id === activeSpeaker), 'qs-speaker')}
          {layout === 'rail' && tiles(room.members, 'qs-side-tiles')}
        </div>
      </div>
      <ResizeHandle className="qs-width-handle" label="Sidebar width" axis="x" value={paneWidth} minimum={24} maximum={54}
        onChange={value => resize('pane-width', setPaneWidth, value)} />
      <aside className="qs-right" data-side-view={sideView} aria-label={discussing && !showShare ? 'Discussion notes and speaking queue' : 'Private notes and research'}>
        <div className="qs-actions qs-sidebar-tabs" role="group" aria-label="Notes and Web">
          <button className="qs-button" type="button" aria-pressed={sideView === 'notes'} onClick={() => setSideView('notes')}>Notes</button>
          <button className="qs-button" type="button" aria-pressed={sideView === 'web'} onClick={() => setSideView('web')}>Web</button>
        </div>
        <div className="qs-private-wrap" hidden={sideView !== 'notes'}>{privateNotes}</div>
        <div className="qs-web-wrap" hidden={sideView !== 'web'}><WebSearch call={call} /></div>
        {sideView === 'notes' && <ResizeHandle className="qs-height-handle" label="Notes height" axis="y" value={noteHeight || 220} minimum={120} maximum={Math.min(580, Math.max(180, window.innerHeight - 220))}
          onChange={value => resize('note-height', setNoteHeight, value)} />}
        {sideView === 'web' && !(discussing && tab === 'docs' && !showShare) && <ResizeHandle className="qs-height-handle qs-web-research-handle" label="Resize Web and Research panels" axis="y" reverse value={researchPanelHeight || 240} minimum={130} maximum={650}
          onChange={value => resize('research-panel-height', setResearchPanelHeight, value)} />}
        <div className="qs-research-desktop" hidden={discussing && tab === 'docs' && !showShare}>
          <Research {...researchProps} />
          {sideView === 'notes' && <ResizeHandle className="qs-height-handle" label="Research panel height" axis="y" value={researchPanelHeight || 240} minimum={130} maximum={650}
            onChange={value => resize('research-panel-height', setResearchPanelHeight, value)} />}
        </div>
        {sideView === 'notes' && discussing && tab === 'docs' && !showShare && <div className="qs-discussion">
          <section className="qs-panel qs-revealed"><div className="qs-line"><h2>Everyone’s notes</h2><small>Revealed together</small></div>
            {displayedNotes.length ? displayedNotes.map(note => <RevealedNote key={note.owner + note.key} note={note} call={call} canTranslate={study.translationAvailable} discard={note.owner === room.me.id ? () => reveal(true, note.key) : undefined} />) : <small>No notes have been revealed. Private notes are visible only to their writers.</small>}
          </section>
          <section className="qs-panel qs-queue"><h2>Speaking queue</h2>{queue.length ? <ol>{queue.map(person => <li key={person.id}>{person.name}</li>)}</ol> : <small>Raise your hand to join the queue.</small>}<button className="qs-button" type="button" onClick={onOpenNotes}>My private notes</button></section>
        </div>}
        {(paneWidth !== 29 || noteHeight !== 0 || researchPanelHeight !== 0) && <button className="qs-link qs-reset-pane" type="button" onClick={() => {
          resize('pane-width', setPaneWidth, 29); resize('note-height', setNoteHeight, 0); resize('research-panel-height', setResearchPanelHeight, 0);
        }}>Reset panel sizes</button>}
        {tab === 'people' && <section className="qs-panel qs-mobile-people"><div className="qs-line"><h2>People · {room.members.length}</h2><button type="button" className="qs-button" onClick={onPeople}>Manage / view</button></div>{tiles(people, 'qs-people-grid', layout === 'audio')}<h3>Speaking queue</h3>{queue.length ? <ol>{queue.map(person => <li key={person.id}>{person.name}</li>)}</ol> : <small>No hands raised.</small>}</section>}
      </aside>
    </main>
    <button type="button" className="qs-mobile-research" onClick={() => setResearchOpen(true)}><span />Research <small>Word, root, tafsir or topic</small></button>
    <footer className="qs-bottom">
      {showShare ? tiles(ordered, 'qs-strip qs-sharing-strip', layout === 'audio') : layout === 'strip' || layout === 'audio' ? tiles(room.members, 'qs-strip', layout === 'audio') : <span />}
      <CallControls rtc={rtc} settings={settings} shareMenu={shareMenu} onShareMenu={() => setShareMenu(open => !open)} documentReady={documentReady}
        onDocumentShare={() => { setShareMenu(false); setTab('docs'); void documentControls.current?.present(); }}
        onDocumentStop={study.document && (host || study.document.presenter === room.me.id) ? () => {
          setShareMenu(false); void documentControls.current?.stop();
        } : undefined} onSettings={() => setMediaOpen(true)} onHand={onHand}
        raised={room.members.some(person => person.id === room.me.id && person.raised)} onPeople={onPeople} onInvite={onInvite}
        inviteCount={room.pending?.length || 0} onExtend={onExtend} onLeave={onLeave} onEnd={onEnd} host={host}
        onFullscreen={onFullscreen} fullscreen={fullscreen} layout={layout} setLayout={chooseLayout} />
    </footer>
    {mediaOpen && <Suspense fallback={<p role="status">Loading device settings…</p>}><DeviceSettings settings={settings} close={() => setMediaOpen(false)} apply={values => { setSettings(values); setMediaOpen(false); }} /></Suspense>}
    <dialog className="qs-modal qs-research-sheet" style={{ "--qs-research-height": researchHeight + "dvh" }} ref={researchDialog} onCancel={event => { event.preventDefault(); setResearchOpen(false); }}>
      <ResizeHandle className="qs-height-handle" label="Research sheet height" axis="up" value={researchHeight} minimum={35} maximum={88}
        onChange={value => resize('research-height', setResearchHeight, value)} />
      <header className="qs-line"><h2>Research</h2><button className="qs-icon" type="button" aria-label="Close research" onClick={() => setResearchOpen(false)}><X size={17} /></button></header><Research {...researchProps} />
    </dialog>
    {passageOpen && <Passage ayah={ayah} close={() => setPassageOpen(false)} save={data => lead('passage', data)} />}
    <RoomAudio rtc={rtc} />
    <SharedRecitation recitation={study.recitation} serverOffset={serverOffset} token={study.recitation?.starts || 0} onProgress={setPlayback} />
  </div>;
}

function Passage({ ayah, close, save }) {
  const [chapter, verse] = ayah.split(':');
  const [last, setLast] = useState(verse);
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  return <dialog className="qs-modal qs-passage" ref={dialog} onCancel={event => { event.preventDefault(); close(); }}>
    <header className="qs-line"><h2>Change ayah · {ayah}</h2><button className="qs-icon" type="button" aria-label="Close passage settings" onClick={close}><X size={17} /></button></header>
    <form className="qs-translation-fields" onSubmit={event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      save({ kind: 'range', chapter: values.get('chapter'), first: values.get('first'), last: values.get('last') });
    }}>
      <label>Surah number<input name="chapter" type="number" min="1" max="114" defaultValue={chapter} required /></label>
      <label>First ayah<input name="first" type="number" min="1" max="286" defaultValue={verse} onChange={event => setLast(event.target.value)} required /></label>
      <label>Last ayah<input name="last" type="number" min="1" max="286" value={last} onChange={event => setLast(event.target.value)} required /></label>
      <button className="qs-button qs-primary" type="submit">Set passage for everyone</button>
    </form>
  </dialog>;
}

function RevealedNote({ note, call, canTranslate, discard }) {
  const language = 'en';
  const [translation, setTranslation] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = translation?.source === note.text && translation.language === language;
  async function toggleTranslation() {
    if (active) { setTranslation(null); return; }
    setBusy(true); setError('');
    try {
      const params = new URLSearchParams({ owner: note.owner, key: note.key, language });
      const result = await call('/study/revealed-translation?' + params);
      setTranslation({ source: note.text, language, text: result.text });
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  const text = active ? translation.text : note.text;
  return <article className="qs-shared-note">
    <div className="qs-line"><strong>{note.name}</strong><span className="qs-count">{note.key}</span></div>
    <p lang={active ? language : undefined} dir="auto">{text}</p>
    {active && <small>Translated into English</small>}
    <div className="qs-actions">
      {canTranslate && <button type="button" className="qs-link" disabled={busy} onClick={toggleTranslation}>{active ? 'Show original' : busy ? 'Translating…' : 'Translate to English'}</button>}
      {discard && <button type="button" className="qs-link" onClick={discard}>Make private again</button>}
    </div>
    {error && <small role="alert">{error}</small>}
  </article>;
}

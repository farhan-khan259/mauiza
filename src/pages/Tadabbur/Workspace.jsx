import { peopleOrder, roomApiBase } from './client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Check, Copy, DoorOpen, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Notes, useNotes } from './Notes';
import BrandLogo from './BrandLogo';
import { platformPath, request, shareUrl } from './client';
import Studio from './Studio';

function countdown(milliseconds) {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function playJoinSound(contextRef) {
  try {
    if (!window.AudioContext) return;
    const context = contextRef.current || (contextRef.current = new window.AudioContext());
    const play = () => {
      if (context.state !== 'running') {
        console.warn('Mauiza meeting notification sound is unavailable until audio is enabled.');
        return;
      }
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      const start = context.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(740, start);
      oscillator.frequency.setValueAtTime(980, start + 0.12);
      volume.gain.setValueAtTime(0.0001, start);
      volume.gain.exponentialRampToValueAtTime(0.07, start + 0.025);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      oscillator.connect(volume);
      volume.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.33);
    };
    if (context.state === 'suspended') {
      void context.resume().then(play).catch(error => console.warn('Mauiza meeting notification sound failed:', error));
    } else play();
  } catch (error) {
    console.warn('Mauiza meeting notification sound failed:', error);
  }
}

export default function Workspace({ id, auth, initialAudio = false, initialVideo = false }) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [reminderEnd, setReminderEnd] = useState(0);
  const [dismissedReminder, setDismissedReminder] = useState(0);
  const [extendMinutes, setExtendMinutes] = useState('10');
  const [extensionOpen, setExtensionOpen] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [joinNotifications, setJoinNotifications] = useState([]);
  const offset = useRef(0);
  const root = useRef(null);
  const endConfirmDialog = useRef(null);
  const notificationSnapshot = useRef(null);
  const notificationAudio = useRef(null);
  const navigate = useNavigate();
  const prefix = `/rooms/${id}`;
  const call = useCallback((route = '', options = {}) => request(prefix + route, { ...options, auth }), [prefix, auth]);
  const noteState = useNotes(call, Boolean(room), `mauiza-notes:${id}:${auth.slice(0, 12)}`, 'meeting');
  const isHost = room?.me?.role === 'host';
  const live = room?.phase === 'live';
  const endAt = room?.endAt || 0;
  const remaining = endAt - now;

  const refresh = useCallback(async () => {
    const started = Date.now();
    const result = await call();
    offset.current = result.serverTime - (started + Date.now()) / 2;
    const previous = notificationSnapshot.current;
    if (!previous || result.revision > previous.revision) {
      if (previous) {
        const alerts = result.members
          .filter(person => person.id !== result.me.id && !previous.members.has(person.id))
          .map(person => ({ id: `member-${person.id}`, type: 'joined', name: person.name }));
        if (result.me.role === 'host') {
          alerts.push(...(result.pending || [])
            .filter(person => !previous.pending.has(person.id))
            .map(person => ({ id: `request-${person.id}`, type: 'request', requestId: person.id, name: person.name })));
        }
        if (alerts.length) {
          setJoinNotifications(current => {
            const existing = new Set(current.map(alert => alert.id));
            return [...current, ...alerts.filter(alert => !existing.has(alert.id))].slice(-4);
          });
          playJoinSound(notificationAudio);
        }
      }
      notificationSnapshot.current = {
        revision: result.revision,
        members: new Set(result.members.map(person => person.id)),
        pending: new Set((result.pending || []).map(person => person.id))
      };
    }
    setRoom(current => current && current.revision > result.revision ? current : result);
    setError('');
  }, [call]);

  useEffect(() => {
    let active = true;
    let timer;
    let running = false;
    let queued = false;
    const socket = io(new URL('/tadabbur', roomApiBase).href, {
      path: '/api/tadabbur/socket', transports: ['websocket'], auth: { id, auth }
    });
    async function sync() {
      if (!active) return;
      if (running) { queued = true; return; }
      running = true;
      window.clearTimeout(timer);
      try { await refresh(); }
      catch (syncError) { if (active) setError(syncError.message); }
      finally { running = false; }
      if (active) timer = window.setTimeout(sync, queued ? 0 : socket.connected ? 12000 : 2500);
      queued = false;
    }
    socket.on('connect', sync);
    socket.on('room:update', sync);
    void sync();
    return () => { active = false; socket.disconnect(); window.clearTimeout(timer); };
  }, [auth, id, refresh]);

  useEffect(() => {
    if (!joinNotifications.some(item => item.type === 'joined')) return;
    const timeout = window.setTimeout(() => setJoinNotifications(current => current.filter(item => item.type !== 'joined')), 5200);
    return () => window.clearTimeout(timeout);
  }, [joinNotifications]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now() + offset.current), 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);

  useEffect(() => {
    const dialog = endConfirmDialog.current;
    if (!dialog) return;
    if (endConfirmOpen && !dialog.open) dialog.showModal();
    else if (!endConfirmOpen && dialog.open) dialog.close();
  }, [endConfirmOpen]);

  useEffect(() => {
    if (live && endAt && remaining <= Math.min(5 * 60000, room.duration * 60000) && dismissedReminder !== endAt) {
      setReminderEnd(endAt);
    }
  }, [dismissedReminder, endAt, live, remaining, room?.duration]);

  async function action(type, value) {
    setMeetingBusy(true);
    setActionError('');
    setNotice('');
    try {
      const result = await call('/action', { method: 'POST', body: { action: type, value } });
      setRoom(result);
      return result;
    } catch (requestError) {
      setActionError(requestError.message);
      return false;
    } finally {
      setMeetingBusy(false);
    }
  }

  async function resolveJoinRequest(alert, type) {
    if (await action(type, alert.requestId)) {
      setJoinNotifications(current => current.filter(item => item.id !== alert.id));
    }
  }

  function requestEndMeeting() {
    setEndConfirmOpen(true);
  }

  async function confirmEndMeeting() {
    setEndConfirmOpen(false);
    await action('end');
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen();
      else setActionError('Full-screen mode is not supported by this browser. You can continue using the meeting in this window.');
    } catch {
      setActionError('The browser could not change full-screen mode. Your meeting is still connected.');
    }
  }

  async function copyLink() {
    if (!room?.invite) return;
    try {
      await navigator.clipboard.writeText(shareUrl(room));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied('failed');
      window.setTimeout(() => setCopied(false), 2500);
    }
  }

  async function leave() {
    if (noteState.hasPending && !(await noteState.save()) &&
      !window.confirm('Your latest note changes could not be saved. Leave the meeting anyway? Your browser draft will be kept.')) return;
    navigate(platformPath);
  }

  async function saveReminderNotes() {
    setNotesOpen(true);
    const saved = await noteState.save();
    setNotice(saved ? 'Your private notes are saved.' : 'Notes could not be saved. Your draft is still available in this browser.');
  }

  async function extendMeeting(event) {
    event.preventDefault();
    const extended = await action('extend', Number(extendMinutes));
    if (extended) {
      setReminderEnd(0);
      setDismissedReminder(extended.endAt - now <= 5 * 60000 ? extended.endAt : 0);
      setExtensionOpen(false);
    }
  }

  if (!room) return <div className="td-lobby-shell"><section className="td-lobby-card">
    {error ? <><h1>Couldn’t open the meeting</h1><p role="alert" className="td-error">{error}</p></> : <p role="status">Opening your meeting…</p>}
  </section></div>;

  const closed = room.phase !== 'live';
  const reminderVisible = Boolean(reminderEnd && reminderEnd === endAt && !closed);

  if (closed) return <div className="td-ended-shell">
    <header className="td-ended-heading"><BrandLogo alt="" /><div><div className="eyebrow">MAUIZA LIVE</div><h1>Meeting Ended</h1><p>{room.title}</p></div></header>
    {error && <p className="td-error" role="alert">{error}</p>}
    {actionError && <p className="td-error" role="alert">{actionError}</p>}
    {notice && <p className="td-message" role="status">{notice}</p>}
    <Notes state={noteState} title={room.title + ' · Meeting notes'} />
    <button className="td-quiet" type="button" onClick={() => navigate(platformPath)}><DoorOpen size={17} /> Back to platform</button>
  </div>;

  return <div className="td-live qs-workspace" ref={root}>
    <div className="td-live-body">
      <main className="td-live-main">
        {error && <p className="td-live-alert" role="alert">Meeting sync interrupted: {error}</p>}
        {actionError && <p className="td-live-alert" role="alert">{actionError}</p>}
        {notice && <p className="td-live-notice" role="status">{notice}</p>}
        <Studio room={room} call={call} noteState={noteState} initialAudio={initialAudio} initialVideo={initialVideo}
          remaining={countdown(remaining)} serverOffset={offset} host={isHost}
          onHand={() => void action('hand')} onLeave={leave}
          onFullscreen={toggleFullscreen} fullscreen={fullscreen}
          onPeople={() => { setParticipantsOpen(!participantsOpen); setDetailsOpen(false); setExtensionOpen(false); }}
          onInvite={() => { setDetailsOpen(!detailsOpen); setParticipantsOpen(false); setExtensionOpen(false); }}
          onExtend={() => { setExtensionOpen(true); setDetailsOpen(false); setParticipantsOpen(false); }}
          onOpenNotes={() => setNotesOpen(true)} onError={setActionError}
          onEnd={requestEndMeeting}
        />
        {joinNotifications.some(alert => alert.type !== 'request' || room.pending?.some(person => person.id === alert.requestId)) && <div className="td-join-alerts" aria-live="polite">
          {joinNotifications.filter(alert => alert.type !== 'request' || room.pending?.some(person => person.id === alert.requestId)).map(alert => <section className="td-join-alert" key={alert.id}>
            <header><strong>{alert.type === 'request' ? 'Requests to join' : 'Participant joined'}</strong>
              <button className="td-icon-button" type="button" aria-label="Dismiss notification" onClick={() => setJoinNotifications(current => current.filter(item => item.id !== alert.id))}><X size={17} /></button>
            </header>
            <p>{alert.type === 'request' ? `${alert.name} is waiting to join.` : `${alert.name} joined the meeting.`}</p>
            {alert.type === 'request' && isHost && <div className="td-actions">
              <button className="td-button" type="button" disabled={meetingBusy} onClick={() => void resolveJoinRequest(alert, 'admit')}>Admit</button>
              <button className="td-quiet td-danger" type="button" disabled={meetingBusy} onClick={() => void resolveJoinRequest(alert, 'deny')}>Deny</button>
            </div>}
          </section>)}
        </div>}
        {extensionOpen && isHost && <section className="td-reminder-popup qs-manual-extension" aria-label="Extend meeting">
          <div className="td-popup-heading"><strong>Extend meeting</strong><button className="td-icon-button" type="button" aria-label="Close extension" onClick={() => setExtensionOpen(false)}><X size={16} /></button></div>
          <form className="td-extension-form" onSubmit={extendMeeting}><label>Minutes<input required type="number" min="1" max="180" value={extendMinutes} onChange={event => setExtendMinutes(event.target.value)} /></label><button className="td-button" type="submit" disabled={meetingBusy}>Extend</button></form>
        </section>}
        {reminderVisible && !extensionOpen && !detailsOpen && !participantsOpen && <section className="td-reminder-popup" aria-live="polite">
          <button className="td-icon-button td-popup-close" type="button" aria-label="Dismiss reminder" onClick={() => { setDismissedReminder(endAt); setReminderEnd(0); }}><X size={17} /></button>
          <strong>This meeting will end in {room.duration <= 5 ? countdown(remaining) : '5 minutes'}. Please save your notes.</strong>
          <div className="td-actions"><button className="td-quiet" type="button" onClick={() => void saveReminderNotes()}>Save Notes</button>
            {isHost && <form className="td-extension-form" onSubmit={extendMeeting}><label>Extend by<input required type="number" min="1" max="180" value={extendMinutes} onChange={event => setExtendMinutes(event.target.value)} /> min</label><button className="td-button" type="submit" disabled={meetingBusy}>Extend Meeting</button></form>}
          </div>
        </section>}
        {notesOpen && <FloatingPanel title="Notes" close={() => setNotesOpen(false)} className="td-notes-panel">
          <Notes state={noteState} title={room.title + ' · Meeting notes'} />
        </FloatingPanel>}
      </main>
      {participantsOpen && <aside className="td-live-sidebar td-participants-sidebar" aria-label="Participants">
        <div className="td-sidebar-heading"><h2>Participants ({room.members.length})</h2><button className="td-icon-button" type="button" aria-label="Close participants" onClick={() => setParticipantsOpen(false)}><X size={18} /></button></div>
        <ul className="td-list td-live-people">{[...room.members].sort(peopleOrder).map(person => <li key={person.id}>
          <div className="td-person-avatar">{person.name.slice(0, 1).toUpperCase()}</div><div className="td-person-label"><strong>{person.name}{person.id === room.me.id ? ' (you)' : ''} {person.raised && <span role="img" aria-label="Hand raised">✋</span>}</strong><small>{person.role === 'host' ? 'Creator' : person.raised ? 'Hand raised' : 'Participant'}</small></div>
          {isHost && person.id !== room.me.id && <button className="td-icon-button td-danger" type="button" aria-label={`Remove ${person.name}`} onClick={() => void action('remove', person.id)}>Remove</button>}
        </li>)}</ul>
        {isHost && room.pending?.length > 0 && <div className="td-pending-requests"><h3>Requests to join</h3>{room.pending.map(person => <div className="td-request-row" key={person.id}>
          <strong>{person.name}</strong><div className="td-actions">
            <button className="td-button" type="button" disabled={meetingBusy} onClick={() => void action('admit', person.id)}>Admit</button>
            <button className="td-quiet td-danger" type="button" disabled={meetingBusy} onClick={() => void action('deny', person.id)}>Deny</button>
          </div>
        </div>)}</div>}
      </aside>}
      {detailsOpen && <aside className="td-live-sidebar td-details-sidebar" aria-label="Meeting details">
        <div className="td-sidebar-heading"><h2>Meeting Details</h2><button className="td-icon-button" type="button" aria-label="Close meeting details" onClick={() => setDetailsOpen(false)}><X size={18} /></button></div>
        <div className="td-details-card"><small>Meeting</small><strong>{room.title}</strong><small>Time remaining</small><strong className="td-countdown">{countdown(remaining)}</strong><small>Created by</small><strong>{room.members.find(person => person.role === 'host')?.name || 'Meeting creator'}</strong></div>
        {isHost && <div className="td-details-invite"><h3>Invite guests</h3><p>Guests need your approval before they can enter.</p><label>Invitation link<input readOnly value={shareUrl(room)} onFocus={event => event.target.select()} /></label>
          <div className="td-invite-actions">
            <button className="td-button" type="button" onClick={() => void copyLink()}>{copied === true ? <Check size={17} /> : <Copy size={17} />}{copied === 'failed' ? 'Copy manually' : copied ? 'Copied' : 'Copy Link'}</button>
            <button className="td-quiet td-danger td-end-button" type="button" disabled={meetingBusy} onClick={requestEndMeeting}>End for Everyone</button>
          </div>
        </div>}
      </aside>}
    </div>
    <dialog className="qs-modal qs-confirm-dialog" ref={endConfirmDialog} aria-labelledby="end-meeting-title" aria-describedby="end-meeting-description"
      onCancel={event => { event.preventDefault(); setEndConfirmOpen(false); }}>
      <header className="qs-confirm-header">
        <h2 id="end-meeting-title">End meeting for everyone?</h2>
        <button className="qs-icon" type="button" aria-label="Close confirmation" onClick={() => setEndConfirmOpen(false)}><X size={17} /></button>
      </header>
      <p className="qs-confirm-description" id="end-meeting-description">Everyone will be disconnected from this meeting.</p>
      <footer className="qs-confirm-actions">
        <button className="qs-button" type="button" disabled={meetingBusy} onClick={() => setEndConfirmOpen(false)}>Cancel</button>
        <button className="qs-button qs-confirm-danger" type="button" disabled={meetingBusy} onClick={() => void confirmEndMeeting()}>End for everyone</button>
      </footer>
    </dialog>
  </div>;
}

function FloatingPanel({ title, close, className, children }) {
  const panel = useRef(null);
  const drag = useRef(null);
  const [position, setPosition] = useState(null);
  function move(event) {
    if (!drag.current || !panel.current) return;
    const parent = panel.current.parentElement.getBoundingClientRect();
    const width = panel.current.offsetWidth;
    const height = panel.current.offsetHeight;
    setPosition({
      x: Math.max(0, Math.min(parent.width - width, event.clientX - parent.left - drag.current.x)),
      y: Math.max(0, Math.min(parent.height - Math.min(height, parent.height), event.clientY - parent.top - drag.current.y))
    });
  }
  return <section ref={panel} className={`td-floating-panel ${className}`} style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}>
    <header className="td-floating-title" onPointerDown={event => {
      if (event.target.closest('button') || matchMedia('(max-width: 760px)').matches) return;
      const rect = panel.current.getBoundingClientRect();
      drag.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={move} onLostPointerCapture={() => { drag.current = null; }}>
      <strong>{title}</strong><button className="td-icon-button" type="button" aria-label={`Close ${title}`} onClick={close}><X size={18} /></button>
    </header>
    <div className="td-floating-content">{children}</div>
  </section>;
}


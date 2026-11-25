import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Camera, CameraOff, Mic, MicOff, Video } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { remember, request, platformPath, storedAuth } from './client';
import BrandLogo from './BrandLogo';
import Workspace from './Workspace';
import './Tadabbur.css';

export default function Platform() {
  const { id } = useParams();
  return <main className="td td-platform" lang="en" data-translation-owned>
    {id ? <RoomEntry key={id} id={id} /> : <PlatformHome />}
  </main>;
}

function PlatformHeader() {
  const { t } = useLanguage();
  return <header className="td-platform-header">
    <div className="td-platform-header-inner">
      <div className="td-platform-brand"><BrandLogo alt="Mauiza" /><span>{t('Live Quran Contemplation')}</span></div>
    </div>
  </header>;
}

function EntryPage({ children }) {
  return <div className="td-entry-page"><PlatformHeader />{children}</div>;
}

function PlatformHome() {
  const [mode, setMode] = useState('start');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [joinName, setJoinName] = useState('');
  const navigate = useNavigate();

  async function create(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    try {
      const result = await request('/rooms', { method: 'POST', body: fields });
      remember(result);
      navigate(`${platformPath}/room/${result.room.id}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function join(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const url = new URL(String(form.get('invite') || '').trim());
      const match = url.pathname.match(/^\/live-quran-contemplation\/platform\/room\/([a-f\d]{24})\/?$/i);
      const invite = new URLSearchParams(url.hash.slice(1)).get('invite');
      if (url.origin !== window.location.origin || !match || !/^[\w-]{43}$/.test(invite || '')) {
        throw new Error('Enter the full invitation link from the meeting creator.');
      }
      const guestName = String(form.get('name') || '').trim().slice(0, 60);
      if (!guestName) throw new Error('Enter your name to continue.');
      navigate(`${platformPath}/room/${match[1]}#invite=${invite}`, { state: { guestName } });
    } catch (joinError) {
      setError(joinError.message || 'Enter a valid Mauiza meeting invitation link.');
    }
  }

  return <EntryPage>
    <div className="td-create-shell">
      <header className="td-create-heading">
        <h1>{mode === 'start' ? 'Start a meeting' : 'Join a meeting'}</h1>
        <p>{mode === 'start' ? 'Create a private space for your circle. Guests will request entry using your invitation link.' : 'Enter the invitation link and the name you want the meeting creator to see.'}</p>
      </header>
      <div className="td-platform-panel">
        <div className="td-mode-switch" role="group" aria-label="Meeting action">
          <button type="button" className="td-mode-button" aria-pressed={mode === 'start'} onClick={() => { setMode('start'); setError(''); }}>Start Meeting</button>
          <button type="button" className="td-mode-button" aria-pressed={mode === 'join'} onClick={() => { setMode('join'); setError(''); }}>Join Meeting</button>
        </div>
        {mode === 'start' ? <form key="start" className="td-form td-create-form" onSubmit={create}>
          <label>Your name<input name="name" maxLength="60" autoComplete="name" required /></label>
          <label>Meeting title<input name="title" maxLength="100" required /></label>
          <label>Duration (minutes)<input name="duration" type="number" min="1" max="180" defaultValue="45" required /></label>
          {error && <p className="td-error" role="alert">{error}</p>}
          <button className="td-button" type="submit" disabled={busy}>{busy ? 'Starting…' : 'Start Meeting'}</button>
        </form> : <form key="join" className="td-form td-create-form" onSubmit={join}>
          <label>Invitation link<input name="invite" type="url" placeholder="Paste the meeting invitation link" required /></label>
          <label>Your name<input name="name" value={joinName} onChange={event => setJoinName(event.target.value)} maxLength="60" autoComplete="name" required /></label>
          {error && <p className="td-error" role="alert">{error}</p>}
          <button className="td-button" type="submit">Continue to Lobby</button>
        </form>}
      </div>
    </div>
  </EntryPage>;
}

function RoomEntry({ id }) {
  const [auth, setAuth] = useState(() => storedAuth(id));
  const [invite] = useState(() => new URLSearchParams(location.hash.slice(1)).get('invite') || '');
  const routeLocation = useLocation();
  const [meeting, setMeeting] = useState(null);
  const [name, setName] = useState(() => routeLocation.state?.guestName || '');
  const [camera, setCamera] = useState(false);
  const [microphone, setMicrophone] = useState(false);
  const [stream, setStream] = useState(null);
  const [requestInfo, setRequestInfo] = useState(null);
  const [error, setError] = useState('');
  const video = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    if (auth) return () => controller.abort();
    request(`/rooms/${id}/lobby?invite=${encodeURIComponent(invite)}`, { signal: controller.signal })
      .then(setMeeting)
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [auth, id, invite]);

  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream]);

  useEffect(() => () => stream?.getTracks().forEach(track => track.stop()), [stream]);

  useEffect(() => {
    if (!requestInfo) return;
    let active = true;
    async function poll() {
      try {
        const status = await request(`/rooms/${id}/requests/${requestInfo.id}`, { auth: requestInfo.auth });
        if (!active) return;
        if (status.status === 'admitted') {
          const result = { auth: requestInfo.auth, room: { id, title: status.title } };
          remember(result);
          history.replaceState(history.state, '', location.pathname);
          setStream(current => {
            current?.getTracks().forEach(track => track.stop());
            return null;
          });
          setAuth(requestInfo.auth);
          return;
        }
        if (status.status === 'denied') {
          setRequestInfo(current => ({ ...current, status: 'denied' }));
          return;
        }
        if (status.phase === 'ended') {
          setRequestInfo(current => ({ ...current, status: 'ended' }));
          return;
        }
      } catch (pollError) {
        if (active) setError(pollError.message);
      }
      if (active) window.setTimeout(poll, 1800);
    }
    void poll();
    return () => { active = false; };
  }, [id, requestInfo?.id, requestInfo?.auth]);

  async function setDevice(kind, enabled) {
    setError('');
    try {
      if (!enabled) {
        stream?.getTracks().filter(track => track.kind === kind).forEach(track => track.stop());
        if (kind === 'video') setCamera(false);
        else setMicrophone(false);
        return;
      }
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: kind === 'audio', video: kind === 'video' });
      const existing = stream ? [...stream.getTracks()] : [];
      setStream(new MediaStream([...existing, ...permissionStream.getTracks()]));
      if (kind === 'video') setCamera(true);
      else setMicrophone(true);
    } catch {
      setError('Device access was denied. You can still ask to join with your camera and microphone off.');
      if (kind === 'video') setCamera(false);
      else setMicrophone(false);
    }
  }

  async function ask(event) {
    event.preventDefault();
    setError('');
    try {
      const result = await request(`/rooms/${id}/requests`, {
        method: 'POST', body: { invite, name }
      });
      setRequestInfo(result);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (auth) return <Workspace id={id} auth={auth} initialAudio={microphone} initialVideo={camera} />;
  if (requestInfo?.status === 'denied') {
    return <EntryPage><LobbyMessage title="The creator didn’t admit you" message="You can contact the meeting creator and ask them to send a new invitation." /></EntryPage>;
  }
  if (requestInfo?.status === 'ended') {
    return <EntryPage><LobbyMessage title="This meeting has ended" message="The meeting is closed to new participants." /></EntryPage>;
  }
  if (requestInfo) {
    return <EntryPage><LobbyMessage title="Waiting for approval" message={`The meeting creator has been notified. Keep this page open, ${name}.`} /></EntryPage>;
  }

  return <EntryPage><div className="td-lobby-shell">
    <header className="td-lobby-heading">
      <h1>{meeting?.title || 'Meeting lobby'}</h1>
      <p>Ask the creator to admit you. Your microphone and camera will stay off unless you turn them on.</p>
    </header>
    <section className="td-lobby-card">
      <div className="td-camera-preview">
        <video ref={video} autoPlay playsInline muted />
        {!camera && <div className="td-camera-placeholder"><Video size={38} /><span>Camera preview</span></div>}
      </div>
      <div className="td-actions td-device-actions">
        <button className="td-call-btn" type="button" aria-pressed={microphone} onClick={() => setDevice('audio', !microphone)} aria-label={microphone ? 'Turn microphone off' : 'Turn microphone on'}>{microphone ? <Mic /> : <MicOff />}</button>
        <button className="td-call-btn" type="button" aria-pressed={camera} onClick={() => setDevice('video', !camera)} aria-label={camera ? 'Turn camera off' : 'Turn camera on'}>{camera ? <Camera /> : <CameraOff />}</button>
        <span>{microphone ? 'Microphone on' : 'Microphone off'} · {camera ? 'Camera on' : 'Camera off'}</span>
      </div>
      <form className="td-form" onSubmit={ask}>
        <label>Your name<input value={name} onChange={event => setName(event.target.value)} maxLength="60" autoComplete="name" required /></label>
        {error && <p className="td-error" role="alert">{error}</p>}
        <button className="td-button" type="submit" disabled={!meeting || meeting.phase !== 'live'}>Ask to Join</button>
      </form>
      <small>Entry requires approval from the meeting creator.</small>
    </section>
  </div></EntryPage>;
}

function LobbyMessage({ title, message }) {
  return <div className="td-lobby-shell td-lobby-state-shell">
    <section className="td-lobby-card td-lobby-message">
      <h1>{title}</h1><p>{message}</p>
  </section></div>;
}

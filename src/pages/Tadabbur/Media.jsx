import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Hand, Maximize, Mic, MicOff, MoreHorizontal, MonitorUp, PhoneOff, Settings2, UsersRound } from 'lucide-react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { audioConstraints, cameraProcessor, defaults, strongNoiseProcessor } from './effects';

const changes = [
  RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackPublished,
  RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished,
  RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.ActiveSpeakersChanged, RoomEvent.ConnectionStateChanged,
  RoomEvent.AudioPlaybackStatusChanged
];

export function useDeviceSettings() {
  const [settings, setSettings] = useState(() => {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem('mauiza-study-devices') || '{}') }; }
    catch { return { ...defaults }; }
  });
  return [settings, values => {
    try { localStorage.setItem('mauiza-study-devices', JSON.stringify(values)); } catch { /* Device prefs stay in memory. */ }
    setSettings(values);
  }];
}

export function useRoomCall(call, { initialAudio, initialVideo, settings, layout }) {
  const [connection] = useState(() => new Room({ adaptiveStream: true, dynacast: true }));
  const [version, refresh] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const currentPrefs = useRef(settings);
  const configuredInput = useRef('');
  currentPrefs.current = settings;
  const local = connection.localParticipant;
  const ready = connection.state === 'connected';

  useEffect(() => {
    const update = () => refresh(count => count + 1);
    changes.forEach(event => connection.on(event, update));
    return () => { changes.forEach(event => connection.off(event, update)); };
  }, [connection]);

  useEffect(() => {
    const controller = new AbortController();
    async function connect() {
      setBusy(true); setError('');
      try {
        const credentials = await call('/media', { method: 'POST', signal: controller.signal });
        if (controller.signal.aborted) return;
        await connection.connect(credentials.url, credentials.token);
        if (controller.signal.aborted) { void connection.disconnect(); return; }
        const prefs = currentPrefs.current;
        await connection.startAudio().catch(() => {});
        await local.setMicrophoneEnabled(initialAudio, audioConstraints(prefs));
        configuredInput.current = prefs.microphone;
        await local.setCameraEnabled(initialVideo && !prefs.cameraOff);
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message || 'Could not join the call.');
      } finally { if (!controller.signal.aborted) setBusy(false); }
    }
    void connect();
    return () => { controller.abort(); void connection.disconnect(); };
  }, [call, connection, local, initialAudio, initialVideo, retry]);

  const microphone = local.getTrackPublication(Track.Source.Microphone)?.track;
  const camera = local.getTrackPublication(Track.Source.Camera)?.track;

  useEffect(() => {
    if (!ready) return;
    const device = settings.speaker || 'default';
    if (!HTMLMediaElement.prototype.setSinkId && !settings.speaker) return;
    connection.switchActiveDevice('audiooutput', device).then(switched => {
      if (switched === false) setError('The selected speaker is unavailable.');
    }).catch(error => setError('Speaker selection: ' + error.message));
  }, [connection, ready, settings.speaker]);

  useEffect(() => {
    if (!ready || !microphone) return;
    let active = true;
    async function configure() {
      const constraints = audioConstraints(settings);
      const selected = microphone.mediaStreamTrack.getSettings()?.deviceId;
      if (constraints.deviceId ? selected !== constraints.deviceId : Boolean(configuredInput.current)) {
        const switched = await connection.switchActiveDevice('audioinput', constraints.deviceId || 'default');
        if (switched === false) throw new Error('The selected microphone is unavailable.');
      }
      if (!active) return;
      configuredInput.current = settings.microphone;
      const { deviceId, ...audio } = constraints;
      await microphone.mediaStreamTrack.applyConstraints(audio);
      if (!active) return;
      if (settings.noise === 'strong' && !microphone.getProcessor()) await microphone.setProcessor(strongNoiseProcessor());
      else if (settings.noise !== 'strong' && microphone.getProcessor()) await microphone.stopProcessor();
    }
    configure().catch(error => { if (active) setError('Microphone settings: ' + error.message); });
    return () => { active = false; };
  }, [connection, ready, microphone, settings.microphone, settings.noise, settings.echo, settings.autoVolume]);

  useEffect(() => {
    if (!ready || !camera) return;
    let active = true;
    const custom = settings.background !== 'none' || settings.brightness !== 100 || settings.filter !== 'none' || settings.autoFrame;
    async function configure() {
      if (!custom) {
        if (camera.getProcessor()) await camera.stopProcessor();
        return;
      }
      const processor = cameraProcessor(settings, { onError: error => setError('Camera effects: ' + error.message) });
      try { await camera.setProcessor(processor); }
      catch (error) { await processor.destroy(); if (active) setError('Camera effects: ' + error.message); }
    }
    configure().catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [ready, camera, settings.background, settings.brightness, settings.filter, settings.autoFrame]);

  useEffect(() => {
    if (!ready) return;
    for (const participant of connection.remoteParticipants.values()) {
      const publication = participant.getTrackPublication(Track.Source.Camera);
      const wanted = layout !== 'audio';
      if (publication && publication.isDesired !== wanted) publication.setSubscribed(wanted);
    }
  }, [connection, ready, layout, version]);

  async function perform(action) {
    if (!ready || busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }

  const shares = ready ? [local, ...connection.remoteParticipants.values()].flatMap(person => {
    const pub = person.getTrackPublication(Track.Source.ScreenShare);
    return pub?.track && !pub.isMuted ? [{ track: pub.track, id: person.identity, name: person.name }] : [];
  }) : [];
  return { connection, local, ready, error, busy, shares, microphone, retry: () => setRetry(n => n + 1), perform };
}

export function MediaTrack({ track, audio = false, duck = false, mirror = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    track.attach(element);
    return () => { track.detach(element); };
  }, [track]);
  useEffect(() => { if (audio && ref.current) ref.current.volume = duck ? .2 : 1; }, [audio, duck]);
  return audio ? <audio ref={ref} autoPlay /> : <video ref={ref} className={mirror ? 'is-mirrored' : ''} autoPlay playsInline muted />;
}

export function ParticipantTile({ person, rtc, me, audioOnly, sharing, mirror }) {
  const local = person.id === me;
  const live = local ? rtc.local : rtc.connection.remoteParticipants.get(person.id);
  const camera = live?.getTrackPublication(Track.Source.Camera);
  const name = local ? 'You' : person.name;
  return <article className={'qs-tile' + (live?.isSpeaking || sharing ? ' is-active' : '')} data-video={Boolean(camera?.track && !camera.isMuted && !audioOnly)}>
    {camera?.track && !camera.isMuted && !audioOnly ? <MediaTrack track={camera.track} mirror={local && mirror} /> :
      <span className="qs-avatar" data-color={person.name.codePointAt(0) % 5}>{person.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>}
    <div><strong>{name}</strong><small>{person.raised ? 'Hand raised' : live?.isMicrophoneEnabled ? 'Mic on' : 'Mic off'}</small></div>
    {person.raised && <span className="qs-hand-badge" role="img" aria-label="Hand raised">✋</span>}
    {sharing && <span className="qs-sharing-label">Sharing</span>}
  </article>;
}

export function RoomAudio({ rtc }) {
  if (!rtc.ready) return null;
  return [...rtc.connection.remoteParticipants.values()].flatMap(person =>
    [...person.audioTrackPublications.values()].filter(pub => pub.track).map(pub => <MediaTrack key={pub.trackSid} track={pub.track} audio />));
}

export function CallControls({ rtc, settings, raised, shareMenu, onShareMenu, documentReady, onDocumentShare, onDocumentStop, onSettings, onHand, onPeople, onExtend, onLeave, onEnd, host, onFullscreen, fullscreen, layout, setLayout }) {
  const [menu, setMenu] = useState(false);
  const { local, ready, busy, perform } = rtc;
  const available = Boolean(navigator.mediaDevices?.getDisplayMedia);
  return <div className="qs-call-controls">
    <button className="qs-round" type="button" disabled={!ready || busy} aria-label={local.isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'} aria-pressed={local.isMicrophoneEnabled} onClick={() => perform(() => local.setMicrophoneEnabled(!local.isMicrophoneEnabled, audioConstraints(settings)))}>{local.isMicrophoneEnabled ? <Mic /> : <MicOff />}</button>
    <button className="qs-round" type="button" disabled={!ready || busy} aria-label={local.isCameraEnabled ? 'Turn camera off' : 'Turn camera on'} aria-pressed={local.isCameraEnabled} onClick={() => perform(() => local.setCameraEnabled(!local.isCameraEnabled))}>{local.isCameraEnabled ? <Camera /> : <CameraOff />}</button>
    <div className="qs-more-anchor">
      <button className="qs-round" type="button" aria-label="Share options" aria-expanded={shareMenu} onClick={() => { setMenu(false); onShareMenu(); }}><MonitorUp /></button>
      {shareMenu && <div className="qs-more">
        <button className="qs-button" type="button" disabled={!ready || busy || !available} onClick={() => {
          onShareMenu();
          void perform(() => {
            if (local.isScreenShareEnabled) return local.setScreenShareEnabled(false);
            let controller;
            if (typeof globalThis.CaptureController === 'function') {
              try {
                controller = new globalThis.CaptureController();
                controller.setFocusBehavior('no-focus-change');
              } catch { controller = undefined; }
            }
            return local.setScreenShareEnabled(true, controller ? { controller } : undefined);
          });
        }}>{local.isScreenShareEnabled ? 'Stop screen sharing' : 'Share a screen, window or tab'}</button>
        <button className="qs-button" type="button" disabled={!documentReady} onClick={onDocumentShare}>Present this document page</button>
        {onDocumentStop && <button className="qs-button" type="button" onClick={onDocumentStop}>Stop document presentation</button>}
      </div>}
    </div>
    <button className="qs-round" type="button" aria-pressed={raised} aria-label={raised ? 'Lower hand' : 'Raise hand'} onClick={onHand}><Hand /></button>
    <div className="qs-more-anchor">
      <button className="qs-round" type="button" aria-label="More meeting options" aria-expanded={menu} onClick={() => setMenu(!menu)}><MoreHorizontal /></button>
      {menu && <div className="qs-more">
        <label>Participant view<select aria-label="Participant view" value={layout} onChange={e => setLayout(e.target.value)}><option value="strip">Strip</option><option value="rail">Side rail</option><option value="speaker">Speaker pop-out</option><option value="audio">Audio only</option></select></label>
        <button className="qs-button" type="button" onClick={() => { setMenu(false); onSettings(); }}><Settings2 size={16} /> Video and audio settings</button>
        <button className="qs-button" type="button" onClick={() => { setMenu(false); onPeople(); }}><UsersRound size={16} /> Participants</button>
        <button className="qs-button" type="button" onClick={() => { setMenu(false); onFullscreen(); }}><Maximize size={16} /> {fullscreen ? 'Exit full screen' : 'Enter full screen'}</button>
        {host && <button className="qs-button" type="button" onClick={() => { setMenu(false); onExtend(); }}>Extend meeting</button>}
        {host && <button className="qs-button qs-danger-text" type="button" onClick={() => { setMenu(false); onEnd(); }}>End for everyone</button>}
      </div>}
    </div>
    <button className="qs-round qs-hangup" type="button" onClick={onLeave} aria-label="Leave meeting"><PhoneOff /></button>
  </div>;
}

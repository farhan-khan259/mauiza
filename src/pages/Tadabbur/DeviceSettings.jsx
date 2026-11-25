import { useEffect, useRef, useState } from 'react';
import { Camera, Mic, X } from 'lucide-react';
import { audioConstraints, cameraProcessor, defaults, photoFilter } from './effects';

const backgrounds = [['none', 'None'], ['light', 'Light blur'], ['strong', 'Strong blur'], ['green', 'Plain green']];
const filters = [['none', 'None'], ['soft', 'Soft'], ['warm', 'Warm'], ['cool', 'Cool'], ['mono', 'Black and white']];

export default function DeviceSettings({ settings, close, apply }) {
  const [draft, setDraft] = useState(settings);
  const [input, setInput] = useState([]);
  const [output, setOutput] = useState([]);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [track, setTrack] = useState(null);
  const [effectReady, setEffectReady] = useState(false);
  const video = useRef(null);
  const preview = useRef(null);
  const processorRef = useRef(null);
  const dialog = useRef(null);
  const sound = useRef(null);

  const set = (name, value) => setDraft(previous => ({ ...previous, [name]: value }));
  async function devices() {
    const list = await navigator.mediaDevices.enumerateDevices();
    if (!navigator.mediaDevices) return;
    setInput(list.filter(item => item.kind === 'audioinput' && item.deviceId !== 'default'));
    setOutput(list.filter(item => item.kind === 'audiooutput' && item.deviceId !== 'default'));
  }
  useEffect(() => {
    dialog.current.showModal();
    void devices().catch(() => {});
    navigator.mediaDevices?.addEventListener('devicechange', devices);
    let active = true, stream;
    navigator.mediaDevices?.getUserMedia({ video: true }).then(media => {
      if (!active) { media.getTracks().forEach(item => item.stop()); return; }
      stream = media;
      const item = media.getVideoTracks()[0];
      video.current.srcObject = media;
      setTrack(item);
      void devices().catch(() => {});
    }).catch(error => { if (active) setPreviewError(error.message); });
    return () => {
      active = false;
      navigator.mediaDevices?.removeEventListener('devicechange', devices);
      stream?.getTracks().forEach(item => item.stop()); sound.current?.();
    };
  }, []);

  const useBackground = draft.background !== 'none' || draft.autoFrame;
  useEffect(() => {
    if (!track || !useBackground) { setEffectReady(false); return; }
    let active = true;
    setEffectReady(false); setPreviewError('');
    const processor = cameraProcessor(draft, { preview: true, onError: error => setPreviewError(error.message) });
    processorRef.current = processor;
    processor.init({ track }).then(() => {
      if (!active) return;
      preview.current.replaceChildren(processor.canvas);
      setEffectReady(true);
    }).catch(error => { if (active) setPreviewError('Background preview could not start. ' + error.message); });
    return () => { active = false; processorRef.current = null; void processor.destroy(); };
  }, [track, useBackground, draft.autoFrame]);
  useEffect(() => { processorRef.current?.update(draft); }, [draft]);

  useEffect(() => {
    let active = true, stream, context, frame;
    setError(''); setLevel(0);
    async function meter() {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints(draft) });
        if (!active) { media.getTracks().forEach(item => item.stop()); return; }
        stream = media;
        void devices().catch(() => {});
        context = new AudioContext();
        await context.resume();
        if (!active) return;
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(stream).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        let last = 0;
        function tick(time) {
          if (!active) return;
          if (time - last > 65) {
            analyser.getFloatTimeDomainData(samples);
            setLevel(Math.min(16, Math.round(Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length) * 100)));
            last = time;
          }
          frame = requestAnimationFrame(tick);
        }
        frame = requestAnimationFrame(tick);
      } catch (error) { if (active) setError(error.message); }
    }
    void meter();
    return () => { active = false; cancelAnimationFrame(frame); stream?.getTracks().forEach(item => item.stop()); if (context) void context.close(); };
  }, [draft.microphone, draft.noise, draft.echo, draft.autoVolume]);

  async function test() {
    let context;
    try {
      sound.current?.();
      setError('');
      context = new AudioContext();
      const audio = context;
      sound.current = () => { if (audio.state !== 'closed') void audio.close(); };
      let destination = context.destination;
      let routed;
      if (draft.speaker && context.setSinkId) await context.setSinkId(draft.speaker);
      else if (draft.speaker) {
        routed = new Audio();
        if (!routed.setSinkId) throw new Error('This browser uses your system speaker for test sounds.');
        destination = context.createMediaStreamDestination();
        routed.srcObject = destination.stream;
        await routed.setSinkId(draft.speaker);
        await routed.play();
        sound.current = () => { routed.pause(); routed.srcObject = null; if (audio.state !== 'closed') void audio.close(); };
      }
      await context.resume();
      const oscillator = context.createOscillator(), volume = context.createGain();
      oscillator.frequency.value = 650;
      volume.gain.setValueAtTime(.13, context.currentTime);
      volume.gain.exponentialRampToValueAtTime(.001, context.currentTime + .45);
      oscillator.connect(volume).connect(destination);
      oscillator.onended = () => { routed?.pause(); if (audio.state !== 'closed') void audio.close(); };
      oscillator.start(); oscillator.stop(context.currentTime + .45);
    } catch (error) { if (context?.state !== 'closed') void context?.close(); setError(error.message); }
  }

  return <dialog className="qs-modal qs-settings" ref={dialog} onCancel={event => { event.preventDefault(); close(); }} aria-labelledby="qs-settings-title">
    <header className="qs-line"><h2 id="qs-settings-title">Video and audio settings</h2><button type="button" className="qs-icon" aria-label="Close settings" onClick={close}><X size={18} /></button></header>
    <div className="qs-settings-grid">
      <section>
        <h3><Camera size={17} /> Video</h3>
        <div className={'qs-camera-preview' + (draft.mirror ? ' is-mirrored' : '')}>
          <small>Only you see this preview</small>
          <video ref={video} hidden={effectReady || !track} autoPlay playsInline muted style={{ filter: photoFilter(draft) }} />
          <div className="qs-preview-effect" ref={preview} hidden={!effectReady} />
          {!track && <div className="qs-person-shape" aria-hidden="true" />}
        </div>
        {previewError && <small role="alert">{previewError}</small>}
        <h4>Background</h4>
        <div className="qs-backgrounds">{backgrounds.map(([value, label]) => <button className={draft.background === value ? 'is-selected' : ''} key={value} type="button" aria-pressed={draft.background === value} onClick={() => set('background', value)}><span data-background={value} />{label}</button>)}</div>
        <label className="qs-switch"><span>Auto-frame camera<small>Keep your face or upper body centered when detected</small></span><input type="checkbox" role="switch" checked={draft.autoFrame} onChange={e => set('autoFrame', e.target.checked)} /></label>
        <h4>Brightness</h4>
        <label className="qs-actions"><small>Dim</small><input aria-label="Brightness" type="range" min="45" max="160" value={draft.brightness} onChange={e => set('brightness', Number(e.target.value))} /><small>Bright</small></label>
        <h4>Filters</h4>
        <div className="qs-actions">{filters.map(([value, label]) => <button type="button" className={'qs-pill ' + (draft.filter === value ? 'qs-primary' : '')} key={value} aria-pressed={draft.filter === value} onClick={() => set('filter', value)}>{label}</button>)}</div>
        <label className="qs-switch">Mirror my video<input type="checkbox" role="switch" checked={draft.mirror} onChange={e => set('mirror', e.target.checked)} /></label>
        <label className="qs-switch"><span>Join with camera off<small>Good for privacy and low data</small></span><input type="checkbox" role="switch" checked={draft.cameraOff} onChange={e => set('cameraOff', e.target.checked)} /></label>
      </section>
      <section>
        <h3><Mic size={17} /> Audio</h3>
        <label className="qs-device"><span>Microphone</span><select aria-label="Microphone" value={draft.microphone} onChange={e => set('microphone', e.target.value)}><option value="">Default microphone</option>{input.map((device, i) => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Microphone ' + (i + 1)}</option>)}</select></label>
        <small>Speak to test your level</small>
        <div className="qs-meter" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={16} aria-valuenow={level}>{Array.from({ length: 16 }, (_, index) => <i key={index} className={index < level ? 'is-active' : ''} />)}</div>
        <h4>Noise cancellation</h4>
        <div className="qs-segment">{['off', 'standard', 'strong'].map(value => <button key={value} className={draft.noise === value ? 'qs-primary' : ''} aria-pressed={draft.noise === value} type="button" onClick={() => set('noise', value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
        <small>Strong adds a noise gate to suppress background sound between words.</small>
        <label className="qs-switch">Echo cancellation<input type="checkbox" role="switch" checked={draft.echo} onChange={e => set('echo', e.target.checked)} /></label>
        <label className="qs-switch"><span>Automatic volume<small>Keeps your voice at an even level</small></span><input type="checkbox" role="switch" checked={draft.autoVolume} onChange={e => set('autoVolume', e.target.checked)} /></label>
        <label className="qs-device"><span>Speaker</span><select aria-label="Speaker" value={draft.speaker} onChange={e => set('speaker', e.target.value)}><option value="">System speakers</option>{output.map((device, i) => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Speaker ' + (i + 1)}</option>)}</select></label>
        <button className="qs-button" type="button" onClick={test}>Test sound</button>
        {error && <small role="alert">{error}</small>}
      </section>
    </div>
    <footer className="qs-line"><small>These settings and previews stay on your device.</small><div className="qs-actions"><button className="qs-button" type="button" onClick={() => setDraft({ ...defaults })}>Reset</button><button className="qs-button qs-primary" type="button" onClick={() => apply(draft)}>Done</button></div></footer>
  </dialog>;
}

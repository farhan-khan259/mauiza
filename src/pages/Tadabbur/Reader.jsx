import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, FileDown, FileText, LockKeyhole, Play, Square } from 'lucide-react';
import { plainText, safeLink } from './client';
import { TextControls, ResourceChooser, usePanelAppearance } from './StudyControls';
import { NotePreview, printNotes } from './Notes';

export function useVerse(call, key, lang) {
  const [state, setState] = useState({});
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    call('/study/verse?' + new URLSearchParams(/^\d+$/.test(lang) ? { key, translation: lang } : { key, lang }), { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setState({ key, lang, data }); })
      .catch(error => { if (!controller.signal.aborted) setState({ key, lang, error: error.message }); });
    return () => controller.abort();
  }, [call, key, lang, retry]);
  return { ...(state.key === key && state.lang === lang ? state : {}), retry: () => { setState({}); setRetry(n => n + 1); } };
}

function useStudyData(call, path, version = 0) {
  const [state, setState] = useState({});
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    call(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ path, version, data });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ path, version, error: error.message });
    });
    return () => controller.abort();
  }, [call, path, version]);
  return state.path === path && state.version === version ? state : {};
}

const tafsirLanguageNames = { ar: 'Arabic', bn: 'Bengali', en: 'English', ru: 'Russian', ur: 'Urdu', und: 'Original language' };

export function contextParagraphs(text) {
  const result = [];
  for (const block of text.trim().split(/\n\s*\n/)) {
    let start = 0, count = 0;
    for (const match of block.matchAll(/\.(?:[”’"')]+)?(?=\s|$)/g)) {
      if (++count % 2) continue;
      const end = match.index + match[0].length;
      result.push(block.slice(start, end).trim());
      start = end;
    }
    const tail = block.slice(start).trim();
    if (tail) result.push(tail);
  }
  return result;
}

function AyahDetails({ call, ayah }) {
  const [mode, setMode] = useState('tafsir');
  const [choice, select] = useState('');
  const [retry, setRetry] = useState(0);
  const settings = usePanelAppearance('ayah-details');
  const options = useStudyData(call, '/study/tafsirs', retry);
  const source = options.data?.find(item => String(item.id) === choice) || options.data?.[0];
  const response = useStudyData(call, (mode === 'context' || source) && '/study/verse?' +
    new URLSearchParams({ key: ayah, kind: mode, ...(mode === 'tafsir' && { source: source.id }) }), retry);
  const error = (mode === 'tafsir' && options.error) || response.error;
  const text = plainText(response.data?.text);
  return <section className="qs-panel qs-verse-tafsir" aria-label="Ayah details">
    <div className="qs-line qs-detail-heading">
      <h2>{mode === 'context' ? 'Context' : 'Ayah-wide tafsir'} · {ayah}{mode === 'tafsir' && response.data?.name ? ' · ' + response.data.name : ''}</h2>
      <div className="qs-actions">
        <button type="button" className="qs-button" aria-pressed={mode === 'tafsir'} onClick={() => setMode('tafsir')}>Tafsir</button>
        <button type="button" className="qs-button" aria-pressed={mode === 'context'} onClick={() => setMode('context')}>Context</button>
        <TextControls panel="ayah details" settings={settings} />
        {mode === 'tafsir' && <ResourceChooser title="Choose tafsir" items={options.data?.map(item => ({ ...item, language: tafsirLanguageNames[item.language] || item.language }))} value={source?.id} choose={select} error={options.error} retry={() => setRetry(n => n + 1)} />}
      </div>
    </div>
    {error ? <p role="alert">{error} <button type="button" className="qs-link" onClick={() => setRetry(n => n + 1)}>Retry</button></p>
      : <div className="qs-tafsir-text" style={{ fontSize: settings.appearance.size + 'em' }}>
        {mode === 'context' ? (response.data ? (response.data.entries.length ? response.data.entries.map((entry, index) => <article className="qs-context-entry" key={index}>
          <small>{entry.source}{entry.from !== entry.to && ' · Covers ayahs ' + entry.surah + ':' + entry.from + '–' + entry.to}</small>
          <div className="qs-context-text">{contextParagraphs(entry.context).map((paragraph, i) => <p key={i} dir="auto">{paragraph}</p>)}</div>
          {entry.chains?.length > 0 && <details><summary>Chains of transmission</summary><ul>{entry.chains.map((chain, i) => <li key={i}>{chain}</li>)}</ul></details>}
        </article>) : <p>We don’t have data for this ayah’s context.</p>) : <p role="status">Loading context…</p>)
          : text ? <>{response.data.coverage && <small>Commentary covers {response.data.coverage.join(', ')}</small>}{response.data.fallbackFrom && <small> · Showing {response.data.name} because {response.data.fallbackFrom} had no available commentary.</small>}<p dir="auto" lang="en">{text}</p></>
          : <p role="status">{options.data && !source ? 'No tafsir sources are available.' : 'Loading tafsir…'}</p>}
      </div>}
  </section>;
}

export function Reader({ call, study, reading, language, setLanguage, word, setWord, host, lead, documentCount, openDocs, playback, onPassage }) {
  const [highlight, setHighlight] = useState(true);
  const [translationRetry, setTranslationRetry] = useState(0);
  const translations = useStudyData(call, '/study/translations', translationRetry);
  const key = study.selection.keys[study.index];
  const time = (playback?.currentTime || 0) * 1000;
  const spoken = highlight && study.recitation?.segments?.find(segment => time >= segment[2] && time < segment[3])?.[0];
  return <section className="qs-panel qs-reader" aria-label="Shared Quran">
    <header className="qs-toolbar">
      <div className="qs-actions"><button className="qs-button qs-tab-selected" type="button"><BookOpen size={16} /> Quran</button><button className="qs-button qs-subtle" type="button" onClick={openDocs}><FileText size={16} /> Documents <span className="qs-count">{documentCount}</span></button></div>
      <div className="qs-actions qs-reader-controls">
        {host && <><button className="qs-button qs-change-passage" type="button" onClick={onPassage}>Change ayah</button><button className="qs-icon" type="button" aria-label="Previous ayah" disabled={study.index === 0} onClick={() => lead('ayah', study.index - 1)}><ChevronLeft size={17} /></button><small>Host moves everyone</small><button className="qs-icon qs-primary" type="button" aria-label="Next ayah" disabled={study.index >= study.selection.keys.length - 1} onClick={() => lead('ayah', study.index + 1)}><ChevronRight size={17} /></button></>}
      </div>
    </header>
    <div className="qs-reading-scroll">
      <section className="qs-ayah is-current notranslate" translate="no">
        <div className="qs-line"><strong>AYAH {key} <span>· everyone is here</span></strong><small>Tap any word to study it</small></div>
        {reading.error ? <p role="alert">{reading.error} <button className="qs-button" type="button" onClick={reading.retry}>Retry</button></p> : !reading.data ? <p role="status">Loading ayah {key}…</p> : <>
          <div className="qs-arabic" dir="rtl" lang="ar">
            {reading.data.words?.length ? reading.data.words.map(item => <button type="button" key={item.position} className={word?.position === item.position || spoken === item.position ? 'is-selected' : ''} aria-pressed={word?.position === item.position} onClick={() => setWord(item)}>{item.arabic}</button>) : reading.data.arabic}
          </div>
          <p dir={reading.data.translationDirection || 'auto'}>{reading.data.translation ? plainText(reading.data.translation) : 'This translation is unavailable for the current ayah.'}</p>
          <div className="qs-actions"><small>{reading.data.translationName}</small><ResourceChooser title="Choose translation" items={translations.data} value={language === 'en' ? 20 : language === 'ur' ? 97 : language} choose={setLanguage} error={translations.error} retry={() => setTranslationRetry(n => n + 1)} /></div>
        </>}
      </section>
      {word && <section className="qs-word">
        <span className="qs-word-arabic" dir="rtl" lang="ar">{word.arabic}</span>
        <div><strong>Word-specific study {word.root && <>· root <b lang="ar" dir="rtl">{word.root}</b></>}</strong><p>{word.meaning || 'Word meaning unavailable'}{word.transliteration ? ' · ' + word.transliteration : ''}</p>
          <small>{[word.partOfSpeech, word.tense, word.person, word.gender, word.number].filter(Boolean).join(' · ') || word.segments?.map(segment => segment.pos).join(' · ')}</small>
        </div>
      </section>}
      <AyahDetails call={call} ayah={key} />
    </div>
    <footer className="qs-toolbar qs-recitation">
      {host && <button className="qs-icon qs-primary" type="button" aria-label={study.recitation ? 'Stop recitation' : 'Play recitation'} onClick={() => lead(study.recitation ? 'stop' : 'recite', 7)}>{study.recitation ? <Square size={13} /> : <Play size={14} />}</button>}
      <small>{study.recitation ? study.recitation.name + ' · shared recitation' : 'Shared recitation'}</small>
      <progress className="qs-audio-line" aria-label="Recitation progress" max={playback?.duration || 1} value={playback?.currentTime || 0} />
      <button type="button" className="qs-link" aria-pressed={highlight} onClick={() => setHighlight(!highlight)}>Word highlight {highlight ? 'on' : 'off'}</button>
    </footer>
  </section>;
}

export function PrivateNotes({ state, title, ayah, word, phase, shared, reveal }) {
  const [error, setError] = useState('');
  const editor = useRef(null);
  const [formatted, setFormatted] = useState(false);
  const settings = usePanelAppearance('notes');
  function format(prefix, suffix, sample) {
    const textarea = editor.current;
    const { selectionStart, selectionEnd, value } = textarea;
    const content = prefix + (value.slice(selectionStart, selectionEnd) || sample) + suffix;
    const text = value.slice(0, selectionStart) + content + value.slice(selectionEnd);
    if (text.length > 18000) return;
    state.edit({ ...state.note, text });
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selectionStart + prefix.length, selectionStart + content.length - suffix.length);
    });
  }
  return <section className="qs-panel qs-notes">
    <div className="qs-line qs-detail-heading"><h2>My private notes</h2><TextControls panel="notes" settings={settings} /></div>
    <div className="qs-line"><div className="qs-actions"><span className="qs-count">{ayah || 'Meeting'}</span>{word && <span className="qs-word-chip" lang="ar" dir="rtl">{word.arabic}</span>}</div><small><LockKeyhole size={12} /> {shared ? 'A copy is revealed' : 'Hidden until Reveal'}</small></div>
    <textarea ref={editor} aria-label="Private meeting notes" placeholder={state.loaded ? 'Write your reflection…' : 'Loading your notes…'} dir="auto" disabled={!state.loaded}
      style={{ fontSize: settings.appearance.size + 'em' }} value={state.note.text} maxLength={state.limit} onChange={event => state.edit({ ...state.note, text: event.target.value })} />
    <div className="qs-actions qs-note-format" aria-label="Note formatting">
      {[['Bold', '**', '**', 'text', 'B'], ['Italic', '*', '*', 'text', 'I'], ['Underline', '__', '__', 'text', 'U'], ['Bulleted list', '• ', '', 'List item', '• List'], ['Numbered list', '1. ', '', 'List item', '1. List']].map(([label, prefix, suffix, sample, caption]) =>
        <button type="button" className="qs-button" aria-label={label} key={label} disabled={!state.loaded} onMouseDown={event => event.preventDefault()} onClick={() => format(prefix, suffix, sample)}>{caption}</button>)}
      <button type="button" className="qs-button" aria-pressed={formatted} onClick={() => setFormatted(value => !value)}>{formatted ? 'Hide preview' : 'Preview'}</button>
    </div>
    {formatted && <div className="qs-formatted-note" style={{ fontSize: settings.appearance.size + 'em' }}><NotePreview text={state.note.text} /></div>}
    <div className="qs-line"><small role="status">{state.error ? 'Save failed' : !state.loaded ? 'Loading' : state.hasPending ? 'Saving…' : 'Autosaved'}</small><button className="qs-link" type="button" onClick={() => {
      try { printNotes(title + ' · Meeting notes', state.note.text); } catch (err) { setError(err.message); }
    }}><FileDown size={13} /> Export PDF</button></div>
    {state.error && <p role="alert">{state.error} <button className="qs-link" type="button" onClick={state.loaded ? state.save : state.retry}>Retry</button></p>}
    {(['Reveal', 'Discuss'].includes(phase) || shared) && <button className="qs-button" type="button" disabled={!shared && !state.note.text.trim()} onClick={() => reveal(shared)}>{shared ? 'Make private again' : 'Reveal this note'}</button>}
    {error && <small role="alert">{error}</small>}
  </section>;
}

const cases = { NOM: 'Nominative', ACC: 'Accusative', GEN: 'Genitive', IND: 'Indicative', SUBJ: 'Subjunctive', JUS: 'Jussive' };
const pos = { N: 'Noun', V: 'Verb', ADJ: 'Adjective', PN: 'Proper noun', PRON: 'Pronoun', P: 'Preposition', DET: 'Determiner', CONJ: 'Conjunction' };
const labels = { IMPF: 'Imperfect', PERF: 'Perfect', IMPV: 'Imperative', ACT: 'Active', PASS: 'Passive', STEM: 'Stem', PREFIX: 'Prefix', SUFFIX: 'Suffix', M: 'Masculine', F: 'Feminine', S: 'Singular', D: 'Dual', P: 'Plural' };
const prefixLabels = { 'w:CONJ+': 'Conjunction prefix', 'l:P+': 'Preposition prefix', 'w:REM+': 'Remonstrative prefix', 'w:CIRC+': 'Circumstantial prefix', 'w:SUP+': 'Supplemental prefix' };

function morphology(segment) {
  const hasSpecificPrefix = segment.features.some(value => prefixLabels[value]);
  return segment.features.filter(value => !/^(POS|ROOT|LEM):/.test(value) && !(value === 'PREFIX' && hasSpecificPrefix)).map(value => {
    if (prefixLabels[value]) return prefixLabels[value];
    if (value.startsWith('MOOD:')) return cases[value.slice(5)] || value.slice(5);
    if (/^[123]?[MF]?[SDP]?$/.test(value) && value.length > 1) return [...value].map(code => labels[code] || ({ 1: 'First person', 2: 'Second person', 3: 'Third person' })[code] || code).join(', ');
    return labels[value] || cases[value] || (/^\([IVX]+\)$/.test(value) ? 'Form ' + value : value);
  });
}

function nahwDetails(segment) {
  const endings = segment.features
    .map(value => cases[value.replace(/^MOOD:/, '')])
    .filter(Boolean);
  if (endings.length) return endings.join(' · ');
  if (['PRON', 'CONJ', 'P', 'DET'].includes(segment.pos)) return 'Indeclinable form · no case ending';
  return 'Case ending not recorded for this segment';
}

const languageNames = { en: 'English', es: 'Spanish', ar: 'Arabic', ur: 'Urdu', fr: 'French', tr: 'Turkish', id: 'Indonesian', pt: 'Portuguese', de: 'German', hi: 'Hindi' };
const displayLanguage = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });
function TranslateText({ call }) {
  const [input, setInput] = useState('');
  const [target, setTarget] = useState('en');
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const [localBusy, setLocalBusy] = useState(false);
  const request = useRef(null);
  useEffect(() => {
    if (!input.trim()) return;
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(async () => {
      try {
        const data = await call('/study/translate', { method: 'POST', body: { text: input, target }, signal: controller.signal });
        if (!controller.signal.aborted) setResult({ input, target, data });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ input, target, error: error.message });
      }
    }, 700);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [call, input, target, retry]);
  async function translateOnDevice() {
    request.current?.abort();
    setLocalBusy(true);
    let detector, translator;
    try {
      detector = await globalThis.LanguageDetector.create();
      const detected = (await detector.detect(input.trim()))[0]?.detectedLanguage;
      if (!detected || detected === 'und') throw new Error('Enter a longer phrase so the browser can detect its language.');
      let text = input.trim();
      if (detected !== target) {
        translator = await globalThis.Translator.create({ sourceLanguage: detected, targetLanguage: target });
        text = await translator.translate(text);
      }
      setResult({ input, target, data: { text, detected } });
    } catch (error) {
      setResult({ input, target, error: 'Browser translation could not start. ' + error.message });
    } finally { detector?.destroy(); translator?.destroy(); setLocalBusy(false); }
  }
  const current = result?.input === input && result?.target === target ? result : null;
  return <section className="qs-stack-translate">
    <label>Detected language <small>{current?.data?.detected ? displayLanguage.of(current.data.detected) || current.data.detected : 'Detect automatically'}</small>
      <textarea aria-label="Text to translate" dir="auto" value={input} maxLength={3000} onChange={event => setInput(event.target.value)} placeholder="Enter or paste text" />
    </label>
    <label>Translate into <select aria-label="Target language" value={target} onChange={event => setTarget(event.target.value)}>{Object.entries(languageNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
    <output dir="auto" aria-live="polite">{current?.data?.text || (input.trim() && !current ? 'Translating…' : '')}</output>
    {current?.error && <div><p role="alert">{current.error}</p><div className="qs-actions">
      <button type="button" className="qs-button" disabled={localBusy} onClick={() => { setResult(null); setRetry(value => value + 1); }}>Retry server translation</button>
      {globalThis.LanguageDetector && globalThis.Translator && <button type="button" className="qs-button" disabled={localBusy} onClick={() => void translateOnDevice()}>{localBusy ? 'Preparing browser translation…' : 'Translate on this device'}</button>}
    </div></div>}
  </section>;
}

export function WebSearch({ call }) {
  const [query, setQuery] = useState('');
  const [searchQuery, search] = useState('');
  const [preview, setPreview] = useState(null);
  const settings = usePanelAppearance('web');
  const result = useStudyData(call, searchQuery && '/research?q=' + encodeURIComponent(searchQuery));
  return <section className="qs-panel qs-research">
    <div className="qs-line qs-detail-heading"><h2>Web</h2><TextControls panel="web" settings={settings} /></div>
    <form className="qs-search" onSubmit={event => { event.preventDefault(); if (query.trim().length >= 2) search(query.trim()); setPreview(null); }}><input aria-label="Web search query" type="search" required value={query} onChange={event => setQuery(event.target.value)} placeholder="Search the web" minLength={2} maxLength={180} /><button className="qs-link" type="submit">Search</button></form>
    <div className="qs-research-content" style={{ fontSize: settings.appearance.size + 'em' }}>
      {preview ? <div className="qs-web-preview">
        <button className="qs-link" type="button" onClick={() => setPreview(null)}>Back to results</button><a href={preview.url} target="_blank" rel="noopener noreferrer">{preview.title}</a><p>{preview.text}</p>
        <small>{new URL(preview.url).hostname}</small>
      </div> : <>
        {result.error && <div><p role="alert">{result.error}</p><a href={'https://search.brave.com/search?q=' + encodeURIComponent(searchQuery)} target="_blank" rel="noopener noreferrer">Search on Brave</a></div>}
        {searchQuery && !result.data && !result.error && <p role="status">Searching…</p>}
        {result.data?.length === 0 && <p>No matching results.</p>}
        {result.data?.map((item, index) => {
          const url = safeLink(item.url);
          return <article key={index} className="qs-result"><div>
            {url ? <button type="button" className="qs-link" onClick={() => setPreview({ ...item, url })}>{item.title}</button> : <strong>{item.title}</strong>}
            <small>{item.text}</small>
          </div></article>;
        })}
      </>}
    </div>
  </section>;
}

export function Research({ call, reading, word }) {
  const [source, setSource] = useState('Dictionary');
  const [pageState, setPage] = useState({});
  const [selected, setSelected] = useState(null);
  const settings = usePanelAppearance('research');
  const address = word && reading.data ? reading.data.key + ':' + word.position : '';
  const page = pageState.address === address ? pageState.page : 1;
  const reference = selected?.address === address ? selected.reference : '';
  const detail = useStudyData(call, address && '/study/word?' + new URLSearchParams({ address, page }));
  const occurrence = useStudyData(call, address && reference && source === 'Roots' && '/study/word?' + new URLSearchParams({ address, reference }));
  return <section className="qs-research qs-research-workspace">
    <div className="qs-line qs-detail-heading"><h2>Research</h2><TextControls panel="research" settings={settings} /></div>
    <div className="qs-actions">{['Dictionary', 'Roots', 'Sarf', 'Nahw', 'Translate'].map(value => <button key={value} className={'qs-pill ' + (source === value ? 'is-selected' : '')} aria-pressed={source === value} type="button" onClick={() => setSource(value)}>{value}</button>)}</div>
    <div className="qs-research-content" style={{ fontSize: settings.appearance.size + 'em' }}>
      {source === 'Translate' ? <TranslateText call={call} /> : !address ? <small>Tap a word in the ayah to study it.</small> : <>
        <div className="qs-line"><strong dir="rtl" lang="ar">{word.arabic}</strong><small>{address}</small></div>
        {detail.error ? <p role="alert">{detail.error}</p> : !detail.data ? <p role="status">Loading word data…</p> : <>
          {source === 'Dictionary' && (detail.data.entries.length ? detail.data.entries.map(entry => <article key={entry.id} className="qs-result qs-dictionary-entry"><div>
            <strong>{entry.heading} · <span dir="rtl" lang="ar">{detail.data.root}</span></strong><p>{entry.english}</p>
          </div></article>) : <p>{word.meaning ? plainText(word.meaning) : 'No dictionary entry is available.'}</p>)}
          {source === 'Roots' && (detail.data.root ? <>
            <dl className="qs-word-facts"><dt>Root letters</dt><dd lang="ar" dir="rtl">{detail.data.root}</dd><dt>Uses in the Quran</dt><dd>{detail.data.count} words</dd><dt>Lemma</dt><dd lang="ar" dir="rtl">{detail.data.lemma || '—'}</dd></dl>
            <div className="qs-actions">{detail.data.references.map(value => <button type="button" key={value} className="qs-pill" aria-pressed={reference === value} onClick={() => setSelected({ address, reference: value })}>{value}</button>)}</div>
            {reference && <article className="qs-result qs-root-occurrence"><div><div className="qs-line"><strong>{reference}</strong><button type="button" className="qs-link" onClick={() => setSelected(null)}>Close</button></div>
              {occurrence.error ? <p role="alert">{occurrence.error}</p> : occurrence.data ? <>
                <p dir="rtl" lang="ar">{occurrence.data.word}</p>
                {occurrence.data.segments.map((segment, i) => <small key={i}>{segment.form} · {pos[segment.pos] || segment.pos} · {morphology(segment).join(' · ')}</small>)}
              </> : <p role="status">Loading reference…</p>}
            </div></article>}
            <div className="qs-actions"><button className="qs-button" type="button" disabled={page === 1} onClick={() => setPage({ address, page: page - 1 })}>Previous</button><small>Page {page}</small><button className="qs-button" type="button" disabled={page * 30 >= detail.data.count} onClick={() => setPage({ address, page: page + 1 })}>Next</button></div>
          </> : <p>No lexical root is recorded for this word.</p>)}
          {source === 'Sarf' && <>
            <dl className="qs-word-facts"><dt>Word</dt><dd lang="ar" dir="rtl">{word.arabic}</dd><dt>Root</dt><dd lang="ar" dir="rtl">{detail.data.root || '—'}</dd><dt>Lemma</dt><dd lang="ar" dir="rtl">{detail.data.lemma || '—'}</dd>
              {detail.data.segments.map((segment, i) => <div key={i}><dt>Type · {segment.form}</dt><dd>{pos[segment.pos] || segment.pos}</dd><dt>Form</dt><dd>{morphology(segment).join(', ') || '—'}</dd></div>)}</dl>
          </>}
          {source === 'Nahw' && <>
            {detail.data.segments.map((segment, i) => <article key={i} className="qs-result"><div><strong dir="rtl" lang="ar">{segment.form}</strong><small>{pos[segment.pos] || segment.pos} · {nahwDetails(segment)}</small></div></article>)}
          </>}
        </>}
      </>}
    </div>
  </section>;
}

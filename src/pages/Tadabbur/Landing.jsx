import { ArrowUpRight, BookOpen, FileText, Languages, LockKeyhole, MessagesSquare, Search, Video } from 'lucide-react';
import heroImage from './tadabbur-hero.jpg';
import { useLanguage } from '../../context/LanguageContext';
import { platformPath } from './client';
import { Link } from 'react-router-dom';
import './Tadabbur.css';

const features = [
  [BookOpen, 'Study a shared ayah', 'Follow the host through the passage. Select an Arabic word to explore its meaning, root and supporting tafsir.'],
  [LockKeyhole, 'Private notes by ayah', 'Write a reflection, label it and export it as a PDF. Reveal a copy to the group only when you choose.'],
  [FileText, 'Discuss a document together', 'Open a PDF or image and present it to the room. Follow the presenter’s page or browse independently.'],
  [Search, 'Research beside the text', 'Look up words, roots, tafsir and web sources. Add useful findings directly to your private journal.'],
  [Video, 'Calls and screen sharing', 'Share your screen, raise your hand, set up your camera and microphone, and choose where participant tiles appear.'],
  [Languages, 'Quran and research translations', 'Choose a Quran translation or translate text inside the Research panel.']
];

const steps = [
  ['Start and invite', 'Enter your name, meeting title and duration. Copy the invitation link after your meeting starts.'],
  ['Read and reflect', 'The host opens an ayah for everyone. Use the word study, research panel and private journal at your own pace.'],
  ['Reveal, discuss and act', 'Share a reflection by choice, queue to speak, or discuss a PDF or image together.']
];

export default function TadabburLanding() {
  const { t } = useLanguage();
  return <main className="td">
    <section className="td-hero" style={{ '--td-photo': `url(${heroImage})` }}>
      <div className="container td-hero-inner">
        <div className="eyebrow">{t('MAUIZA ONLINE ACADEMY')}</div>
        <h1>{t('Live Quran Contemplation')}</h1>
        <p>{t('Study the Quran together in a private live room with shared ayahs, word study, personal notes and collaborative documents.')}</p>
        <Link className="td-button td-gold" to={platformPath}>{t('Open Live Platform')} <ArrowUpRight aria-hidden="true" size={19} /></Link>
      </div>
    </section>
    <div className="container">
      <section className="td-section" aria-labelledby="td-features">
        <div className="eyebrow">{t('THE STUDY ROOM')}</div>
        <h2 id="td-features">{t('A simple space to meet and reflect together')}</h2>
        <div className="td-feature-grid">
          {features.map(([Icon, title, description]) => <article className="td-card" key={title}>
            <div className="td-icon"><Icon size={23} aria-hidden="true" /></div>
            <h3>{t(title)}</h3><p>{t(description)}</p>
          </article>)}
        </div>
      </section>
      <section className="td-section td-flow" aria-labelledby="td-flow">
        <div>
          <div className="eyebrow">{t('FROM INVITATION TO THE CALL')}</div>
            <h2 id="td-flow">{t('How a meeting works')}</h2>
            <p>{t('Move through Read, Reflect, Reveal and Discuss with your group.')}</p>
        </div>
        <ol>{steps.map(([title, description]) => <li key={title}><h3>{t(title)}</h3><p>{t(description)}</p></li>)}</ol>
      </section>
      <section className="td-section td-faq" aria-labelledby="td-faq">
        <div className="eyebrow">{t('BEFORE YOU JOIN')}</div><h2 id="td-faq">{t('Frequently asked questions')}</h2>
        <details><summary>{t('Who can see my notes?')}</summary><p>{t('Only you can access your private meeting notes. The meeting creator sees only the notes you choose to reveal.')}</p></details>
        <details><summary>{t('Who can admit guests or end a meeting?')}</summary><p>{t('The person who created the meeting is the sole host. Guests need the creator’s approval to enter.')}</p></details>
        <details><summary>{t('Can I join from a phone?')}</summary><p>{t('Yes. The call controls stay available, and Participants and Meeting Details open as mobile-friendly panels. Device permissions depend on your browser.')}</p></details>
        <details><summary>{t('What happens when the meeting ends?')}</summary><p>{t('Your private notes remain available in the same browser so you can edit, save, and export them after the call.')}</p></details>
      </section>
      <section className="td-bottom-cta"><MessagesSquare aria-hidden="true" /><div><h2>{t('Start a Mauiza Live meeting')}</h2><p>{t('Create your meeting and invite guests to request entry.')}</p></div><Link className="td-button td-gold" to={platformPath}>{t('Open Live Platform')} <ArrowUpRight size={18} aria-hidden="true" /></Link></section>
    </div>
  </main>;
}

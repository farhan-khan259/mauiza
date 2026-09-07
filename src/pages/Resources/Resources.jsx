import { BookOpen, Download, ExternalLink, FileText, GraduationCap, HeartHandshake, Languages, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import PageHero from "../../components/PageHero/PageHero";
import { images } from "../../data/images";
import revertGuide1 from "../../pictures/Revert Guide1.pdf";
import revertGuide2 from "../../pictures/Revert Guide2.pdf";
import revertGuide3 from "../../pictures/Revert Guide3.pdf";
import prayerMemorization1 from "../../pictures/Prayer Memorization1.pdf";
import prayerMemorization2 from "../../pictures/Prayer Memorization2.pdf";
import prayerMemorization3 from "../../pictures/Prayer Memorization3.pdf";
import quranMemorization1 from "../../pictures/Quran Memorization1.pdf";
import quranMemorization2 from "../../pictures/Quran Memorization2.pdf";
import quranMemorization3 from "../../pictures/Quran Memorization3.pdf";
import arabicReading1 from "../../pictures/Arabic Reading Course1.pdf";
import arabicReading2 from "../../pictures/Arabic Reading Course2.pdf";
import arabicReading4 from "../../pictures/Arabic Reading Course4.pdf";
import arabicReading3 from "../../pictures/Arabic Reading Course3.pptx?url";
import tajweed from "../../pictures/Tajweed.pdf";
import "./Resources.css";

const resourceGroups = [
  { title: "Revert Guide", description: "A gentle collection of practical guides for those beginning their journey in Islam.", icon: HeartHandshake, documents: [["Revert Guide 1", revertGuide1], ["Revert Guide 2", revertGuide2], ["Revert Guide 3", revertGuide3]] },
  { title: "Prayer Memorization", description: "Build confidence in your prayer by learning the essential words and supplications.", icon: BookOpen, documents: [["Prayer Memorization 1", prayerMemorization1], ["Prayer Memorization 2", prayerMemorization2], ["Prayer Memorization 3", prayerMemorization3]] },
  { title: "Quran Memorization", description: "Helpful materials to support a steady and meaningful Quran memorization routine.", icon: GraduationCap, documents: [["Quran Memorization 1", quranMemorization1], ["Quran Memorization 2", quranMemorization2], ["Quran Memorization 3", quranMemorization3]] },
  { title: "Arabic Reading", description: "Step-by-step resources for recognizing Arabic letters, sounds, and Quranic words.", icon: Languages, documents: [["Arabic Reading Course 1", arabicReading1], ["Arabic Reading Course 2", arabicReading2], ["Arabic Reading Course 3", arabicReading3, "presentation"], ["Arabic Reading Course 4", arabicReading4]] },
  { title: "Tajweed", description: "A clear reference for strengthening pronunciation and reciting the Quran with care.", icon: Sparkles, documents: [["Tajweed", tajweed]] },
];

export default function Resources() {
  return <main className="page resources-page">
    <PageHero title="Learning Resources" subtitle="Explore and keep useful study materials for every step of your Quranic learning journey." image={images.learning} />
    <section className="section resources-section">
      <div className="container">
        <div className="resources-intro">
          <div className="eyebrow">STUDY LIBRARY</div>
          <h2>Learn at your own pace.</h2>
          <p className="lead">Open a resource whenever you need it, or download it to keep learning offline. Each collection is organized around a focused part of your journey.</p>
        </div>
        <div className="resource-groups">
          {resourceGroups.map(({ title, description, icon: Icon, documents }, index) => (
            <motion.article className="resource-group surface" key={title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .15 }} transition={{ duration: .45, delay: index * .05 }}>
              <header className="resource-group-heading">
                <span className="resource-icon"><Icon /></span>
                <div><p className="resource-kicker">RESOURCE COLLECTION</p><h3>{title}</h3><p>{description}</p></div>
              </header>
              <div className="resource-documents">
                {documents.map(([name, file, type]) => <div className="resource-document" key={name}>
                  <div className="document-name"><FileText /><span>{name}</span><small>{type === "presentation" ? "PPTX" : "PDF"}</small></div>
                  <div className="document-actions">
                    {type !== "presentation" && <a href={file} target="_blank" rel="noreferrer" className="document-action view-action" aria-label={`View ${name}`}><ExternalLink /><span>View</span></a>}
                    <a href={file} download className="document-action download-action" aria-label={`Download ${name}`}><Download /><span>Download</span></a>
                  </div>
                </div>)}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  </main>;
}

import { ArrowRight, Compass, MapPinned, ScanLine, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import PageHero from "../../components/PageHero/PageHero";
import { images } from "../../data/images";
import "./DailyEssentialsLanding.css";

const modules = [
  { title: "Qibla Location Detector", description: "Find the accurate Qibla direction from your current location with an interactive compass, Qibla bearing, and distance to the Kaaba.", to: "/daily-essentials/qibla", image: images.hero, Icon: Compass },
  { title: "Halal Ingredient Checker", description: "Enter each ingredient or additive to check whether it is generally halal, needs verification, or may be potentially haram.", to: "/daily-essentials/halal-scanner", image: "https://images.unsplash.com/photo-1601598851547-4302969d0614?auto=format&fit=crop&w=900&q=85", Icon: ScanLine },
  { title: "Mosque & Halal Finder", description: "Discover nearby mosques, Islamic centers, halal restaurants, and halal food locations using your current location and an interactive map.", to: "/daily-essentials/mosque-halal-finder", image: images.mosque, Icon: MapPinned },
  { title: "Prayer Timings", description: "View daily prayer timings, current prayer status, countdowns, prohibited prayer times, and additional voluntary prayer timings.", to: "/daily-essentials/prayer-timings", image: images.namaz, Icon: Clock3 }
];

export default function DailyEssentialsLanding() {
  return <main className="page essentials-landing">
    <PageHero title="Daily Essentials" subtitle="Thoughtful tools to support your worship, food choices, and everyday Muslim life." image={images.hero} />
    <section className="section essentials-section"><div className="container">
      <div className="essentials-intro"><span className="eyebrow">EVERYDAY GUIDANCE</span><h2>Useful tools for every day</h2><p>Explore practical, location-aware essentials designed with clarity, care, and your routine in mind.</p></div>
      <div className="essentials-grid">{modules.map(({ title, description, to, image, Icon }, index) => <motion.article className={`essential-card ${index % 2 ? "reverse" : ""}`} key={to} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .08 }}>
        <div className="essential-card-image"><img src={image} alt="" /><span><Icon aria-hidden="true" /></span></div><div className="essential-card-content"><p className="course-number">ESSENTIAL 0{index + 1}</p><h2>{title}</h2><h3>{["Direction with confidence.", "Know what is in your food.", "Find community nearby.", "Keep your day in prayer."][index]}</h3><p>{description}</p><Link to={to}>Explore <ArrowRight aria-hidden="true" /></Link></div>
      </motion.article>)}</div>
    </div></section>
  </main>;
}

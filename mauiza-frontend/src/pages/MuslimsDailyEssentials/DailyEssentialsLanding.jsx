import { ArrowRight, Compass, MapPinned, ScanLine, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import PageHero from "../../components/PageHero/PageHero";
import { images } from "../../data/images";
import "./DailyEssentialsLanding.css";

const modules = [
  { title: "Détecteur de direction de la Qibla", description: "Trouvez la direction précise de la Qibla à partir de votre position actuelle grâce à une boussole interactive, l’angle de la Qibla et la distance jusqu’à la Kaaba.", to: "/daily-essentials/qibla", image: images.hero, Icon: Compass },
  { title: "Vérificateur d’ingrédients halal", description: "Saisissez chaque ingrédient ou additif pour vérifier s’il est généralement halal, s’il nécessite une vérification ou s’il peut être potentiellement haram.", to: "/daily-essentials/halal-scanner", image: "https://images.unsplash.com/photo-1601598851547-4302969d0614?auto=format&fit=crop&w=900&q=85", Icon: ScanLine },
  { title: "Trouver mosquée & halal", description: "Découvrez les mosquées voisines, les centres islamiques, les restaurants halal et les endroits de nourriture halal à proximité de votre position actuelle grâce à une carte interactive.", to: "/daily-essentials/mosque-halal-finder", image: images.mosque, Icon: MapPinned },
  { title: "Horaires de prière", description: "Consultez les horaires quotidiens de prière, le statut de la prière actuelle, les compte à rebours, les heures interdites et les prières volontaires supplémentaires.", to: "/daily-essentials/prayer-timings", image: images.namaz, Icon: Clock3 }
];

export default function DailyEssentialsLanding() {
  return <main className="page essentials-landing">
    <PageHero title="Essentiels quotidiens" subtitle="Des outils islamiques utiles pour soutenir votre culte, vos choix alimentaires et votre vie quotidienne musulmane." image={images.hero} />
    <section className="section essentials-section"><div className="container">
      <div className="essentials-intro"><span className="eyebrow">GUIDE QUOTIDIEN</span><h2>Des outils utiles chaque jour</h2><p>Explorez des essentiels pratiques et adaptés à votre localisation, conçus avec clarté et soin dans votre routine.</p></div>
      <div className="essentials-grid">{modules.map(({ title, description, to, image, Icon }, index) => <motion.article className={`essential-card ${index % 2 ? "reverse" : ""}`} key={to} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .08 }}>
        <div className="essential-card-image"><img src={image} alt="" /><span><Icon aria-hidden="true" /></span></div><div className="essential-card-content"><p className="course-number">ESSENTIEL 0{index + 1}</p><h2>{title}</h2><h3>{["Dirigez-vous avec confiance.", "Sachez ce qu’il y a dans votre nourriture.", "Trouvez la communauté près de chez vous.", "Gardez votre journée dans la prière."][index]}</h3><p>{description}</p><Link to={to}>Explorer <ArrowRight aria-hidden="true" /></Link></div>
      </motion.article>)}</div>
    </div></section>
  </main>;
}

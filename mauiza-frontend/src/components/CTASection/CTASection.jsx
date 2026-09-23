import { motion } from "framer-motion";
import Button from "../Button/Button";
import { useLanguage } from "../../context/LanguageContext";
import "./CTASection.css";
export default function CTASection({
  title = "Make Time for What Matters",
  description = "A few minutes of learning every day can become a lifelong journey of knowledge.",
  button = "Start Learning Today",
  to = "/registration",
}) {
  const { t } = useLanguage();
  return (
    <section className="cta-section">
      <div className="cta-pattern">✦</div>
      <motion.div
        className="container cta-inner"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <p className="arabic">رَبِّ زِدْنِي عِلْمًا</p>
        <h2>{t(title)}</h2>
        <p>{t(description)}</p>
        <p className="cta-support">
          {t("Start your Quranic learning journey today.")}
        </p>
        <Button to={to} variant="light">
          {t(button)}
        </Button>
      </motion.div>
    </section>
  );
}

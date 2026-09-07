import { motion } from "framer-motion";
import {
  BookOpen,
  Clock3,
  Globe2,
  GraduationCap,
  Sparkles,
  UserRound,
  Check,
  ArrowDown,
} from "lucide-react";
import Button from "../../components/Button/Button";
import SectionHeading from "../../components/SectionHeading/SectionHeading";
import CourseCard from "../../components/CourseCard/CourseCard";
import FeatureCard from "../../components/FeatureCard/FeatureCard";
import CTASection from "../../components/CTASection/CTASection";
import FloatingDecor from "../../components/FloatingDecor/FloatingDecor";
import { courses } from "../../data/courses";
import { images } from "../../data/images";
import "./Home.css";
const features = [
  [
    GraduationCap,
    "Qualified Instructors",
    "Learn from dedicated instructors who are committed to helping students improve their Quranic knowledge and understanding.",
  ],
  [
    Globe2,
    "Learn From Anywhere",
    "Access your learning journey from the comfort of your home, wherever you are in the world.",
  ],
  [
    BookOpen,
    "Structured Learning",
    "Follow carefully organized courses designed to make learning easier and more progressive.",
  ],
  [
    UserRound,
    "Personalized Support",
    "Every student has different learning needs. Our approach focuses on providing guidance suited to the learner.",
  ],
  [
    Clock3,
    "Flexible Learning",
    "Choose a suitable learning schedule and make Quranic education part of your daily routine.",
  ],
  [
    Sparkles,
    "Learn & Grow",
    "Go beyond simply reading. Develop knowledge, confidence and a deeper connection with Islamic teachings.",
  ],
];
export default function Home() {
  return (
    <main className="page">
      <section className="home-hero">
        <FloatingDecor />
        <div className="container hero-grid">
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <p className="hero-kicker">BISMILLAHIR RAHMANIR RAHEEM</p>
            <h1>
              Learn the Quran.
              <br />
              <em>Strengthen Your Faith.</em>
              <br />
              Transform Your Life.
            </h1>
            <p className="hero-text">
              Accessible Islamic education designed to help you learn,
              understand and practice the teachings of the Quran from the
              comfort of your home.
            </p>
            <div className="hero-actions">
              <Button to="/courses">Explore Courses</Button>
              <Button to="/registration" >
                Enroll Now
              </Button>
            </div>
            <div className="trust-line">
              <Check /> Online Learning <i /> Qualified Instructors <i />{" "}
              Flexible Schedule
            </div>
          </motion.div>
          <motion.div
            className="hero-visual"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15 }}
          >
            <div className="hero-photo">
              <img
                src={images.hero}
                alt="Open Quran resting on a wooden stand"
              />
            </div>
            <div className="quran-card">
              <span>۝</span>
              <p>
                READ. REFLECT.
                <br />
                GROW.
              </p>
              <small>YOUR JOURNEY BEGINS</small>
            </div>
            <div className="hero-ring" />
            {/* <div className="scroll-note">
              <ArrowDown size={15} /> SCROLL TO EXPLORE
            </div> */}
          </motion.div>
        </div>
      </section>
      <section className="section introduction">
        <div className="container intro-grid">
          <motion.div
            className="intro-images"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <img
              src={images.learning}
                alt="Open Quran for Islamic study"
            />
            <div className="intro-float">
              <span>01</span>
              <p>
                Begin a meaningful
                <br />
                learning journey
              </p>
            </div>
          </motion.div>
          <div>
            <SectionHeading
              eyebrow="OUR PURPOSE"
              title="Your Journey Towards Quranic Learning Starts Here"
            />
            <p>
              Learning the Quran is a journey that brings knowledge, guidance
              and spiritual growth into our lives.
            </p>
            <p>
              Our online Islamic education platform is designed to make Quranic
              learning accessible to students of different ages and learning
              levels. Through structured lessons, dedicated instructors and a
              flexible learning environment, we help students build a stronger
              connection with the Quran and Islamic teachings.
            </p>
            <Button to="/about" className="intro-btn">
              Learn More About Us
            </Button>
          </div>
        </div>
      </section>
      <section className="section why">
        <div className="container">
          <SectionHeading
            center
            eyebrow="WHY CHOOSE US"
            title="Learning Designed Around Your Journey"
            description="We believe Islamic education should be accessible, structured and meaningful."
          />
          <div className="feature-grid">
            {features.map(([icon, title, text], i) => (
              <FeatureCard key={title} icon={icon} title={title} index={i}>
                {text}
              </FeatureCard>
            ))}
          </div>
        </div>
      </section>
      <section className="section courses-preview">
        <div className="container">
          <SectionHeading
            center
            eyebrow="OUR COURSES"
            title="Explore Our Islamic Education Courses"
            description="Start learning with courses designed to develop essential Quranic and Islamic knowledge."
          />
          <div className="course-grid">
            {courses.map((course, i) => (
              <CourseCard course={course} index={i} key={course.slug} />
            ))}
          </div>
          <div className="section-link">
            <Button to="/courses" variant="outline">
              View All Courses
            </Button>
          </div>
        </div>
      </section>
      <section className="section works">
        <div className="container">
          <SectionHeading
            center
            eyebrow="HOW IT WORKS"
            title="Start Learning in 3 Simple Steps"
          />
          <div className="steps">
            {[
              [
                "01",
                "Choose Your Course",
                "Explore our courses and select the one that matches your learning goals.",
              ],
              [
                "02",
                "Register Online",
                "Complete the simple registration form with your contact details, preferred schedule and course selection.",
              ],
              [
                "03",
                "Begin Your Learning Journey",
                "Our team will review your registration and contact you with the next steps.",
              ],
            ].map(([n, t, d]) => (
              <motion.div
                className="step"
                key={n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <span>{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      <section className="section about-preview">
        <div className="container about-grid">
          <div>
            <SectionHeading
              eyebrow="ABOUT US"
              title="Making Quranic Education More Accessible"
            />
            <p>
              We are an online Islamic education platform dedicated to helping
              students develop their Quranic knowledge through accessible and
              structured learning.
            </p>
            <p>
              Our goal is to bring together the timeless teachings of the Quran
              and the convenience of modern technology, allowing students to
              learn from the comfort of their homes.
            </p>
            <p>
              Whether you are taking your first steps in Quranic learning or
              looking to improve your existing skills, our courses provide a
              supportive environment where learning can become a consistent part
              of your life.
            </p>
            <Button to="/about">Discover Our Story</Button>
          </div>
          <div className="about-picture">
            <img src={images.mosque} alt="Peaceful mosque interior" />
            <div>
              ۞<small>LEARN WITH PURPOSE</small>
            </div>
          </div>
        </div>
      </section>
      <CTASection />
    </main>
  );
}

import { lazy, Suspense } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar/Navbar";
import Footer from "./components/Footer/Footer";
import ScrollToTop from "./components/ScrollToTop/ScrollToTop";
import Home from "./pages/Home/Home";
import About from "./pages/About/About";
import Courses from "./pages/Courses/Courses";
import Registration from "./pages/Registration/Registration";
import Contact from "./pages/Contact/Contact";
import Resources from "./pages/Resources/Resources";
import Volunteers from "./pages/Volunteers/Volunteers";
import MuslimsDailyEssentials from "./pages/MuslimsDailyEssentials/MuslimsDailyEssentials";
import DailyEssentialsLanding from "./pages/MuslimsDailyEssentials/DailyEssentialsLanding";
import QiblaDetector from "./pages/MuslimsDailyEssentials/QiblaDetector";
import HalalScanner from "./pages/MuslimsDailyEssentials/HalalScanner";
import MosqueHalalFinder from "./pages/MuslimsDailyEssentials/MosqueHalalFinder";
import { LanguageProvider } from "./context/LanguageContext";
import TadabburLanding from "./pages/Tadabbur/Landing";
import { landingPath, platformPath } from "./pages/Tadabbur/client";
const TadabburPlatform = lazy(() => import("./pages/Tadabbur/Platform"));
export default function App() {
  const { pathname } = useLocation();
  const inPlatform = pathname === platformPath || pathname.startsWith(platformPath + "/");
  if (inPlatform) return (
    <LanguageProvider>
      <ScrollToTop />
      <Suspense fallback={<p className="container" role="status">Loading the platform…</p>}>
        <Routes>
          <Route path={platformPath} element={<TadabburPlatform />} />
          <Route path={platformPath + "/room/:id"} element={<TadabburPlatform />} />
          <Route path={platformPath + "/*"} element={<TadabburPlatform />} />
        </Routes>
      </Suspense>
    </LanguageProvider>
  );
  return (
    <LanguageProvider>
      <ScrollToTop />
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/registration" element={<Registration />} />
        <Route path="/volunteers" element={<Volunteers />} />
        <Route path="/muslims-daily-essentials" element={<DailyEssentialsLanding />} />
        <Route path="/daily-essentials" element={<DailyEssentialsLanding />} />
        <Route path="/daily-essentials/qibla" element={<QiblaDetector />} />
        <Route path="/daily-essentials/halal-scanner" element={<HalalScanner />} />
        <Route path="/daily-essentials/mosque-halal-finder" element={<MosqueHalalFinder />} />
        <Route path="/daily-essentials/prayer-timings" element={<MuslimsDailyEssentials />} />
        <Route path={landingPath} element={<TadabburLanding />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
      <Footer />
    </LanguageProvider>
  );
}

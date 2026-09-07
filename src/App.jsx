import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar/Navbar";
import Footer from "./components/Footer/Footer";
import ScrollToTop from "./components/ScrollToTop/ScrollToTop";
import Home from "./pages/Home/Home";
import About from "./pages/About/About";
import Courses from "./pages/Courses/Courses";
import Registration from "./pages/Registration/Registration";
import Contact from "./pages/Contact/Contact";
import Resources from "./pages/Resources/Resources";
import { LanguageProvider } from "./context/LanguageContext";
export default function App() {
  return (
    <LanguageProvider>
      <ScrollToTop />
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        {/* <Route path="/about" element={<About />} /> */}
        <Route path="/about" element={<h1>About Page Works</h1>} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/registration" element={<Registration />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
      <Footer />
    </LanguageProvider>
  );
}

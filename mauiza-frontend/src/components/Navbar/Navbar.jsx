import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Button from "../Button/Button";
import { languages, useLanguage } from "../../context/LanguageContext";
import logo from "../../pictures/logo.jpeg";
import "./Navbar.css";
const links = [
  ["/", "Home"],
  ["/about", "About Us"],
  ["/courses", "Courses"],
  ["/resources", "Resources"],
  ["/volunteers", "Volunteers"],
  ["/muslims-daily-essentials", "Muslims Daily Essentials"],
  ["/contact", "Contact Us"],
];
export default function Navbar() {
  const [open, setOpen] = useState(false),
    [scrolled, setScrolled] = useState(false);
  const { language, setLanguage } = useLanguage();
  useEffect(() => {
    const f = () => setScrolled(scrollY > 20);
    f();
    addEventListener("scroll", f);
    return () => removeEventListener("scroll", f);
  }, []);
  return (
    <header className={`navbar ${scrolled ? "scrolled" : ""}`}>
      <div className="nav-inner container">
        <Link to="/" className="logo" onClick={() => setOpen(false)}>
          <img className="logo-image" src={logo} alt="Mauiza logo" />
        </Link>
        <nav className={open ? "open" : ""}>
          {links.map(([to, label]) => (
            <NavLink
              end={to === "/"}
              to={to}
              key={to}
              onClick={() => setOpen(false)}
            >
              {label}
            </NavLink>
          ))}
          <Button to="/registration" className="nav-cta" onClick={() => setOpen(false)}>
            Enroll Now
          </Button>
          <label className="language-picker">
            <span className="sr-only">Website language</span>
            <select
              value={language}
              aria-label="Website language"
              onChange={(event) => setLanguage(event.target.value)}
            >
              {languages.map(({ code, label, nativeLabel }) => (
                <option key={code} value={code}>
                  {nativeLabel} · {label}
                </option>
              ))}
            </select>
          </label>
        </nav>
        <button
          className="menu-button"
          aria-label="Toggle menu"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}

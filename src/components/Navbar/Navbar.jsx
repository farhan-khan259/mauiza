import { useEffect, useRef, useState, useCallback } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  Globe,
} from "lucide-react";
import Button from "../Button/Button";
import { languages, useLanguage } from "../../context/LanguageContext";
import logo from "../../pictures/logo.jpeg";
import { platformPath } from "../../pages/Tadabbur/client";
import "./Navbar.css";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About Us" },
  { to: "/courses", label: "Courses" },
  { to: platformPath, label: "Quran Contemplation" },
  { to: "/resources", label: "Resources" },
  { to: "/volunteers", label: "Volunteers" },
  { to: "/contact", label: "Contact Us" },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const { pathname } = useLocation();
  const { language, setLanguage, theme, t, toggleTheme } = useLanguage();
  const languagePickerRef = useRef(null);
  const navRef = useRef(null);
  const menuButtonRef = useRef(null);

  const isActiveLink = useCallback((to) => {
    if (to === "/") return pathname === "/";
    if (to === "/volunteers") {
      return pathname === "/volunteers" || pathname.startsWith("/volunteers/");
    }
    if (to === platformPath) return pathname.startsWith(platformPath);
    return pathname === to;
  }, [pathname]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (languagePickerRef.current && !languagePickerRef.current.contains(e.target)) {
        setLanguageDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Mobile nav keyboard navigation with focus trapping
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (e) => {
      const items = [...(navRef.current?.querySelectorAll("a[href], button:not([disabled])") || [])]
        .filter(item => item.getClientRects().length > 0 && getComputedStyle(item).visibility !== "hidden");
      if (!items.length) return;

      switch (e.key) {
        case "ArrowDown":
        case "ArrowUp":
          e.preventDefault();
          let idx = items.indexOf(document.activeElement);
          if (idx === -1) idx = 0;
          let newIdx = e.key === "ArrowDown"
            ? (idx < items.length - 1 ? idx + 1 : 0)
            : (idx > 0 ? idx - 1 : items.length - 1);
          items[newIdx]?.focus();
          break;
        case "Tab":
          // Focus trapping
          const firstItem = items[0];
          const lastItem = items[items.length - 1];
          if (e.shiftKey && document.activeElement === firstItem) {
            e.preventDefault();
            lastItem.focus();
          } else if (!e.shiftKey && document.activeElement === lastItem) {
            e.preventDefault();
            firstItem.focus();
          }
          break;
        case "Escape":
          if (!languageDropdownOpen) {
            setMobileMenuOpen(false);
            menuButtonRef.current?.focus();
          }
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    navRef.current?.querySelector(".mobile-nav-link")?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen, languageDropdownOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileMenuOpen]);

  // Language dropdown keyboard navigation
  useEffect(() => {
    if (!languageDropdownOpen) return;

    const handleKeyDown = (e) => {
      const items = languagePickerRef.current?.querySelectorAll(".language-dropdown li");
      if (!items?.length) return;

      switch (e.key) {
        case "ArrowDown":
        case "ArrowUp":
          e.preventDefault();
          let idx = Array.from(items).indexOf(document.activeElement);
          if (idx === -1) idx = 0;
          let newIdx = e.key === "ArrowDown"
            ? (idx < items.length - 1 ? idx + 1 : 0)
            : (idx > 0 ? idx - 1 : items.length - 1);
          items[newIdx]?.focus();
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          document.activeElement?.click();
          break;
        case "Escape":
          setLanguageDropdownOpen(false);
          languagePickerRef.current?.querySelector(".language-picker-trigger")?.focus();
          break;
        case "Tab":
          setLanguageDropdownOpen(false);
          (e.shiftKey
            ? languagePickerRef.current?.querySelector(".language-picker-trigger")
            : languagePickerRef.current?.closest(".nav-actions")?.querySelector(".theme-toggle")
          )?.focus();
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [languageDropdownOpen]);

  // Scroll effect
  useEffect(() => {
    const f = () => setScrolled(scrollY > 20);
    f();
    addEventListener("scroll", f);
    return () => removeEventListener("scroll", f);
  }, []);

  const currentLang = languages.find((l) => l.code === language);

  const toggleMobileMenu = useCallback(() => {
    const newState = !mobileMenuOpen;
    setMobileMenuOpen(newState);
    if (!newState) {
      menuButtonRef.current?.focus();
    }
  }, [mobileMenuOpen]);

  const toggleLanguageDropdown = useCallback(() => {
    setLanguageDropdownOpen((prev) => !prev);
  }, []);

  return (
    <header className={`navbar ${scrolled ? "scrolled" : ""} ${mobileMenuOpen ? "menu-open" : ""}`}>
      <div className="nav-inner container">
        <Link to="/" className="logo" onClick={() => setMobileMenuOpen(false)} aria-label={t("Mauiza Home")}>
          <img
            className="logo-image"
            src={logo}
            alt=""
            aria-hidden="true"
          />
        </Link>

        {/* Primary nav - centered on desktop */}
        <nav
          id="primary-navigation"
          ref={navRef}
          className={`primary-navigation ${mobileMenuOpen ? "nav-open" : ""}`}
          aria-label={t("Main navigation")}
        >
        <ul className={mobileMenuOpen ? "mobile-nav-list" : "nav-links"}>
          {navLinks.map((link, idx) => (
            <li key={link.to} className={link.to === "/" ? "nav-item home" : "nav-item"}>
                <NavLink
                  end={link.to === "/"}
                  to={link.to}
                  className={({ isActive }) => {
                    const active = isActiveLink(link.to);
                    if (mobileMenuOpen) {
                      return `mobile-nav-link ${active ? "active" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`;
                    }
                    return `nav-link ${active ? "active" : ""}`;
                  }}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    menuButtonRef.current?.focus();
                  }}
                  style={mobileMenuOpen ? { animationDelay: `${idx * 40}ms` } : undefined}
                >
                  {t(link.label)}
                </NavLink>
              </li>
          ))}
        </ul>

        {/* Actions on right - CTA, language, theme */}
        <div className="nav-actions">
          <Button to="/registration" className="nav-cta mobile-nav-action" onClick={() => {
            setMobileMenuOpen(false);
            menuButtonRef.current?.focus();
          }}>
            {t("Enroll Now")}
          </Button>

          {/* Custom styled language picker - NOT native select */}
          <div
            ref={languagePickerRef}
            className="language-picker"
            aria-label={t("Website language")}
          >
            <button
              className="language-picker-trigger"
              type="button"
              aria-label={t("Website language")}
              aria-expanded={languageDropdownOpen}
              aria-haspopup="listbox"
              onClick={toggleLanguageDropdown}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleLanguageDropdown();
                }
                if (e.key === "Escape") {
                  setLanguageDropdownOpen(false);
                }
              }}
            >
              <Globe className="language-icon" aria-hidden="true" />
              <span className="language-code">
                {currentLang?.nativeLabel || language}
              </span>
              <ChevronDown
                className={`language-arrow ${languageDropdownOpen ? "open" : ""}`}
                aria-hidden="true"
              />
            </button>

            {/* Language dropdown panel */}
            <div
              id="language-list"
              className="language-dropdown"
              role="listbox"
              aria-label={t("Available languages")}
              hidden={!languageDropdownOpen}
            >
              <ul role="menu">
                {languages.map(({ code, label, nativeLabel, direction }, idx) => (
                  <li
                    key={code}
                    role="option"
                    tabIndex={0}
                    className={code === language ? "active" : ""}
                    aria-selected={code === language}
                    style={{ direction, userSelect: "none" }}
                    onClick={() => {
                      setLanguage(code);
                      setLanguageDropdownOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setLanguage(code);
                        setLanguageDropdownOpen(false);
                      }
                    }}
                  >
                    <span className={`language-flag flag-${code}`} aria-hidden="true" />
                    <span>{nativeLabel} &middot; {label}</span>
                    {code === language && (
                      <svg className="check-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Theme toggle with smooth icon transition and proper ARIA */}
          <button
            className="theme-toggle"
            type="button"
            aria-label={theme === "dark" ? t("Switch to light mode") : t("Switch to dark mode")}
            aria-pressed={theme === "dark"}
            onClick={toggleTheme}
          >
            <Sun aria-hidden="true" className="icon-sun" />
            <Moon aria-hidden="true" className="icon-moon" />
          </button>
        </div>
      </nav>

        <button
          ref={menuButtonRef}
          className="menu-button"
          type="button"
          aria-label={mobileMenuOpen ? t("Close menu") : t("Open menu")}
          aria-expanded={mobileMenuOpen}
          aria-controls="primary-navigation"
          onClick={toggleMobileMenu}
        >
          {mobileMenuOpen ? <X className="menu-icon" /> : <Menu className="menu-icon" />}
        </button>
      </div>
      {mobileMenuOpen && (
        <button
          className="nav-backdrop"
          type="button"
          aria-label={t("Dismiss navigation backdrop")}
          tabIndex={-1}
          onClick={() => {
            setMobileMenuOpen(false);
            menuButtonRef.current?.focus();
          }}
        />
      )}
    </header>
  );
}
import { useEffect, useMemo, useState } from "react";
import { Clock3, Compass, LocateFixed, MapPin, Moon, Search, ShieldAlert, Sparkles, Sunrise, Sun, Sunset } from "lucide-react";
import PageHero from "../../components/PageHero/PageHero";
import { images } from "../../data/images";
import { useLanguage } from "../../context/LanguageContext";
import dailyTranslations from "./dailyEssentialsTranslations";
import "./MuslimsDailyEssentials.css";

const prayerIcons = { Fajr: Sunrise, Sunrise, Dhuhr: Sun, Asr: Compass, Maghrib: Sunset, Isha: Moon };
const prayerOrder = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
const apiBaseUrl = (import.meta.env.VITE_API_URL || "https://mauiza-backend.onrender.com").replace(/\/+$/, "");
const extraLabels = {
  en: { sunset: "Sunset", remaining: "Remaining" }, ur: { sunset: "غروب آفتاب", remaining: "باقی وقت" }, ar: { sunset: "الغروب", remaining: "متبقٍ" },
  sv: { sunset: "Solnedgång", remaining: "Återstår" }, tr: { sunset: "Gün batımı", remaining: "Kalan" }, fr: { sunset: "Coucher du soleil", remaining: "Restant" },
  es: { sunset: "Atardecer", remaining: "Restante" }, "zh-CN": { sunset: "日落", remaining: "剩余" }, pt: { sunset: "Pôr do sol", remaining: "Restante" },
  fil: { sunset: "Paglubog ng araw", remaining: "Natitira" }, hi: { sunset: "सूर्यास्त", remaining: "शेष" }, ru: { sunset: "Закат", remaining: "Осталось" }
};

function clockToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(value) {
  if (!value) return "--:--";
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

function formatCountdown(totalSeconds) {
  const seconds = Math.max(0, totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function getTimeZoneParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date);
  return Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, Number(value)]));
}

function getTomorrowDate(value) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function getTargetTimestamp(time, date, timeZone) {
  const [hours, minutes] = time.split(":").map(Number);
  const [year, month, day] = date.split("-").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const current = getTimeZoneParts(guess, timeZone);
  const currentWallTime = Date.UTC(current.year, current.month - 1, current.day, current.hour, current.minute);
  const targetWallTime = Date.UTC(year, month - 1, day, hours, minutes);
  const offset = (currentWallTime - targetWallTime) / 60000;
  return guess.getTime() - offset * 60000;
}

function getTodayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatLocalDate(date, language, calendar) {
  return new Intl.DateTimeFormat(language, { calendar, dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export default function MuslimsDailyEssentials() {
  const { language } = useLanguage();
  const t = (key) => extraLabels[language]?.[key] || dailyTranslations[language]?.[key] || dailyTranslations.en[key] || key;
  const [location, setLocation] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("mauiza-daily-location")) || null; } catch { return null; }
  });
  const [prayerData, setPrayerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [places, setPlaces] = useState([]);
  const [countdown, setCountdown] = useState(0);
  const [now, setNow] = useState(Date.now());

  const requestPrayerTimes = async (nextLocation) => {
    setLocation(nextLocation);
    sessionStorage.setItem("mauiza-daily-location", JSON.stringify(nextLocation));
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/prayer-times?latitude=${nextLocation.latitude}&longitude=${nextLocation.longitude}&date=${getTodayDate()}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || t("prayerUnavailable"));
      setPrayerData(result.data);
      if (result.data.location) {
        const resolvedLocation = { ...nextLocation, ...result.data.location };
        setLocation(resolvedLocation);
        sessionStorage.setItem("mauiza-daily-location", JSON.stringify(resolvedLocation));
      }
    } catch (requestError) {
      setError(requestError.message || t("prayerUnavailable"));
    } finally {
      setLoading(false);
      setLocationLoading(false);
    }
  };

  const allowLocation = () => {
    if (!navigator.geolocation) {
      setError(t("locationUnavailable"));
      return;
    }
    setLocationLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => requestPrayerTimes({ latitude: coords.latitude, longitude: coords.longitude }),
      () => { setLocationLoading(false); setError(t("locationDenied")); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  useEffect(() => {
    if (!location) return;
    requestPrayerTimes(location);
  }, []);

  useEffect(() => {
    if (!search.trim()) { setPlaces([]); return undefined; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/geocode?q=${encodeURIComponent(search.trim())}`, { signal: controller.signal });
        if (response.ok) setPlaces((await response.json()).data || []);
      } catch (requestError) { if (requestError.name !== "AbortError") setPlaces([]); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const currentPrayer = useMemo(() => {
    if (!prayerData) return null;
    const timezone = prayerData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const currentMinutes = clockToMinutes(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(now)));
    const upcoming = prayerOrder.map((name) => ({ name, time: prayerData.timings[name] })).find(({ time }) => clockToMinutes(time) > currentMinutes);
    const next = upcoming || { name: "Fajr", time: prayerData.timings.Fajr, tomorrow: true };
    const target = getTargetTimestamp(next.time, next.tomorrow ? getTomorrowDate(prayerData.date) : prayerData.date, timezone);
    return { ...next, target, currentMinutes };
  }, [now, prayerData]);

  useEffect(() => {
    if (currentPrayer) setCountdown(Math.max(0, Math.floor((currentPrayer.target - now) / 1000)));
  }, [currentPrayer, now]);

  const choosePlace = (place) => {
    setSearch("");
    setPlaces([]);
    requestPrayerTimes({ latitude: Number(place.latitude), longitude: Number(place.longitude), city: place.city, country: place.country });
  };

  const prayerStatus = (name, time) => {
    if (!prayerData) return "Upcoming";
    const minutes = clockToMinutes(time);
    if (name === currentPrayer?.name) return "Now";
    if (minutes < currentPrayer?.currentMinutes) return "Completed";
    return "Upcoming";
  };

  return (
    <main className="page daily-essentials-page" data-translation-owned="true">
      <PageHero title={t("title")} subtitle={t("subtitle")} image={images.mosque} />
      <section className="section daily-dashboard-section">
        <div className="container">
          <div className="daily-location-bar">
            <div className="daily-location-copy"><MapPin /><div><span>{t("currentLocation")}</span><strong>{location?.city && location?.country ? `${location.city}, ${location.country}` : t("noLocation")}</strong></div></div>
            <div className="daily-location-actions">
              <button type="button" className="daily-button daily-button-light" onClick={allowLocation} disabled={locationLoading}><LocateFixed />{locationLoading ? t("detecting") : t("allowLocation")}</button>
              <label className="daily-place-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchCity")} aria-label={t("searchCity")} /></label>
            </div>
            {places.length > 0 && <div className="place-results">{places.map((place) => <button type="button" key={`${place.latitude}-${place.longitude}`} onClick={() => choosePlace(place)}>{place.label}</button>)}</div>}
          </div>
          {error && <div className="daily-message daily-error" role="alert">{error}</div>}
          {loading && <div className="daily-message"><Clock3 /> {t("loading")}</div>}
          {prayerData && !loading && (
            <>
              <div className="daily-date-row"><div><span className="eyebrow">{t("todayDate")}</span><h2>{formatLocalDate(prayerData.date, language, "gregory")}</h2></div><div className="hijri-date">{formatLocalDate(prayerData.date, language, "islamic")}</div><button type="button" className="daily-change" onClick={() => { setLocation(null); setPrayerData(null); sessionStorage.removeItem("mauiza-daily-location"); }}>{t("changeLocation")}</button></div>
              <div className="next-prayer-card"><div><span className="eyebrow">{t("nextPrayer")}</span><h2>{t(currentPrayer.name)}</h2><p>{formatTime(currentPrayer.time)} · {currentPrayer.tomorrow ? t("tomorrow") : t("today")}</p></div><div className="countdown"><strong>{formatCountdown(countdown)}</strong><span>{t("remaining")}</span></div></div>
              <div className="daily-section-heading"><div><span className="eyebrow">{t("smartTimings")}</span><h2>{t("prayerTimes")}</h2></div><span className="calculation-note">{t("method")}: {prayerData.method}</span></div>
              <div className="prayer-grid">{prayerOrder.map((name) => { const Icon = prayerIcons[name]; return <article className={`prayer-card ${prayerStatus(name, prayerData.timings[name]).toLowerCase()}`} key={name}><div className="prayer-card-top"><Icon /><span>{t(prayerStatus(name, prayerData.timings[name]).toLowerCase())}</span></div><h3>{t(name)}</h3><strong>{formatTime(prayerData.timings[name])}</strong></article>; })}</div>
              <div className="timeline-panel"><div className="daily-section-heading"><div><span className="eyebrow">{t("dailyOverview")}</span><h2>{t("dayInPrayer")}</h2></div></div><div className="prayer-timeline">{prayerOrder.map((name) => <div className={`timeline-item ${prayerStatus(name, prayerData.timings[name]).toLowerCase()}`} key={name}><span className="timeline-dot" /><strong>{t(name)}</strong><small>{formatTime(prayerData.timings[name])}</small></div>)}</div></div>
              <section className="prohibited-panel"><div className="prohibited-heading"><ShieldAlert /><div><span className="eyebrow">{t("guidance")}</span><h2>{t("prohibited")}</h2></div></div><p className="prohibited-intro">{t("prohibitedIntro")}</p><div className="prohibited-grid">{[["Sunrise", "sunriseAvoid"], ["Zawal", "zawalAvoid"], ["Maghrib", "sunsetAvoid"]].map(([name, description]) => <div className="prohibited-card" key={name}><span>{name === "Maghrib" ? t("sunset") : t(name)}</span><strong>{formatTime(name === "Zawal" ? prayerData.timings.Dhuhr : prayerData.timings[name])}</strong><p>{t(description)}</p></div>)}</div></section>
            </>
          )}
          {!location && !loading && <div className="daily-empty"><Sparkles /><h2>{t("startTitle")}</h2><p>{t("startText")}</p><button type="button" className="daily-button" onClick={allowLocation}><LocateFixed /> {t("allowLocation")}</button></div>}
        </div>
      </section>
      <section className="section daily-info"><div className="container"><span className="eyebrow">{t("steadyRhythm")}</span><h2>{t("stayConnected")}</h2><p>{t("info")}</p></div></section>
    </main>
  );
}

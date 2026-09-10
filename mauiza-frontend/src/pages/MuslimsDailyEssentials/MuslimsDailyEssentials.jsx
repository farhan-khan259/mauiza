import { useEffect, useMemo, useState } from "react";
import { Clock3, Compass, LocateFixed, MapPin, Moon, Search, ShieldAlert, Sparkles, Sunrise, Sun, Sunset } from "lucide-react";
import PageHero from "../../components/PageHero/PageHero";
import { images } from "../../data/images";
import { useLanguage } from "../../context/LanguageContext";
import "./MuslimsDailyEssentials.css";

const prayerIcons = { Fajr: Sunrise, Sunrise, Dhuhr: Sun, Asr: Compass, Maghrib: Sunset, Isha: Moon };
const prayerOrder = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
const apiBaseUrl = (import.meta.env.VITE_API_URL || "https://mauiza-backend.onrender.com").replace(/\/+$/, "");

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

export default function MuslimsDailyEssentials() {
  const { language } = useLanguage();
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
      if (!response.ok) throw new Error(result.message || "Prayer timings could not be loaded.");
      setPrayerData(result.data);
      if (result.data.location) {
        const resolvedLocation = { ...nextLocation, ...result.data.location };
        setLocation(resolvedLocation);
        sessionStorage.setItem("mauiza-daily-location", JSON.stringify(resolvedLocation));
      }
    } catch (requestError) {
      setError(requestError.message || "Prayer timings could not be loaded.");
    } finally {
      setLoading(false);
      setLocationLoading(false);
    }
  };

  const allowLocation = () => {
    if (!navigator.geolocation) {
      setError("Location detection is not available in this browser. Search for your city instead.");
      return;
    }
    setLocationLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => requestPrayerTimes({ latitude: coords.latitude, longitude: coords.longitude }),
      () => { setLocationLoading(false); setError("Location access was denied. Search for your city to continue."); },
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
    if (minutes < currentPrayer?.currentMinutes && name !== "Sunrise") return "Completed";
    return "Upcoming";
  };

  return (
    <main className="page daily-essentials-page">
      <PageHero title="Muslims Daily Essentials" subtitle="Essential Islamic tools designed to help Muslims organize their daily worship and stay connected with their prayers." image={images.mosque} />
      <section className="section daily-dashboard-section">
        <div className="container">
          <div className="daily-location-bar">
            <div className="daily-location-copy"><MapPin /><div><span>Current Location</span><strong>{location?.city && location?.country ? `${location.city}, ${location.country}` : "No location selected"}</strong></div></div>
            <div className="daily-location-actions">
              <button type="button" className="daily-button daily-button-light" onClick={allowLocation} disabled={locationLoading}><LocateFixed />{locationLoading ? "Detecting..." : "Allow Location Access"}</button>
              <label className="daily-place-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search for a city" aria-label="Search for a city" /></label>
            </div>
            {places.length > 0 && <div className="place-results">{places.map((place) => <button type="button" key={`${place.latitude}-${place.longitude}`} onClick={() => choosePlace(place)}>{place.label}</button>)}</div>}
          </div>
          {error && <div className="daily-message daily-error" role="alert">{error}</div>}
          {loading && <div className="daily-message"><Clock3 /> Loading local prayer timings...</div>}
          {prayerData && !loading && (
            <>
              <div className="daily-date-row"><div><span className="eyebrow">TODAY'S DATE</span><h2>{prayerData.dateLabel}</h2></div><div className="hijri-date">{prayerData.hijriDate}</div><button type="button" className="daily-change" onClick={() => { setLocation(null); setPrayerData(null); sessionStorage.removeItem("mauiza-daily-location"); }}>Change Location</button></div>
              <div className="next-prayer-card"><div><span className="eyebrow">NEXT PRAYER</span><h2>{currentPrayer.name}</h2><p>{formatTime(currentPrayer.time)} · {currentPrayer.tomorrow ? "Tomorrow" : "Today"}</p></div><div className="countdown"><strong>{formatCountdown(countdown)}</strong><span>Remaining</span></div></div>
              <div className="daily-section-heading"><div><span className="eyebrow">SMART PRAYER TIMINGS</span><h2>Today’s Prayer Times</h2></div><span className="calculation-note">Method: {prayerData.method}</span></div>
              <div className="prayer-grid">{prayerOrder.map((name) => { const Icon = prayerIcons[name]; return <article className={`prayer-card ${prayerStatus(name, prayerData.timings[name]).toLowerCase()}`} key={name}><div className="prayer-card-top"><Icon /><span>{prayerStatus(name, prayerData.timings[name])}</span></div><h3>{name}</h3><strong>{formatTime(prayerData.timings[name])}</strong></article>; })}</div>
              <div className="timeline-panel"><div className="daily-section-heading"><div><span className="eyebrow">DAILY PRAYER OVERVIEW</span><h2>Your day in prayer</h2></div></div><div className="prayer-timeline">{prayerOrder.map((name) => <div className={`timeline-item ${prayerStatus(name, prayerData.timings[name]).toLowerCase()}`} key={name}><span className="timeline-dot" /><strong>{name}</strong><small>{formatTime(prayerData.timings[name])}</small></div>)}</div></div>
              <section className="prohibited-panel"><div className="prohibited-heading"><ShieldAlert /><div><span className="eyebrow">GUIDANCE</span><h2>Prohibited Prayer Times</h2></div></div><p className="prohibited-intro">These are calculated astronomical times around which voluntary prayer is generally avoided. Specific rulings can vary by school of thought.</p><div className="prohibited-grid">{[["Sunrise", "Avoid prayer around sunrise."], ["Zawal", "Avoid prayer around the exact solar noon period."], ["Sunset", "Avoid prayer around sunset."]].map(([name, description]) => <div className="prohibited-card" key={name}><span>{name}</span><strong>{formatTime(name === "Zawal" ? prayerData.timings.Dhuhr : prayerData.timings[name])}</strong><p>{description}</p></div>)}</div></section>
            </>
          )}
          {!location && !loading && <div className="daily-empty"><Sparkles /><h2>Start with your local prayer times</h2><p>Allow location access or search for a city to see today’s calculated timings.</p><button type="button" className="daily-button" onClick={allowLocation}><LocateFixed /> Allow Location Access</button></div>}
        </div>
      </section>
      <section className="section daily-info"><div className="container"><span className="eyebrow">A STEADY RHYTHM</span><h2>Stay Connected With Your Daily Prayers</h2><p>Use accurate local prayer times to organize your day, prepare for each salah, and keep worship close through every season.</p></div></section>
    </main>
  );
}

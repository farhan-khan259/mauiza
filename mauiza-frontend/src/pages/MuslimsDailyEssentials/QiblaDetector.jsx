import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Compass, LocateFixed, MapPin, Navigation, RotateCcw, Smartphone, X } from "lucide-react";
import PageHero from "../../components/PageHero/PageHero";
import { images } from "../../data/images";
import "./DailyEssentialsTools.css";

const KAABA = { latitude: 21.4224779, longitude: 39.8251832 };
const radians = value => value * Math.PI / 180;
const bearingFor = ({ latitude, longitude }) => (Math.atan2(
  Math.sin(radians(KAABA.longitude - longitude)) * Math.cos(radians(KAABA.latitude)),
  Math.cos(radians(latitude)) * Math.sin(radians(KAABA.latitude)) - Math.sin(radians(latitude)) * Math.cos(radians(KAABA.latitude)) * Math.cos(radians(KAABA.longitude - longitude))
) * 180 / Math.PI + 360) % 360;
const distanceFor = ({ latitude, longitude }) => 6371 * 2 * Math.asin(Math.sqrt(
  Math.sin((radians(KAABA.latitude - latitude)) / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(KAABA.latitude)) * Math.sin((radians(KAABA.longitude - longitude)) / 2) ** 2
));
const normalise = value => ((value % 360) + 360) % 360;
const angleDifference = (a, b) => ((a - b + 540) % 360) - 180;

export default function QiblaDetector() {
  const [location, setLocation] = useState(null);
  const [heading, setHeading] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState({ latitude: "", longitude: "" });
  const [compassReady, setCompassReady] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const bearing = useMemo(() => location && bearingFor(location), [location]);
  const relativeDirection = bearing == null || heading == null ? 0 : angleDifference(bearing, heading);
  const aligned = heading != null && Math.abs(relativeDirection) <= 5;

  useEffect(() => {
    if (!compassReady) return undefined;
    const handler = event => {
      if (Number.isFinite(event.webkitCompassHeading)) setHeading(normalise(event.webkitCompassHeading));
      else if (Number.isFinite(event.alpha)) setHeading(normalise(360 - event.alpha));
      if (Number.isFinite(event.webkitCompassAccuracy)) setAccuracy(event.webkitCompassAccuracy);
    };
    window.addEventListener("deviceorientationabsolute", handler, true);
    window.addEventListener("deviceorientation", handler, true);
    return () => { window.removeEventListener("deviceorientationabsolute", handler, true); window.removeEventListener("deviceorientation", handler, true); };
  }, [compassReady]);

  const enableCompass = async () => {
    setError("");
    try {
      if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== "granted") throw new Error("Compass permission was not granted.");
      }
      setCompassReady(true);
      setShowCalibration(true);
    } catch (permissionError) { setError(permissionError.message || "Your device compass is unavailable. You can still use the bearing shown below."); }
  };

  const locate = () => {
    if (!navigator.geolocation) return setError("Location services are not supported by this browser. Enter coordinates below instead.");
    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ latitude: coords.latitude, longitude: coords.longitude });
        setLoading(false);
      },
      () => {
        setError("We could not access your location. You can still calculate Qibla using coordinates.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  const submitManual = event => {
    event.preventDefault();
    const latitude = Number(manual.latitude);
    const longitude = Number(manual.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return setError("Enter valid latitude and longitude values.");
    }
    setLocation({ latitude, longitude });
    setError("");
  };

  const distance = location ? Math.round(distanceFor(location)).toLocaleString() : "";

  return <main className="page tool-page">
    <PageHero title="Qibla Finder" subtitle="Use your location and compass to find the direction of the Kaaba." image={images.mosque} />
    <section className="section tool-section"><div className="container qibla-layout">
      <div className="tool-panel qibla-controls">
        <span className="eyebrow">QIBLA FINDER</span>
        <h2>Find your direction</h2>
        <p>For the best result, allow location and compass access, then hold your phone flat and away from metal objects.</p>
        <button className="tool-button" onClick={locate} disabled={loading}><LocateFixed />{loading ? "Finding your location..." : "Use my location"}</button>
        <button className="tool-button tool-button-secondary" onClick={enableCompass}><Smartphone />{compassReady ? "Compass enabled" : "Enable compass"}</button>
        {error && <p className="tool-alert"><AlertCircle />{error}</p>}
        <form className="tool-form" onSubmit={submitManual}>
          <strong>Or enter coordinates manually</strong>
          <div>
            <input value={manual.latitude} onChange={event => setManual({ ...manual, latitude: event.target.value })} placeholder="Latitude (e.g. 24.8607)" aria-label="Latitude" />
            <input value={manual.longitude} onChange={event => setManual({ ...manual, longitude: event.target.value })} placeholder="Longitude (e.g. 67.0011)" aria-label="Longitude" />
          </div>
          <button>Calculate Qibla</button>
        </form>
      </div>
      <div className="qibla-result">
        {location ? <>
          <div className="compass-dial">
            <span className="north">N</span><span className="east">E</span><span className="south">S</span><span className="west">W</span>
            <div className="qibla-guide" style={{ transform: `translate(-50%, -50%) rotate(${relativeDirection}deg)` }}>
              <span className="qibla-guide-line" />
              <span className="qibla-guide-dot" />
            </div>
            <Navigation className="qibla-arrow" style={{ transform: `translate(-50%, -50%) rotate(${relativeDirection}deg)` }} />
            <span className="kaaba">☪</span>
          </div>
          <p className={`qibla-status ${aligned ? "aligned" : ""}`}>{aligned ? <><CheckCircle2 /> You are facing the Qibla</> : "Turn until the gold arrow points up"}</p>
          <h2 className="qibla-bearing">{Math.round(bearing)}° <small>Qibla bearing</small></h2>
          <div className="result-details">
            <p><MapPin /> {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</p>
            <p><Compass /> {heading == null ? "Enable compass to align your phone" : `Your heading ${Math.round(heading)}°${accuracy ? ` · ±${Math.round(accuracy)}°` : ""}`}</p>
            <p><Navigation /> {distance} km to the Kaaba</p>
          </div>
        </> : <div className="tool-empty"><Compass /><h2>Your compass will appear here</h2><p>Use your location or enter coordinates below.</p></div>}
      </div>
    </div></section>
    {showCalibration && <aside className="calibration-card" role="status"><RotateCcw /><div><strong>Calibrate your compass</strong><span>Move your phone in a figure-eight motion, then keep it level for the most accurate direction.</span></div><button onClick={() => setShowCalibration(false)} aria-label="Dismiss calibration advice"><X /></button></aside>}
  </main>;
}

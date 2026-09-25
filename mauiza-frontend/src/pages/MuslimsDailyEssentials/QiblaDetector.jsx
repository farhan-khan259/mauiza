import { useEffect, useMemo, useState } from "react";
import { Compass, LocateFixed, MapPin, Navigation, AlertCircle } from "lucide-react";
import PageHero from "../../components/PageHero/PageHero";
import { images } from "../../data/images";
import "./DailyEssentialsTools.css";

const KAABA = { latitude: 21.4225, longitude: 39.8262 };
const radians = value => value * Math.PI / 180;
const bearingFor = ({ latitude, longitude }) => (Math.atan2(
  Math.sin(radians(KAABA.longitude - longitude)) * Math.cos(radians(KAABA.latitude)),
  Math.cos(radians(latitude)) * Math.sin(radians(KAABA.latitude)) - Math.sin(radians(latitude)) * Math.cos(radians(KAABA.latitude)) * Math.cos(radians(KAABA.longitude - longitude))
) * 180 / Math.PI + 360) % 360;
const distanceFor = ({ latitude, longitude }) => 6371 * 2 * Math.asin(Math.sqrt(
  Math.sin((radians(KAABA.latitude - latitude)) / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(KAABA.latitude)) * Math.sin((radians(KAABA.longitude - longitude)) / 2) ** 2
));

export default function QiblaDetector() {
  const [location, setLocation] = useState(null);
  const [heading, setHeading] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState({ latitude: "", longitude: "" });
  const bearing = useMemo(() => location && bearingFor(location), [location]);

  useEffect(() => {
    const handler = event => setHeading(event.webkitCompassHeading ?? (event.alpha == null ? null : (360 - event.alpha) % 360));
    window.addEventListener("deviceorientation", handler, true);
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, []);

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
      { enableHighAccuracy: true, timeout: 12000 }
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

  const rotation = bearing == null ? 0 : bearing - (heading ?? 0);
  const distance = location ? Math.round(distanceFor(location)).toLocaleString() : "";

  return <main className="page tool-page">
    <PageHero title="Qibla Location Detector" subtitle="Find your direction to the Kaaba with your device location or coordinates." image={images.mosque} />
    <section className="section tool-section"><div className="container qibla-layout">
      <div className="tool-panel">
        <span className="eyebrow">ACCURATE DIRECTION</span>
        <h2>Find the Qibla from where you are</h2>
        <p>Allow location access for an accurate bearing. Device orientation is used when it is available.</p>
        <button className="tool-button" onClick={locate} disabled={loading}><LocateFixed />{loading ? "Finding your location..." : "Use my location"}</button>
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
            <Navigation className="qibla-arrow" style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }} />
            <span className="kaaba">☪</span>
          </div>
          <h2 className="qibla-bearing" style={{ margin: "18px 0 8px", lineHeight: 1.1 }}>{Math.round(bearing)}° <small style={{ display: "block", marginTop: "8px" }}>Qibla bearing</small></h2>
          <div className="result-details">
            <p><MapPin /> {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</p>
            <p><Compass /> {heading == null ? "Static compass - orientation unavailable" : `Device heading ${Math.round(heading)}°`}</p>
            <p><Navigation /> {distance} km to the Kaaba</p>
          </div>
        </> : <div className="tool-empty"><Compass /><h2>Your compass will appear here</h2><p>Use your location or enter coordinates below.</p></div>}
      </div>
    </div></section>
  </main>;
}

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Compass, LocateFixed, MapPin, Navigation, RotateCcw, Smartphone, X } from "lucide-react";
import PageHero from "../../components/PageHero/PageHero";
import { images } from "../../data/images";
import "./DailyEssentialsTools.css";

const KAABA = { latitude: 21.4224779, longitude: 39.8251832 };
const ALIGNMENT_THRESHOLD = 5;
const DIRECTIONS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

const toRadians = value => value * Math.PI / 180;
const toDegrees = value => value * 180 / Math.PI;
const normalizeAngle = value => ((value % 360) + 360) % 360;
const shortestAngleDifference = (target, current) => ((target - current + 540) % 360) - 180;

const getCompassDirection = angle => {
  const index = Math.round(normalizeAngle(angle) / 22.5) % 16;
  return DIRECTIONS[index];
};

const calculateQiblaBearing = ({ latitude, longitude }) => {
  const lat1 = toRadians(latitude);
  const lat2 = toRadians(KAABA.latitude);
  const deltaLon = toRadians(KAABA.longitude - longitude);

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  let bearing = toDegrees(Math.atan2(y, x));
  bearing = (bearing + 360) % 360;

  return bearing;
};

const calculateDistanceKm = ({ latitude, longitude }) => {
  const lat1 = toRadians(latitude);
  const lat2 = toRadians(KAABA.latitude);
  const deltaLat = toRadians(KAABA.latitude - latitude);
  const deltaLon = toRadians(KAABA.longitude - longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
};

const smoothAngle = (previousAngle, newAngle, smoothingFactor = 0.22) => {
  if (previousAngle == null || !Number.isFinite(previousAngle)) {
    return normalizeAngle(newAngle);
  }

  const difference = ((newAngle - previousAngle + 540) % 360) - 180;
  return normalizeAngle(previousAngle + difference * smoothingFactor);
};

const getDeviceHeading = event => {
  if (!event) return null;

  if (Number.isFinite(event.webkitCompassHeading)) {
    return normalizeAngle(event.webkitCompassHeading);
  }

  if (Number.isFinite(event.alpha)) {
    return normalizeAngle(360 - event.alpha);
  }

  return null;
};

const KaabaIcon = () => (
  <svg viewBox="0 0 120 120" className="kaaba-illustration" aria-hidden="true">
    <defs>
      <linearGradient id="kaabaGlow" x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0%" stopColor="#f4db9d" />
        <stop offset="50%" stopColor="#d7a444" />
        <stop offset="100%" stopColor="#a67a2a" />
      </linearGradient>
    </defs>
    <path d="M60 16 L97 36 L97 79 L60 100 L23 79 L23 36 Z" fill="rgba(255,255,255,0.08)" stroke="url(#kaabaGlow)" strokeWidth="2.5" />
    <path d="M60 16 L60 100 M23 36 L97 36 M23 79 L97 79" stroke="rgba(255,255,255,0.12)" />
    <path d="M60 26 L78 36 L60 45 L42 36 Z" fill="rgba(255,255,255,0.16)" stroke="url(#kaabaGlow)" strokeWidth="2" />
    <path d="M42 36 L42 79 L60 91 L78 79 L78 36" fill="rgba(12, 118, 108, 0.10)" stroke="url(#kaabaGlow)" strokeWidth="2" />
    <path d="M50 52 L60 62 L70 52" stroke="url(#kaabaGlow)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  </svg>
);

export default function QiblaDetector() {
  const [location, setLocation] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [loading, setLoading] = useState(false);
  const [manualLocation, setManualLocation] = useState({ latitude: "", longitude: "" });
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [deviceHeading, setDeviceHeading] = useState(null);
  const [sensorAccuracy, setSensorAccuracy] = useState(null);
  const [sensorPermission, setSensorPermission] = useState("unknown");
  const [sensorAvailable, setSensorAvailable] = useState(false);
  const [compassEnabled, setCompassEnabled] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);

  const supportsOrientation = typeof window !== "undefined" && "DeviceOrientationEvent" in window;
  const qiblaBearing = useMemo(() => (location ? calculateQiblaBearing(location) : null), [location]);
  const directionalLabel = qiblaBearing == null ? "--" : getCompassDirection(qiblaBearing);
  const effectiveHeading = compassEnabled && deviceHeading != null ? deviceHeading : null;
  const relativeQiblaAngle = qiblaBearing == null || effectiveHeading == null ? 0 : normalizeAngle(qiblaBearing - effectiveHeading);
  const turnAngle = effectiveHeading == null ? 0 : shortestAngleDifference(qiblaBearing, effectiveHeading);
  const aligned = effectiveHeading != null && Math.abs(turnAngle) <= ALIGNMENT_THRESHOLD;
  const distanceKm = location ? calculateDistanceKm(location) : null;

  useEffect(() => {
    setSensorAvailable(Boolean(supportsOrientation));
    if (!supportsOrientation) {
      setSensorPermission("unsupported");
    }
  }, [supportsOrientation]);

  useEffect(() => {
    if (!compassEnabled || !supportsOrientation) {
      return undefined;
    }

    const handleOrientation = event => {
      const nextHeading = getDeviceHeading(event);
      if (nextHeading == null) {
        return;
      }

      setSensorAvailable(true);
      setDeviceHeading(current => smoothAngle(current, nextHeading, 0.25));

      if (Number.isFinite(event.webkitCompassAccuracy)) {
        setSensorAccuracy(event.webkitCompassAccuracy);
      }
    };

    window.addEventListener("deviceorientationabsolute", handleOrientation, true);
    window.addEventListener("deviceorientation", handleOrientation, true);

    return () => {
      window.removeEventListener("deviceorientationabsolute", handleOrientation, true);
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, [compassEnabled, supportsOrientation]);

  useEffect(() => {
    if (sensorAccuracy == null) {
      setShowCalibration(false);
      return;
    }

    if (sensorAccuracy > 35) {
      setShowCalibration(true);
    } else {
      setShowCalibration(false);
    }
  }, [sensorAccuracy]);

  const findMyQibla = () => {
    if (!navigator.geolocation) {
      setLocationError("Location services are not supported by this browser. Enter coordinates manually instead.");
      setShowManualFallback(true);
      return;
    }

    setLoading(true);
    setLocationError("");
    setShowManualFallback(false);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextLocation = { latitude: coords.latitude, longitude: coords.longitude };
        setLocation(nextLocation);
        setLocationAccuracy(coords.accuracy ?? null);
        setLoading(false);
      },
      error => {
        setLoading(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Location permission is required for automatic Qibla detection.");
        } else {
          setLocationError("We could not determine your location. Try again or select your location manually.");
        }
        setShowManualFallback(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const enableCompass = async () => {
    if (!supportsOrientation) {
      setSensorPermission("unsupported");
      setLocationError("Your device does not provide a compass sensor. Your Qibla direction is still available.");
      return;
    }

    try {
      if (typeof window.DeviceOrientationEvent !== "undefined" && typeof window.DeviceOrientationEvent.requestPermission === "function") {
        const permission = await window.DeviceOrientationEvent.requestPermission();
        if (permission !== "granted") {
          setSensorPermission("denied");
          setLocationError("Compass access was not granted. You can still use the calculated Qibla bearing.");
          return;
        }
      }

      setCompassEnabled(true);
      setSensorPermission("granted");
      setLocationError("");
    } catch (error) {
      setSensorPermission("denied");
      setLocationError(error?.message || "Compass access is unavailable on this device.");
    }
  };

  const handleManualSubmit = event => {
    event.preventDefault();
    const latitude = Number(manualLocation.latitude);
    const longitude = Number(manualLocation.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      setLocationError("Enter valid latitude and longitude values.");
      return;
    }

    setLocation({ latitude, longitude });
    setLocationAccuracy(null);
    setLocationError("");
    setShowManualFallback(false);
  };

  const turnDirection = (() => {
    if (effectiveHeading == null) {
      return `Qibla bearing: ${Math.round(qiblaBearing ?? 0)}° ${directionalLabel}`;
    }

    if (Math.abs(turnAngle) <= ALIGNMENT_THRESHOLD) {
      return "✓ You are facing Qibla";
    }

    const direction = turnAngle > 0 ? "right" : "left";
    return `Qibla is ${Math.abs(Math.round(turnAngle))}° to your ${direction}`;
  })();

  const sensorStatus = sensorPermission === "granted" && sensorAvailable ? "Compass Active" : sensorPermission === "denied" ? "Compass permission denied" : sensorAvailable ? "Compass available" : "Compass not available";

  return (
    <main className="page tool-page">
      <PageHero title="Qibla Finder" subtitle="Use your location and device orientation to find the Kaaba." image={images.mosque} />

      <section className="section tool-section">
        <div className="container qibla-layout">
          <div className="tool-panel qibla-controls">
            <span className="eyebrow">QIBLA FINDER</span>
            <h2>Find the Kaaba from here</h2>
            <p>
              Your Qibla direction is calculated from your actual GPS coordinates to the Kaaba using the
              great-circle initial bearing. If a compass is available, the Kaaba marker will respond to your
              device heading in real time.
            </p>

            <button className="tool-button" onClick={findMyQibla} disabled={loading} type="button">
              <LocateFixed />
              {loading ? "Finding your location..." : "Find My Qibla"}
            </button>

            {supportsOrientation && (
              <button className="tool-button tool-button-secondary" onClick={enableCompass} type="button">
                <Smartphone />
                {sensorPermission === "granted" ? "Compass enabled" : "Enable Compass"}
              </button>
            )}

            {locationError && (
              <p className="tool-alert">
                <AlertCircle />
                {locationError}
              </p>
            )}

            {showManualFallback && (
              <form className="tool-form" onSubmit={handleManualSubmit}>
                <strong>Use manual coordinates</strong>
                <div>
                  <input
                    value={manualLocation.latitude}
                    onChange={event => setManualLocation({ ...manualLocation, latitude: event.target.value })}
                    placeholder="Latitude"
                    aria-label="Latitude"
                  />
                  <input
                    value={manualLocation.longitude}
                    onChange={event => setManualLocation({ ...manualLocation, longitude: event.target.value })}
                    placeholder="Longitude"
                    aria-label="Longitude"
                  />
                </div>
                <button type="submit">Calculate Qibla</button>
              </form>
            )}

          </div>

          <div className="qibla-result">
            {location && qiblaBearing != null ? (
              <>
                <div className={`qibla-view ${aligned ? "aligned" : ""}`}>
                  <div className="qibla-ring" aria-label="Qibla direction ring">
                    <span className="direction-label north">N</span>
                    <span className="direction-label east">E</span>
                    <span className="direction-label south">S</span>
                    <span className="direction-label west">W</span>
                  </div>

                  <div className="alignment-guide" aria-hidden="true" />

                  <div
                    className="qibla-marker"
                    style={{ transform: `translate(-50%, -50%) rotate(${relativeQiblaAngle}deg)` }}
                    aria-label={`Kaaba direction ${Math.round(relativeQiblaAngle)} degrees from the current heading`}
                  >
                    <div className="marker-head">
                      <KaabaIcon />
                      <span className="marker-tag">QIBLA</span>
                    </div>
                  </div>

                  <div className="center-badge">{aligned ? "✓" : "●"}</div>
                </div>

                <div className="qibla-summary">
                  <p className="qibla-status-text">
                    {aligned ? <><CheckCircle2 /> You are facing Qibla</> : turnDirection}
                  </p>
                  <h2 className="qibla-bearing">{Math.round(qiblaBearing)}° <small>{directionalLabel}</small></h2>
                </div>

                <div className="result-details">
                  <div className="detail-row">
                    <span className="detail-label"><Compass /> Qibla bearing</span>
                    <strong>{Math.round(qiblaBearing)}° {directionalLabel}</strong>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label"><Navigation /> Turn guidance</span>
                    <strong>{aligned ? "Aligned" : turnDirection}</strong>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label"><MapPin /> Your location</span>
                    <strong>
                      {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°
                    </strong>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label"><LocateFixed /> Distance</span>
                    <strong>{Math.round(distanceKm).toLocaleString()} km</strong>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label"><Smartphone /> Sensor status</span>
                    <strong>{sensorStatus}</strong>
                  </div>
                  {locationAccuracy !== null && (
                    <div className="detail-row">
                      <span className="detail-label"><Compass /> Location accuracy</span>
                      <strong>±{Math.round(locationAccuracy)} m</strong>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="tool-empty">
                <Compass />
                <h2>Your Qibla finder will appear here</h2>
                <p>Use your location or enter coordinates to calculate the Kaaba direction.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {showCalibration && (
        <aside className="calibration-card" role="status">
          <RotateCcw />
          <div>
            <strong>Calibrate your compass</strong>
            <span>
              Move your phone in a figure-8 motion for a few seconds. Keep it flat and away from metal
              objects or speakers.
            </span>
          </div>
          <button type="button" onClick={() => setShowCalibration(false)} aria-label="Dismiss calibration advice">
            <X />
          </button>
        </aside>
      )}

    </main>
  );
}

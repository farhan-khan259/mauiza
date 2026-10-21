import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Compass, LocateFixed, MapPin, Navigation, RotateCcw, Smartphone, X } from "lucide-react";
import PageHero from "../../components/PageHero/PageHero";
import { images } from "../../data/images";
import { getAccurateCurrentPosition, getLocationErrorMessage } from "../../utils/geolocation";
import { cardinalOffset, normalizeAngle, qiblaBearing, qiblaDistance, shortestArc, smoothHeading } from "../../utils/qibla";
import "./DailyEssentialsTools.css";

const ALIGNMENT_THRESHOLD = 5;
const DIRECTIONS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

const toRadians = value => value * Math.PI / 180;
const toDegrees = value => value * 180 / Math.PI;
const shortestAngleDifference = shortestArc;

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

const getScreenOrientationAngle = () => {
  const angle = Number(window.screen?.orientation?.angle ?? window.orientation ?? 0);
  return Number.isFinite(angle) ? angle : 0;
};

const getDeviceHeading = event => {
  if (!event) return null;

  if (Number.isFinite(event.webkitCompassHeading) && event.webkitCompassHeading >= 0) {
    return { heading: normalizeAngle(event.webkitCompassHeading), source: "iOS compass" };
  }

  const isAbsoluteReading = event.absolute === true || event.type === "deviceorientationabsolute";
  if (isAbsoluteReading && Number.isFinite(event.alpha)) {
    return {
      heading: normalizeAngle(360 - event.alpha + getScreenOrientationAngle()),
      source: "Absolute device orientation"
    };
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
  const [headingSource, setHeadingSource] = useState("");
  const [headingUpdatedAt, setHeadingUpdatedAt] = useState(null);
  const [deviceTilt, setDeviceTilt] = useState(null);
  const [declination, setDeclination] = useState(null);
  const [declinationWarning, setDeclinationWarning] = useState("");
  const [sensorClock, setSensorClock] = useState(Date.now());
  const absoluteEventTimeRef = useRef(0);
  const declinationRef = useRef(0);

  const supportsOrientation = typeof window !== "undefined" && "DeviceOrientationEvent" in window;
  const bearing = useMemo(() => (location ? qiblaBearing(location) : null), [location]);
  const directionalLabel = bearing == null ? "--" : getCompassDirection(bearing);
  const headingIsFresh = headingUpdatedAt != null && sensorClock - headingUpdatedAt <= 3000;
  const effectiveHeading = compassEnabled && deviceHeading != null && headingIsFresh ? deviceHeading : null;
  const relativeQiblaAngle = bearing == null
    ? 0
    : effectiveHeading == null ? bearing : normalizeAngle(shortestArc(bearing, effectiveHeading));
  const turnAngle = effectiveHeading == null ? 0 : shortestAngleDifference(bearing, effectiveHeading);
  const aligned = effectiveHeading != null && Math.abs(turnAngle) <= ALIGNMENT_THRESHOLD;
  const distanceKm = location ? qiblaDistance(location) : null;

  useEffect(() => {
    if (!location) return undefined;
    let cancelled = false;
    import("geomagnetism").then(module => {
      const geomagnetism = module.default || module;
      const value = geomagnetism.model(new Date(), { allowOutOfBoundsModel: true }).point([location.latitude, location.longitude]).decl;
      if (!cancelled && Number.isFinite(value)) { declinationRef.current = value; setDeclination(value); setDeclinationWarning(""); }
    }).catch(() => { if (!cancelled) { declinationRef.current = 0; setDeclination(null); setDeclinationWarning("Magnetic model unavailable; the compass points to magnetic north."); } });
    return () => { cancelled = true; };
  }, [location]);

  useEffect(() => {
    if (!supportsOrientation) {
      setSensorPermission("unsupported");
    }
  }, [supportsOrientation]);

  useEffect(() => {
    if (!compassEnabled || !supportsOrientation) {
      return undefined;
    }

    const handleOrientation = event => {
      const reading = getDeviceHeading(event);
      if (reading == null) {
        return;
      }

      const isAbsoluteEvent = event.type === "deviceorientationabsolute";
      const isIosHeading = Number.isFinite(event.webkitCompassHeading);
      if (isAbsoluteEvent) absoluteEventTimeRef.current = Date.now();
      if (!isAbsoluteEvent && !isIosHeading && Date.now() - absoluteEventTimeRef.current < 1500) return;

      setSensorAvailable(true);
      setHeadingSource(reading.source);
      setHeadingUpdatedAt(Date.now());
      const trueHeading = normalizeAngle(reading.heading + declinationRef.current);
      setDeviceHeading(current => smoothHeading(current, trueHeading));

      if (Number.isFinite(event.beta) && Number.isFinite(event.gamma)) {
        setDeviceTilt(Math.max(Math.abs(event.beta), Math.abs(event.gamma)));
      }

      if (Number.isFinite(event.webkitCompassAccuracy) && event.webkitCompassAccuracy >= 0) {
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
    if (!compassEnabled || deviceHeading != null) return undefined;
    const timeout = window.setTimeout(() => {
      setLocationError("No earth-referenced compass heading was received. Keep using the numeric Qibla bearing, or try another mobile browser over HTTPS.");
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [compassEnabled, deviceHeading]);

  useEffect(() => {
    if (!compassEnabled) return undefined;
    const interval = window.setInterval(() => setSensorClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [compassEnabled]);

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

  const findMyQibla = async () => {
    setLoading(true);
    setLocationError("");
    setShowManualFallback(false);
    try {
      const position = await getAccurateCurrentPosition();
      setLocation({ latitude: position.latitude, longitude: position.longitude });
      setLocationAccuracy(position.accuracy);
    } catch (error) {
      setLocationError(getLocationErrorMessage(error));
      setShowManualFallback(true);
    } finally {
      setLoading(false);
    }
  };

  const enableCompass = async () => {
    if (!window.isSecureContext) {
      setSensorPermission("unsupported");
      setLocationError("Live compass guidance requires HTTPS. The calculated north-referenced Qibla bearing remains available.");
      return;
    }

    if (!supportsOrientation) {
      setSensorPermission("unsupported");
      setLocationError("Your device does not provide a compass sensor. Your Qibla direction is still available.");
      return;
    }

    try {
      if (typeof window.DeviceOrientationEvent !== "undefined" && typeof window.DeviceOrientationEvent.requestPermission === "function") {
        let permission;
        try {
          permission = await window.DeviceOrientationEvent.requestPermission(true);
        } catch (permissionError) {
          if (permissionError?.name !== "TypeError") throw permissionError;
          permission = await window.DeviceOrientationEvent.requestPermission();
        }
        if (permission !== "granted") {
          setSensorPermission("denied");
          setLocationError("Compass access was not granted. You can still use the calculated Qibla bearing.");
          return;
        }
      }

      setDeviceHeading(null);
      setSensorAvailable(false);
      setHeadingUpdatedAt(null);
      absoluteEventTimeRef.current = 0;
      setCompassEnabled(true);
      setSensorPermission("granted");
      setShowCalibration(true);
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
      return `Face ${Math.round(bearing ?? 0)}° from North — ${cardinalOffset(bearing ?? 0)}`;
    }

    if (Math.abs(turnAngle) <= ALIGNMENT_THRESHOLD) {
      return "✓ You are facing Qibla";
    }

    const direction = turnAngle > 0 ? "right" : "left";
    return `Qibla is ${Math.abs(Math.round(turnAngle))}° to your ${direction}`;
  })();

  const sensorStatus = sensorPermission === "granted" && sensorAvailable && headingIsFresh
    ? `Compass active${headingSource ? ` · ${headingSource}` : ""}`
    : sensorPermission === "granted" && sensorAvailable
      ? "Compass reading paused"
    : sensorPermission === "granted"
      ? "Waiting for an absolute heading"
      : sensorPermission === "denied"
        ? "Compass permission denied"
        : supportsOrientation ? "Compass not enabled" : "Compass not available";

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
            {location && bearing != null ? (
              <>
                <div className={`qibla-view ${aligned ? "aligned" : ""}`}>
                  <div
                    className="qibla-ring"
                    style={{ "--compass-heading": `${effectiveHeading ?? 0}deg` }}
                    aria-label="Earth-referenced compass direction ring"
                  >
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
                  <h2 className="qibla-bearing">{Math.round(bearing)}° <small>{directionalLabel}</small></h2>
                </div>

                <div className="result-details">
                  <div className="detail-row">
                    <span className="detail-label"><Compass /> Qibla bearing</span>
                    <strong>{Math.round(bearing)}° · {cardinalOffset(bearing)}</strong>
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
                  {effectiveHeading !== null && (
                    <div className="detail-row">
                      <span className="detail-label"><Compass /> Device heading</span>
                      <strong>{Math.round(effectiveHeading)}° {getCompassDirection(effectiveHeading)}</strong>
                    </div>
                  )}
                  <div className="detail-row">
                    <span className="detail-label"><Compass /> Magnetic declination</span>
                    <strong>{declination == null ? "Unavailable" : `${declination >= 0 ? "+" : ""}${declination.toFixed(1)}° east`}</strong>
                  </div>
                  {declinationWarning && <div className="tool-alert qibla-inline-warning"><AlertCircle />{declinationWarning}</div>}
                  {compassEnabled && deviceTilt !== null && deviceTilt > 45 && (
                    <div className="tool-alert qibla-inline-warning">
                      <AlertCircle /> Keep the phone flat for more reliable compass guidance.
                    </div>
                  )}
                  {headingUpdatedAt && sensorClock - headingUpdatedAt > 3000 && (
                    <div className="tool-alert qibla-inline-warning">
                      <AlertCircle /> Compass readings have stopped. Move the phone slightly or re-enable the compass.
                    </div>
                  )}
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

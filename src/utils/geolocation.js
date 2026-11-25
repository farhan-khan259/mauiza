const DEFAULT_TARGET_ACCURACY_METERS = 25;
const DEFAULT_MAXIMUM_ACCURACY_METERS = 50;
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_MAX_POSITION_AGE_MS = 15000;

export class LocationDetectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "LocationDetectionError";
    this.code = code;
    Object.assign(this, details);
  }
}

function isValidPosition(position) {
  const latitude = Number(position?.coords?.latitude);
  const longitude = Number(position?.coords?.longitude);
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function normalizePosition(position) {
  return {
    latitude: Number(position.coords.latitude),
    longitude: Number(position.coords.longitude),
    accuracy: Number.isFinite(position.coords.accuracy) ? Math.max(0, Number(position.coords.accuracy)) : Infinity,
    altitude: Number.isFinite(position.coords.altitude) ? Number(position.coords.altitude) : null,
    timestamp: Number(position.timestamp) || Date.now(),
    source: "device",
  };
}

function geolocationError(error) {
  if (error?.code === 1) {
    return new LocationDetectionError("permission-denied", "Location permission was denied. Enable precise location access in your browser or device settings and try again.");
  }
  if (error?.code === 2) {
    return new LocationDetectionError("position-unavailable", "Your device could not determine its GPS position. Move near a window or outdoors, then try again.");
  }
  return new LocationDetectionError("timeout", "Location detection timed out before an accurate GPS fix was available. Please try again.");
}

export function getLocationErrorMessage(error) {
  if (error instanceof LocationDetectionError) return error.message;
  return "We could not determine your location. Check location permissions and try again.";
}

export async function getAccurateCurrentPosition(options = {}) {
  const {
    targetAccuracyMeters = DEFAULT_TARGET_ACCURACY_METERS,
    maximumAccuracyMeters = DEFAULT_MAXIMUM_ACCURACY_METERS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxPositionAgeMs = DEFAULT_MAX_POSITION_AGE_MS,
  } = options;

  if (typeof window !== "undefined" && window.isSecureContext === false) {
    throw new LocationDetectionError("insecure-context", "Precise location requires a secure HTTPS connection.");
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new LocationDetectionError("unsupported", "Location services are not supported by this browser.");
  }

  if (navigator.permissions?.query) {
    try {
      const permission = await navigator.permissions.query({ name: "geolocation" });
      if (permission.state === "denied") {
        throw new LocationDetectionError("permission-denied", "Location permission is blocked. Enable precise location access in your browser settings and try again.");
      }
    } catch (error) {
      if (error instanceof LocationDetectionError) throw error;
      // Safari and older browsers can reject unsupported permission queries.
    }
  }

  return new Promise((resolve, reject) => {
    let bestPosition = null;
    let lastError = null;
    let watchId = null;
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      if (watchId !== null && navigator.geolocation.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
    };

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };

    const acceptBestOrReject = (fallbackError) => {
      if (bestPosition && bestPosition.accuracy <= maximumAccuracyMeters) {
        finish(resolve, bestPosition);
        return;
      }
      if (bestPosition) {
        finish(reject, new LocationDetectionError(
          "poor-accuracy",
          `The available location is only accurate to about ${Math.round(bestPosition.accuracy)} metres. Enable Precise Location, move near a window or outdoors, and try again so an incorrect pin is not shown.`,
          { accuracy: bestPosition.accuracy }
        ));
        return;
      }
      finish(reject, fallbackError || new LocationDetectionError("timeout", "Location detection timed out before a GPS fix was available. Please try again."));
    };

    const onPosition = (position) => {
      if (!isValidPosition(position)) return;
      const normalized = normalizePosition(position);
      if (Date.now() - normalized.timestamp > maxPositionAgeMs) return;
      if (!bestPosition || normalized.accuracy < bestPosition.accuracy) bestPosition = normalized;
      if (normalized.accuracy <= targetAccuracyMeters) finish(resolve, normalized);
    };

    const onError = (error) => {
      lastError = geolocationError(error);
      if (error?.code === 1) {
        finish(reject, lastError);
        return;
      }
      if (error?.code === 3) acceptBestOrReject(lastError);
    };

    const timer = setTimeout(() => acceptBestOrReject(lastError), timeoutMs);
    const positionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs };

    try {
      if (typeof navigator.geolocation.watchPosition === "function") {
        watchId = navigator.geolocation.watchPosition(onPosition, onError, positionOptions);
      } else {
        navigator.geolocation.getCurrentPosition(onPosition, onError, positionOptions);
      }
    } catch (error) {
      finish(reject, new LocationDetectionError("unavailable", error?.message || "Location detection could not be started."));
    }
  });
}


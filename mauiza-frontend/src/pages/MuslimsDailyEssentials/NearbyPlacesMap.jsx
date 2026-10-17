import { useEffect, useRef, useState } from "react";

const DEFAULT_CENTER = { lat: 21.4225, lng: 39.8262 };
const markerColors = {
  Mosque: "#19c5ae",
  "Halal Food": "#e5b657",
  "Islamic Center": "#73a9ff",
};

let googleMapsLoader;

function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googleMapsLoader) return googleMapsLoader;

  googleMapsLoader = new Promise((resolve, reject) => {
    const callbackName = `mauizaGoogleMapsReady${Date.now()}`;
    const script = document.createElement("script");
    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.google.maps);
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      delete window[callbackName];
      googleMapsLoader = null;
      reject(new Error("Google Maps could not be loaded."));
    };
    document.head.appendChild(script);
  });

  return googleMapsLoader;
}

function createPlacePopup(place) {
  const content = document.createElement("div");
  content.className = "place-map-popup";
  const category = document.createElement("small");
  category.textContent = place.category;
  const title = document.createElement("strong");
  title.textContent = place.name;
  const address = document.createElement("span");
  address.textContent = place.address;
  const route = document.createElement("span");
  route.textContent = place.distanceKm != null && place.travelTime
    ? `${place.distanceKm} km driving · ${place.travelTime}`
    : "Route distance unavailable";
  const directions = document.createElement("a");
  directions.href = place.directionsUrl;
  directions.target = "_blank";
  directions.rel = "noreferrer";
  directions.textContent = "Directions";
  content.append(category, title, address, route, directions);
  return content;
}

export default function NearbyPlacesMap({ center, places, radiusKm, accuracy }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const browserApiKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !browserApiKey) return undefined;
    let cancelled = false;

    loadGoogleMaps(browserApiKey)
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        setMapReady(true);
      })
      .catch((error) => !cancelled && setMapError(error.message));

    return () => {
      cancelled = true;
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
      mapRef.current = null;
    };
  }, [browserApiKey]);

  useEffect(() => {
    const maps = window.google?.maps;
    const map = mapRef.current;
    if (!maps || !map || !mapReady) return;

    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];
    if (!center) {
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(13);
      return;
    }

    const userPosition = { lat: Number(center.latitude), lng: Number(center.longitude) };
    const bounds = new maps.LatLngBounds(userPosition);
    const infoWindow = new maps.InfoWindow();

    if (Number.isFinite(accuracy)) {
      overlaysRef.current.push(new maps.Circle({
        map,
        center: userPosition,
        radius: accuracy,
        strokeColor: "#ffffff",
        strokeOpacity: 0.75,
        strokeWeight: 1,
        fillColor: "#28b6a5",
        fillOpacity: 0.12,
      }));
    }

    const userMarker = new maps.Marker({
      map,
      position: userPosition,
      title: "Your detected location",
      icon: {
        path: maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: "#0b9487",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
      },
    });
    userMarker.addListener("click", () => {
      infoWindow.setContent("Your detected location");
      infoWindow.open({ map, anchor: userMarker });
    });
    overlaysRef.current.push(userMarker);

    places.forEach((place) => {
      const position = { lat: Number(place.latitude), lng: Number(place.longitude) };
      if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;
      bounds.extend(position);
      const marker = new maps.Marker({
        map,
        position,
        title: place.name,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: markerColors[place.category] || "#d7a84f",
          fillOpacity: 1,
          strokeColor: "#071d1a",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => {
        infoWindow.setContent(createPlacePopup(place));
        infoWindow.open({ map, anchor: marker });
      });
      overlaysRef.current.push(marker);
    });

    if (places.length) {
      map.fitBounds(bounds, 38);
    } else {
      map.setCenter(userPosition);
      map.setZoom(Math.max(10, Math.min(16, 14 - Math.log2(Math.max(1, Number(radiusKm))))));
    }
  }, [accuracy, center, places, radiusKm, mapReady]);

  if (!browserApiKey) {
    return <div className="map-frame map-configuration-error">Google Map is not configured. Add VITE_GOOGLE_MAPS_BROWSER_KEY and restart the frontend.</div>;
  }

  return (
    <div className="map-frame">
      <div ref={containerRef} className="nearby-map" aria-label="Google Map of nearby mosques, halal food, and Islamic centres" />
      {mapError && <p className="map-hint">{mapError}</p>}
      {center && (
        <div className="map-legend" aria-label="Map marker legend">
          <span className="user">Your location</span>
          <span className="mosque">Mosques</span>
          <span className="halal">Halal food</span>
          <span className="center">Islamic centres</span>
        </div>
      )}
    </div>
  );
}

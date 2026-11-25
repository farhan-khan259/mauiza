import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const colors = { mosque: "#19c5ae", islamic_center: "#73a9ff", halal_food: "#e5b657", halal_shop: "#f08a5d" };
const empty = { type: "FeatureCollection", features: [] };
const circle = (center, radiusKm, points = 96) => ({ type: "Feature", geometry: { type: "Polygon", coordinates: [[...Array(points + 1)].map((_, i) => { const angle = i / points * Math.PI * 2, lat = center.latitude + radiusKm / 111.32 * Math.sin(angle), lng = center.longitude + radiusKm / (111.32 * Math.max(.2, Math.cos(center.latitude * Math.PI / 180))) * Math.cos(angle); return [lng, lat]; })] } });

export default function NearbyPlacesMap({ center, places, radiusKm, accuracy, onMoveUser, onSearchArea, onSelect }) {
  const container = useRef(null), mapRef = useRef(null), userMarker = useRef(null), origin = useRef(null);
  useEffect(() => {
    const map = new maplibregl.Map({ container: container.current, style: "https://tiles.openfreemap.org/styles/liberty", center: [0, 20], zoom: 1.6, dragRotate: false, pitchWithRotate: false, attributionControl: false });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right"); map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.on("load", () => {
      map.addSource("places", { type: "geojson", data: empty, cluster: true, clusterRadius: 42, clusterMaxZoom: 15 });
      map.addLayer({ id: "clusters", type: "circle", source: "places", filter: ["has", "point_count"], paint: { "circle-color": "#0b766c", "circle-radius": ["step", ["get", "point_count"], 17, 20, 22, 60, 28], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
      map.addLayer({ id: "cluster-count", type: "symbol", source: "places", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 }, paint: { "text-color": "#fff" } });
      map.addLayer({ id: "places-dot", type: "circle", source: "places", filter: ["!", ["has", "point_count"]], paint: { "circle-color": ["get", "color"], "circle-radius": 8, "circle-opacity": ["get", "opacity"], "circle-stroke-width": 2, "circle-stroke-color": "#102f2a" } });
      map.addSource("radius", { type: "geojson", data: empty }); map.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#188f83", "line-width": 2, "line-dasharray": [3, 3] } });
      map.addSource("accuracy", { type: "geojson", data: empty }); map.addLayer({ id: "accuracy-fill", type: "fill", source: "accuracy", paint: { "fill-color": "#258ee8", "fill-opacity": .12 } });
      map.on("click", "places-dot", event => onSelect?.(event.features?.[0]?.properties?.id)); map.on("click", "clusters", async event => { const feature = event.features?.[0]; const zoom = await map.getSource("places").getClusterExpansionZoom(feature.properties.cluster_id); map.easeTo({ center: feature.geometry.coordinates, zoom }); });
      mapRef.current = map;
    });
    return () => { userMarker.current?.remove(); map.remove(); mapRef.current = null; };
  }, []);
  useEffect(() => { const map = mapRef.current; if (!map?.isStyleLoaded()) return; map.getSource("places")?.setData({ type: "FeatureCollection", features: places.map(place => ({ type: "Feature", geometry: { type: "Point", coordinates: [place.longitude, place.latitude] }, properties: { id: place.id, color: colors[place.category] || "#e5b657", opacity: ['possible', 'reported_not_halal'].includes(place.halal?.level) || place.reportedClosed ? .55 : 1 } })) }); }, [places]);
  useEffect(() => { const map = mapRef.current; if (!map?.isStyleLoaded() || !center) return; origin.current = center; map.getSource("radius")?.setData({ type: "FeatureCollection", features: [circle(center, Number(radiusKm))] }); map.getSource("accuracy")?.setData(Number(accuracy) > 15 ? { type: "FeatureCollection", features: [circle(center, accuracy / 1000)] } : empty); userMarker.current?.remove(); const dot = document.createElement("div"); dot.className = "finder-user-dot"; userMarker.current = new maplibregl.Marker({ element: dot, draggable: Number(accuracy) > 150 }).setLngLat([center.longitude, center.latitude]).addTo(map); userMarker.current.on("dragend", () => { const p = userMarker.current.getLngLat(); onMoveUser?.({ latitude: p.lat, longitude: p.lng, source: "drag" }); }); map.easeTo({ center: [center.longitude, center.latitude], zoom: 16.5 }); }, [center, radiusKm, accuracy]);
  return <div className="map-frame"><div ref={container} className="nearby-map" aria-label="Map of nearby mosques and halal places" />{center && <button className="search-map-area" type="button" onClick={() => { const point = mapRef.current.getCenter(); onSearchArea?.({ latitude: point.lat, longitude: point.lng, source: "map" }); }}>Search this area</button>}<div className="map-legend"><span className="user">Your location</span><span className="mosque">Mosques</span><span className="halal">Halal food</span><span className="center">Islamic centres</span></div><p className="osm-attribution">© OpenStreetMap contributors</p></div>;
}

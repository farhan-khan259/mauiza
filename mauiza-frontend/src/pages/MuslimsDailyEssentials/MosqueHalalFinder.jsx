import { useState } from "react";
import { LocateFixed, Map, MapPin, Search, Store, Building2, AlertCircle } from "lucide-react";
import PageHero from "../../components/PageHero/PageHero";
import { images } from "../../data/images";
import "./DailyEssentialsTools.css";

const apiBaseUrl = (import.meta.env.VITE_API_URL || "https://mauiza-backend.onrender.com").replace(/\/+$/, "");
const defaultMapCenter = { latitude: 21.4225, longitude: 39.8262 };

function mapUrl(center, radius) {
  const latitude = Number(center.latitude);
  const longitude = Number(center.longitude);
  const span = Number(radius) / 55;
  const bbox = `${longitude - span},${latitude - span},${longitude + span},${latitude + span}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude},${longitude}`;
}

export default function MosqueHalalFinder() {
  const [center, setCenter] = useState(null);
  const [query, setQuery] = useState("");
  const [radius, setRadius] = useState("5");
  const [filter, setFilter] = useState("All");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [places, setPlaces] = useState([]);
  const [view, setView] = useState("map");

  const find = async (coords, options = {}) => {
    const searchRadius = options.radius ?? radius;
    const searchFilter = options.category ?? filter;
    setCenter(coords);
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/nearby-places?latitude=${coords.latitude}&longitude=${coords.longitude}&radius=${searchRadius}&category=${encodeURIComponent(searchFilter)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Nearby places could not be loaded.");
      setPlaces(data.results || []);
    } catch (error) {
      setPlaces([]);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const locate = () => {
    if (!navigator.geolocation) return setMessage("Location services are unavailable. Search for a city instead.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => find({ latitude: coords.latitude, longitude: coords.longitude }),
      () => setMessage("Location permission was denied. Search for a city instead."),
      { timeout: 12000 }
    );
  };

  const search = async event => {
    event.preventDefault();
    if (!query.trim()) return setMessage("Enter a city, area, or address first.");
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (!response.ok || !data.data?.length) throw new Error("That location could not be found. Try a more specific search.");
      find({ latitude: Number(data.data[0].latitude), longitude: Number(data.data[0].longitude) });
    } catch (error) {
      setLoading(false);
      setMessage(error.message);
    }
  };

  return <main className="page tool-page">
    <PageHero title="Mosque & Halal Finder" subtitle="Find mosques, Islamic centres, and halal food near the places you are." image={images.mosque} />
    <section className="section tool-section"><div className="container finder">
      <div className="finder-controls">
        <button className="tool-button" onClick={locate}><LocateFixed />Use my location</button>
        <form onSubmit={search}><Search /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="City, area, or address" /><button aria-label="Search"><Search /></button></form>
        <select value={radius} onChange={event => { const value = event.target.value; setRadius(value); if (center) find(center, { radius: value }); }} aria-label="Search radius">{[1, 5, 10, 25].map(value => <option key={value} value={value}>{value} km</option>)}</select>
      </div>
      <div className="finder-filters">
        {["All", "Mosques", "Halal Food", "Islamic Centers"].map(value => <button className={filter === value ? "active" : ""} onClick={() => { setFilter(value); if (center) find(center, { category: value }); }} key={value}>{value}</button>)}
        <span />
        <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}><Map />Map</button>
        <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><Store />List</button>
      </div>
      {message && <p className="tool-alert"><AlertCircle />{message}</p>}
      <div className="finder-content">
        {view === "map" ? <div className="map-frame" style={{ height: "420px", overflow: "hidden", borderRadius: "12px", position: "relative" }}><iframe title="Nearby mosques and halal places map" src={mapUrl(center || defaultMapCenter, radius)} loading="lazy" style={{ width: "100%", height: "100%", border: 0 }} />{!center && <p className="map-hint">Search for a place or use your location to find nearby results.</p>}</div> : <div className="places-list">{places.length ? places.map(place => <article key={place.id}><Building2 /><div><h3>{place.name}</h3><p>{place.address} · {place.distanceKm} km</p></div><a href={place.directionsUrl} target="_blank" rel="noreferrer">Directions</a></article>) : <div className="tool-empty"><MapPin /><h2>No places to show yet</h2><p>Use your location or search an area to see live nearby results.</p></div>}</div>}
      </div>
    </div></section>
  </main>;
}

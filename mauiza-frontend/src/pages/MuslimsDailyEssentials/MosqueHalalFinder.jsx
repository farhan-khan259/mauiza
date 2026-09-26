import { useState } from "react";
import { LocateFixed, Map, MapPin, Search, Store, Building2, AlertCircle } from "lucide-react";
import PageHero from "../../components/PageHero/PageHero";
import { useLanguage } from "../../context/LanguageContext";
import { images } from "../../data/images";
import "./DailyEssentialsTools.css";

const isLocalRuntime = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const apiBaseUrl = (import.meta.env.VITE_API_URL || (isLocalRuntime ? "http://localhost:5001" : "https://mauiza-backend.onrender.com")).replace(/\/+$/, "");
const defaultMapCenter = { latitude: 21.4225, longitude: 39.8262 };

function normalizeFilterValue(value) {
  const normalized = String(value || "").toLowerCase().replace(/[\s_-]+/g, " ").trim();

  if (["all", "tous"].includes(normalized)) return "All";
  if (["mosque", "mosques", "mosquée", "mosquées"].includes(normalized)) return "Mosques";
  if (["halal food", "halal-food", "nourriture halal"].includes(normalized)) return "Halal Food";
  if (["islamic center", "islamic centers", "islamic centre", "islamic centres", "centres islamiques", "centers islamiques"].includes(normalized)) return "Islamic Centers";

  return "All";
}

function mapUrl(center, radius) {
  const latitude = Number(center.latitude);
  const longitude = Number(center.longitude);
  const span = Number(radius) / 55;
  const bbox = `${longitude - span},${latitude - span},${longitude + span},${latitude + span}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude},${longitude}`;
}

export default function MosqueHalalFinder() {
  const { language } = useLanguage();
  const isFrench = language === "fr";
  const [center, setCenter] = useState(null);
  const [query, setQuery] = useState("");
  const [radius, setRadius] = useState("5");
  const [filter, setFilter] = useState("All");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [places, setPlaces] = useState([]);
  const [view, setView] = useState("map");

  const categoryOptions = isFrench
    ? [
        { value: "All", label: "Tous" },
        { value: "Mosques", label: "Mosquées" },
        { value: "Halal Food", label: "Nourriture halal" },
        { value: "Islamic Centers", label: "Centres islamiques" },
      ]
    : [
        { value: "All", label: "All" },
        { value: "Mosques", label: "Mosques" },
        { value: "Halal Food", label: "Halal Food" },
        { value: "Islamic Centers", label: "Islamic Centers" },
      ];

  const find = async (coords, options = {}) => {
    const searchRadius = options.radius ?? radius;
    const searchFilter = normalizeFilterValue(options.category ?? filter);
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

  const pageTitle = isFrench ? "Mosquée & recherche halal" : "Mosque & Halal Finder";
  const pageSubtitle = isFrench
    ? "Trouvez les mosquées, centres islamiques et aliments halal proches de votre position."
    : "Find nearby mosques, Islamic centres, and halal food options close to your location.";
  const useLocationLabel = isFrench ? "Utiliser ma position" : "Use my location";
  const searchPlaceholder = isFrench ? "Ville, quartier ou adresse" : "City, area, or address";
  const radiusLabel = isFrench ? "Rayon de recherche" : "Search radius";
  const viewLabels = isFrench ? { map: "Carte", list: "Liste" } : { map: "Map", list: "List" };
  const mapHint = isFrench
    ? "Recherchez un lieu ou utilisez votre position pour voir les résultats à proximité."
    : "Search for a place or use your location to view nearby results.";
  const emptyTitle = isFrench ? "Aucun lieu à afficher pour l’instant" : "No places to display yet";
  const emptyDescription = isFrench
    ? "Utilisez votre position ou recherchez une zone pour voir les résultats proches en direct."
    : "Use your location or search an area to see nearby results live.";
  const directionsLabel = isFrench ? "Itinéraire" : "Directions";
  const searchButtonLabel = isFrench ? "Rechercher" : "Search";

  return <main className="page tool-page">
    <PageHero title={pageTitle} subtitle={pageSubtitle} image={images.mosque} />
    <section className="section tool-section"><div className="container finder">
      <div className="finder-controls">
        <button className="tool-button" onClick={locate}><LocateFixed />{useLocationLabel}</button>
        <form onSubmit={search}><Search /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={searchPlaceholder} /><button aria-label={searchButtonLabel}>{searchButtonLabel === "Search" ? <Search /> : <Search />}</button></form>
        <select value={radius} onChange={event => { const value = event.target.value; setRadius(value); if (center) find(center, { radius: value }); }} aria-label={radiusLabel}>{[1, 5, 10, 25].map(value => <option key={value} value={value}>{value} km</option>)}</select>
      </div>
      <div className="finder-filters">
        {categoryOptions.map(({ value, label }) => (
          <button className={filter === value ? "active" : ""} onClick={() => { setFilter(value); if (center) find(center, { category: value }); }} key={value}>{label}</button>
        ))}
        <span />
        <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}><Map />{viewLabels.map}</button>
        <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><Store />{viewLabels.list}</button>
      </div>
      {message && <p className="tool-alert"><AlertCircle />{message}</p>}
      <div className="finder-content">
        {view === "map" ? <div className="map-frame" style={{ height: "420px", overflow: "hidden", borderRadius: "12px", position: "relative" }}><iframe title={isFrench ? "Carte des mosquées et lieux halal à proximité" : "Map of nearby mosques and halal places"} src={mapUrl(center || defaultMapCenter, radius)} loading="lazy" style={{ width: "100%", height: "100%", border: 0 }} />{!center && <p className="map-hint">{mapHint}</p>}</div> : <div className="places-list">{places.length ? places.map(place => <article key={place.id}><Building2 /><div><h3>{place.name}</h3><p>{place.address} · {place.distanceKm} km</p></div><a href={place.directionsUrl} target="_blank" rel="noreferrer">{directionsLabel}</a></article>) : <div className="tool-empty"><MapPin /><h2>{emptyTitle}</h2><p>{emptyDescription}</p></div>}</div>}
      </div>
    </div></section>
  </main>;
}

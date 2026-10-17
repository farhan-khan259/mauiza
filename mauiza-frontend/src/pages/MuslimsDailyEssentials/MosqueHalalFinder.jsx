import { useRef, useState } from "react";
import { LocateFixed, Map, MapPin, Search, Store, Building2, AlertCircle } from "lucide-react";
import PageHero from "../../components/PageHero/PageHero";
import { useLanguage } from "../../context/LanguageContext";
import { images } from "../../data/images";
import { getAccurateCurrentPosition, getLocationErrorMessage } from "../../utils/geolocation";
import NearbyPlacesMap from "./NearbyPlacesMap";
import "./DailyEssentialsTools.css";

const apiBaseUrl = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5001" : window.location.origin)).replace(/\/$/, "");

function normalizeFilterValue(value) {
  const normalized = String(value || "").toLowerCase().replace(/[\s_-]+/g, " ").trim();

  if (["all", "tous"].includes(normalized)) return "All";
  if (["mosque", "mosques", "mosquée", "mosquées"].includes(normalized)) return "Mosques";
  if (["halal food", "halal-food", "nourriture halal"].includes(normalized)) return "Halal Food";
  if (["islamic center", "islamic centers", "islamic centre", "islamic centres", "centres islamiques", "centers islamiques"].includes(normalized)) return "Islamic Centers";

  return "All";
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
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [places, setPlaces] = useState([]);
  const [view, setView] = useState("map");
  const requestToken = useRef(0);

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
    const token = ++requestToken.current;
    const searchRadius = options.radius ?? radius;
    const searchFilter = normalizeFilterValue(options.category ?? filter);
    setCenter(coords);
    setLoading(true);
    setMessage("");
    setPlaces([]);
    try {
      const response = await fetch(`${apiBaseUrl}/api/nearby-places?latitude=${coords.latitude}&longitude=${coords.longitude}&radius=${searchRadius}&category=${encodeURIComponent(searchFilter)}&language=${language}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Nearby places could not be loaded.");
      if (token !== requestToken.current) return;
      setPlaces(data.results || []);
    } catch (error) {
      if (token !== requestToken.current) return;
      setPlaces([]);
      setMessage(error.message);
    } finally {
      if (token === requestToken.current) setLoading(false);
    }
  };

  const locate = async () => {
    const locationToken = ++requestToken.current;
    setLoading(true);
    setMessage("");
    setCenter(null);
    setPlaces([]);
    setLocationAccuracy(null);
    try {
      const position = await getAccurateCurrentPosition();
      if (locationToken !== requestToken.current) return;
      setLocationAccuracy(position.accuracy);
      await find(position);
    } catch (error) {
      setLoading(false);
      setMessage(getLocationErrorMessage(error));
    }
  };

  const search = async event => {
    event.preventDefault();
    if (!query.trim()) return setMessage("Enter a city, area, or address first.");
    const searchToken = ++requestToken.current;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (!response.ok || !data.data?.length) throw new Error("That location could not be found. Try a more specific search.");
      if (searchToken !== requestToken.current) return;
      setLocationAccuracy(null);
      find({ latitude: Number(data.data[0].latitude), longitude: Number(data.data[0].longitude), source: "search" });
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
  const emptyTitle = isFrench ? "Aucun lieu à afficher pour l’instant" : "No places to display yet";
  const emptyDescription = isFrench
    ? "Utilisez votre position ou recherchez une zone pour voir les résultats proches en direct."
    : "Use your location or search an area to see nearby results live.";
  const noResultsDescription = isFrench
    ? `Aucun résultat Google Places correspondant dans un rayon de ${radius} km. Essayez un rayon plus grand ou une autre catégorie.`
    : `No matching Google Places results were found within ${radius} km. Try a larger radius or another category.`;
  const directionsLabel = isFrench ? "Itinéraire" : "Directions";
  const searchButtonLabel = isFrench ? "Rechercher" : "Search";

  return <main className="page tool-page">
    <PageHero title={pageTitle} subtitle={pageSubtitle} image={images.mosque} />
    <section className="section tool-section"><div className="container finder">
      <div className="finder-controls">
        <button className="tool-button" onClick={locate} disabled={loading}><LocateFixed />{loading ? (isFrench ? "Chargement…" : "Loading…") : useLocationLabel}</button>
        <form onSubmit={search}><Search /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={searchPlaceholder} /><button aria-label={searchButtonLabel}>{searchButtonLabel === "Search" ? <Search /> : <Search />}</button></form>
        <select value={radius} onChange={event => { const value = event.target.value; setRadius(value); if (center) find(center, { radius: value }); }} aria-label={radiusLabel}>{[1, 5, 10, 25].map(value => <option key={value} value={value}>{value} km</option>)}</select>
      </div>
      {center && <p className="location-quality"><LocateFixed />{Number(center.latitude).toFixed(6)}, {Number(center.longitude).toFixed(6)}{Number.isFinite(locationAccuracy) ? ` · GPS accuracy ±${Math.round(locationAccuracy)} m` : ""}</p>}
      <div className="finder-filters">
        {categoryOptions.map(({ value, label }) => (
          <button className={filter === value ? "active" : ""} onClick={() => { setFilter(value); if (center) find(center, { category: value }); }} key={value}>{label}</button>
        ))}
        <span />
        <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}><Map />{viewLabels.map}</button>
        <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><Store />{viewLabels.list}</button>
      </div>
      {message && <p className="tool-alert"><AlertCircle />{message}</p>}
      {loading && <p className="tool-alert" role="status"><LocateFixed />{isFrench ? "Recherche des lieux réels à proximité…" : "Finding real nearby places…"}</p>}
      {center && !loading && !message && <p className="results-summary"><strong>{places.length}</strong> {filter === "All" ? (isFrench ? "lieux à proximité" : "nearby places") : filter} · {radius} km</p>}
      {center && !loading && !message && <p className="google-maps-attribution" translate="no">Results and route data provided by Google Maps</p>}
      <div className="finder-content">
        {view === "map" ? <NearbyPlacesMap center={center} places={places} radiusKm={radius} accuracy={locationAccuracy} /> : <div className="places-list">{places.length ? places.map(place => <article key={place.id}><Building2 /><div><span className={`place-category ${place.category.toLowerCase().replaceAll(" ", "-")}`}>{place.category}</span><h3>{place.name}</h3><p>{place.address}</p><p className="place-route">{place.distanceKm != null && place.travelTime ? `${place.distanceKm} km driving · ${place.travelTime}` : (isFrench ? "Itinéraire indisponible" : "Route distance unavailable")}{place.rating ? ` · ★ ${place.rating}${place.userRatingCount ? ` (${place.userRatingCount})` : ""}` : ""}</p></div><a href={place.directionsUrl} target="_blank" rel="noreferrer">{directionsLabel}</a></article>) : <div className="tool-empty"><MapPin /><h2>{center ? (isFrench ? "Aucun résultat trouvé" : "No results found") : emptyTitle}</h2><p>{center ? noResultsDescription : emptyDescription}</p></div>}</div>}
      </div>
    </div></section>
  </main>;
}

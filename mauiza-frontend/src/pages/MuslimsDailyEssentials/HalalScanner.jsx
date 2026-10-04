import { useState } from "react";
import { FileText, ShieldAlert } from "lucide-react";
import PageHero from "../../components/PageHero/PageHero";
import { useLanguage } from "../../context/LanguageContext";
import { images } from "../../data/images";
import "./DailyEssentialsTools.css";

const apiBaseUrl = "https://mauiza.com";

const getLocalFallback = (entry) => {
  const value = String(entry || "").trim().toLowerCase();
  if (!value) return null;

  const haramTerms = ["bear", "pork", "bacon", "ham", "lard", "rumen", "suet", "blood", "carmine", "cochineal"]; 
  const halalTerms = ["sugar", "salt", "flour", "water", "olive oil", "palm oil", "rice", "corn starch", "cornstarch", "citric acid", "ascorbic acid", "sodium bicarbonate", "beta-carotene", "curcumin"]; 

  if (haramTerms.some((term) => value.includes(term))) {
    return {
      name: entry.trim(),
      eNumber: undefined,
      classification: "Potentially Haram",
      reason: "This ingredient is commonly associated with animal-based or restricted sources and should be checked before use.",
      source: "Mauiza ingredient reference — local safety check"
    };
  }

  if (halalTerms.some((term) => value.includes(term))) {
    return {
      name: entry.trim(),
      eNumber: undefined,
      classification: "Generally Halal",
      reason: "This ingredient is usually accepted as halal when no prohibited processing aids or cross-contamination are involved.",
      source: "Mauiza ingredient reference — local safety check"
    };
  }

  return {
    name: entry.trim(),
    eNumber: undefined,
    classification: "Requires Verification / Mushbooh",
    reason: "This ingredient did not match the current halal reference list. Please confirm the source and packaging information before relying on it.",
    source: "Mauiza ingredient reference — local safety check"
  };
};

export default function HalalScanner() {
  const { language } = useLanguage();
  const isFrench = language === "fr";
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const analyze = async () => {
    const ingredients = text.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);

    if (!ingredients.length) {
      setResults([]);
      return setMessage("Add at least one ingredient or additive before checking.");
    }

    setLoading(true);
    setMessage("");
    setResults([]);

    try {
      const response = await fetch(`${apiBaseUrl}/api/halal/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: ingredients.join(", ") })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "The ingredient database could not be reached.");

      const serverResults = Array.isArray(data.results) ? data.results : [];
      const resultItems = (serverResults.length ? serverResults : ingredients.map((ingredient) => getLocalFallback(ingredient))).map((item, index) => ({
        ...item,
        id: item.id || `${String(item.name || "ingredient").trim() || "ingredient"}-${index}`,
        statusClass: String(item.classification || "Requires Verification / Mushbooh").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
      }));

      setResults(resultItems);
    } catch (error) {
      const fallbackResults = ingredients.map((ingredient) => getLocalFallback(ingredient)).filter(Boolean);
      setResults(fallbackResults);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const title = isFrench ? "Vérificateur d’ingrédients halal" : "Halal Ingredient Checker";
  const subtitle = isFrench
    ? "Saisissez chaque ingrédient ou additif pour voir s’il est généralement halal, s’il nécessite une vérification ou s’il peut être potentiellement haram."
    : "Enter each ingredient or additive to see whether it is generally halal, needs verification, or may be potentially haram.";
  const ingredientLabel = isFrench ? "Liste des ingrédients" : "Ingredient list";
  const placeholder = isFrench
    ? "Saisissez chaque ingrédient un par un, par exemple : sucre, gélatine, E471, huile de palme, shellac"
    : "Enter each ingredient one by one, for example: sugar, gelatin, E471, palm oil, shellac";
  const buttonText = loading ? (isFrench ? "Vérification…" : "Checking...") : isFrench ? "Vérifier les ingrédients" : "Check ingredients";
  const disclaimer = isFrench
    ? "Saisissez n’importe quel ingrédient ou additif ci-dessous. Mauiza vérifie chaque élément individuellement et vous indique s’il est généralement halal, s’il nécessite une vérification ou s’il peut être potentiellement haram."
    : "Enter any ingredient or additive below. Mauiza checks each item individually and tells you whether it is generally halal, needs verification, or may be potentially haram.";

  return (
    <main className="page tool-page">
      <PageHero title={title} subtitle={subtitle} image={images.namaz} />
      <section className="section tool-section">
        <div className="container scanner-layout">
          <div className="scanner-editor wide-editor">
            <label htmlFor="ingredients"><FileText /> {ingredientLabel}</label>
            <textarea
              id="ingredients"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              rows="9"
            />

            <button className="tool-button" onClick={analyze} disabled={loading}>
              {buttonText}
            </button>

            {message && (
              <p className="tool-alert"><ShieldAlert />{message}</p>
            )}

            {results.length > 0 && (
              <div className="ingredient-results">
                {results.map((item) => (
                  <article key={item.id}>
                    <strong>{item.name} {item.eNumber ? `(${item.eNumber})` : ""}</strong>
                    <span className={`status ${item.statusClass}`}>{item.classification}</span>
                    <p>{item.reason}</p>
                    <small>{item.source || (isFrench ? "Source non fournie" : "Source not provided")}</small>
                  </article>
                ))}
              </div>
            )}
          </div>

          <p className="tool-disclaimer">{disclaimer}</p>
        </div>
      </section>
    </main>
  );
}


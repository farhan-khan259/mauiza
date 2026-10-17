import { useState } from "react";
import { FileText, ShieldAlert } from "lucide-react";
import PageHero from "../../components/PageHero/PageHero";
import { useLanguage } from "../../context/LanguageContext";
import { images } from "../../data/images";
import "./DailyEssentialsTools.css";

const apiBaseUrl = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5001" : window.location.origin)).replace(/\/$/, "");

export default function HalalScanner() {
  const { language } = useLanguage();
  const isFrench = language === "fr";
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [serverDisclaimer, setServerDisclaimer] = useState("");

  const analyze = async (event) => {
    event?.preventDefault();
    const ingredients = text.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);

    if (!ingredients.length) {
      setResults([]);
      setSummary(null);
      return setMessage("Add at least one ingredient or additive before checking.");
    }

    setLoading(true);
    setMessage("");
    setResults([]);
    setSummary(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/halal/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: ingredients.join(", ") })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "The ingredient database could not be reached.");

      const serverResults = Array.isArray(data.results) ? data.results : [];
      const resultItems = serverResults.map((item, index) => ({
        ...item,
        id: item.id || `${String(item.name || "ingredient").trim() || "ingredient"}-${index}`,
        statusClass: String(item.classification || "Requires Verification / Mushbooh").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
      }));

      setResults(resultItems);
      setSummary(data.summary || null);
      setServerDisclaimer(data.disclaimer || "");
    } catch (error) {
      setResults([]);
      setSummary(null);
      setMessage(`${error.message} No offline guess was shown because ingredient safety should not be inferred from an incomplete fallback list.`);
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
          <form className="scanner-editor wide-editor" onSubmit={analyze}>
            <label htmlFor="ingredients"><FileText /> {ingredientLabel}</label>
            <textarea
              id="ingredients"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              rows="9"
            />

            <button className="tool-button" type="submit" disabled={loading}>
              {buttonText}
            </button>

            {message && (
              <p className="tool-alert" role="alert"><ShieldAlert />{message}</p>
            )}

            {results.length > 0 && (
              <>
                {summary && <div className="ingredient-summary" aria-label="Ingredient classification summary">
                  <span className="generally-halal"><strong>{summary.generallyHalal}</strong> Generally halal</span>
                  <span className="requires-verification-mushbooh"><strong>{summary.requiresVerification}</strong> Verify</span>
                  <span className="potentially-haram"><strong>{summary.potentiallyHaram}</strong> Potentially haram</span>
                </div>}
                <div className="ingredient-results">
                  {results.map((item) => (
                    <article key={item.id}>
                      <div className="ingredient-result-heading">
                        <strong>{item.name} {item.eNumber && !String(item.name).toUpperCase().includes(item.eNumber) ? `(${item.eNumber})` : ""}</strong>
                        <span className={`status ${item.statusClass}`}>{item.classification}</span>
                      </div>
                      <p>{item.reason}</p>
                      {item.guidance && <p className="ingredient-guidance"><strong>{isFrench ? "À vérifier :" : "What to check:"}</strong> {item.guidance}</p>}
                      <small>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.source}</a> : item.source || (isFrench ? "Source non fournie" : "Source not provided")}</small>
                    </article>
                  ))}
                </div>
                {serverDisclaimer && <p className="ingredient-disclaimer"><ShieldAlert />{serverDisclaimer}</p>}
              </>
            )}
          </form>

          <p className="tool-disclaimer">{disclaimer}</p>
        </div>
      </section>
    </main>
  );
}


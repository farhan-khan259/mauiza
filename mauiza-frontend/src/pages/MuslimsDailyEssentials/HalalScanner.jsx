import { useEffect, useRef, useState } from "react";
import { Camera, FileImage, FileText, ShieldAlert, X } from "lucide-react";
import PageHero from "../../components/PageHero/PageHero";
import { images } from "../../data/images";
import { apiUrl } from "../../utils/api";
import { barcodeCandidates, extractIngredientsSection, isValidBarcode, splitIngredients } from "../../utils/ingredients";
import "./DailyEssentialsTools.css";

const FIELDS = "code,product_name,lang,ingredients_text,ingredients_text_en,ingredients,additives_tags,labels_tags";
const rank = value => /haram/i.test(value) ? 0 : /verification|mushbooh/i.test(value) ? 1 : 2;

function productIngredients(product, language) {
  const compact = String(language || "en").split("-")[0];
  let text = product[`ingredients_text_${compact}`] || product.ingredients_text_en || product.ingredients_text || product[`ingredients_text_${product.lang}`] || "";
  if (!text && Array.isArray(product.ingredients)) text = product.ingredients.map(item => item.text || item.id?.replace(/^[a-z]{2}:/, "")).filter(Boolean).join(", ");
  const items = splitIngredients(text);
  for (const tag of product.additives_tags || []) {
    const additive = tag.replace(/^[a-z]{2}:/, "").toUpperCase();
    if (additive && !items.some(item => item.toUpperCase().includes(additive))) items.push(additive);
  }
  return items.slice(0, 120);
}

export default function HalalScanner() {
  const [mode, setMode] = useState("scan"), [text, setText] = useState(""), [barcode, setBarcode] = useState("");
  const [productStatus, setProductStatus] = useState("idle"), [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState(null), [product, setProduct] = useState(null), [ocr, setOcr] = useState("");
  const videoRef = useRef(null), controlsRef = useRef(null), abortRef = useRef(null), requestToken = useRef(0), resultRef = useRef({ code: "", time: 0, count: 0 });
  const stopCamera = () => { controlsRef.current?.stop?.(); controlsRef.current = null; videoRef.current?.srcObject?.getTracks().forEach(track => track.stop()); };
  useEffect(() => () => { stopCamera(); abortRef.current?.abort(); }, []);

  async function analyzeIngredients(items, meta = {}) {
    const token = ++requestToken.current; abortRef.current?.abort(); abortRef.current = new AbortController(); setMessage(""); setAnalysis(null);
    try {
      const response = await fetch(apiUrl("/api/halal/analyze"), { method: "POST", headers: { "Content-Type": "application/json" }, signal: abortRef.current.signal, body: JSON.stringify({ ingredients: items.join(", "), barcode: meta.barcode, productName: meta.productName, source: meta.source || "manual" }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Analysis failed."); if (token !== requestToken.current) return;
      const results = (data.results || []).sort((a, b) => rank(a.classification) - rank(b.classification));
      const summary = data.summary || results.reduce((s, item) => { if (/haram/i.test(item.classification)) s.potentiallyHaram++; else if (/halal/i.test(item.classification)) s.generallyHalal++; else s.requiresVerification++; return s; }, { generallyHalal: 0, requiresVerification: 0, potentiallyHaram: 0 });
      setAnalysis({ ...data, results, summary }); requestAnimationFrame(() => document.querySelector(".scanner-verdict")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (error) { if (error.name !== "AbortError") setMessage(`${error.message} No offline guess was shown.`); }
  }

  async function lookup(rawCode) {
    const code = String(rawCode).replace(/\D/g, ""); if (!isValidBarcode(code)) return setMessage("That barcode has an invalid length or check digit.");
    const token = ++requestToken.current; abortRef.current?.abort(); abortRef.current = new AbortController(); setProductStatus("loading"); setMessage(""); setAnalysis(null);
    try {
      for (const candidate of barcodeCandidates(code)) {
        const timeout = setTimeout(() => abortRef.current?.abort(), 12000); const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${candidate}.json?fields=${FIELDS}`, { signal: abortRef.current.signal }); clearTimeout(timeout);
        if (response.status === 429) throw new Error("Open Food Facts is busy. Please try again shortly."); if (response.status === 404) continue;
        const data = await response.json(); if (data.status !== 1 || !data.product) continue; if (token !== requestToken.current) return;
        const items = productIngredients(data.product, document.documentElement.lang); setProduct(data.product); setBarcode(candidate);
        if (!items.length) { setProductStatus("noingredients"); setMode("photo"); return setMessage("Ingredients missing. Photograph the ingredients panel or type it instead."); }
        setProductStatus("found"); setText(items.join(", ")); await analyzeIngredients(items, { barcode: candidate, productName: data.product.product_name, source: "openfoodfacts" }); return;
      }
      if (token === requestToken.current) { setProductStatus("notfound"); setMode("photo"); setMessage("Product not found. Photograph the ingredients panel or type it instead."); }
    } catch (error) { if (error.name !== "AbortError") { setProductStatus("idle"); setMessage(error.message); } }
  }

  async function openCamera() {
    setMode("scan"); setMessage(""); if (!window.isSecureContext) return setMessage("Camera scanning requires HTTPS. You can still type the barcode.");
    try {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
      const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]], [DecodeHintType.TRY_HARDER, true]]);
      const reader = new BrowserMultiFormatReader(hints, 120); stopCamera();
      controlsRef.current = await reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } }, videoRef.current, result => {
        if (!result) return; const code = result.getText(), now = Date.now(), previous = resultRef.current; const count = previous.code === code && now - previous.time <= 1500 ? previous.count + 1 : 1; resultRef.current = { code, time: now, count };
        if (count >= 2 && isValidBarcode(code)) { stopCamera(); setBarcode(code); lookup(code); }
      });
    } catch (error) { const errors = { NotAllowedError: "Camera permission was denied.", NotFoundError: "No camera was found.", NotReadableError: "The camera is already in use.", OverconstrainedError: "The rear camera is unavailable." }; setMessage(errors[error.name] || "Camera scanning could not start. Type the barcode instead."); }
  }

  async function runOcr(file) {
    if (!file) return; setOcr("Preparing image…"); setMessage("");
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }), scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale); const context = canvas.getContext("2d"); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height); for (let i = 0; i < image.data.length; i += 4) { const grey = image.data[i] * .299 + image.data[i + 1] * .587 + image.data[i + 2] * .114, adjusted = Math.max(0, Math.min(255, (grey - 128) * 1.35 + 128)); image.data[i] = image.data[i + 1] = image.data[i + 2] = adjusted; } context.putImageData(image, 0, 0);
      const { recognize } = await import("tesseract.js"); const result = await recognize(canvas, "eng", { logger: progress => setOcr(`${progress.status} ${Math.round((progress.progress || 0) * 100)}%`) });
      setText(extractIngredientsSection(result.data.text)); setOcr("Review and correct the extracted text, then press Check ingredients.");
    } catch (error) { setOcr(""); setMessage(error.message || "The image could not be read."); }
  }

  const submit = event => { event.preventDefault(); const items = splitIngredients(text); if (!items.length) return setMessage("Add at least one ingredient."); analyzeIngredients(items, { barcode: barcode || undefined, productName: product?.product_name, source: mode === "photo" ? "photo" : "manual" }); };
  const summary = analysis?.summary, verdict = !summary ? null : summary.potentiallyHaram ? ["Potentially Haram", "red"] : summary.requiresVerification ? ["Requires Verification", "amber"] : ["Generally Halal", "green"];
  return <main className="page tool-page"><PageHero title="Halal Scanner" subtitle="Scan a product barcode, photograph its ingredients, or type them for a source-aware screening." image={images.namaz} /><section className="section tool-section"><div className="container scanner-layout"><div className="scanner-modes"><button className={mode === "scan" ? "active" : ""} onClick={openCamera}><Camera /> Scan barcode</button><button className={mode === "photo" ? "active" : ""} onClick={() => { stopCamera(); setMode("photo"); }}><FileImage /> Photo / OCR</button><button className={mode === "type" ? "active" : ""} onClick={() => { stopCamera(); setMode("type"); }}><FileText /> Type</button></div><form className="scanner-editor" onSubmit={submit}>
    {mode === "scan" && <><div className="scanner-video-wrap"><video ref={videoRef} muted playsInline /><button type="button" aria-label="Stop camera" onClick={stopCamera}><X /></button></div><div className="barcode-entry"><input inputMode="numeric" value={barcode} onChange={e => setBarcode(e.target.value.replace(/\D/g, ""))} placeholder="Enter an 8, 12, 13, or 14 digit barcode" /><button type="button" className="tool-button" onClick={() => lookup(barcode)}>Look up</button></div></>}
    {mode === "photo" && <label className="photo-upload"><FileImage /> Choose an ingredients photo<input type="file" accept="image/*" capture="environment" onChange={e => runOcr(e.target.files?.[0])} /></label>}{ocr && <p className="ocr-progress" role="status">{ocr}</p>}{productStatus === "loading" && <p className="ocr-progress">Looking up product…</p>}{product?.product_name && <h2>{product.product_name}</h2>}
    {(mode !== "scan" || text) && <><label htmlFor="ingredients"><FileText /> Ingredient list</label><textarea id="ingredients" value={text} onChange={e => setText(e.target.value)} rows="9" placeholder="Ingredients: sugar, gelatine (pork), E471…" /><button className="tool-button" disabled={!text.trim()}>Check ingredients</button></>}{message && <p className="tool-alert" role="alert"><ShieldAlert />{message}</p>}
    {verdict && <section className={`scanner-verdict ${verdict[1]}`}><strong>{verdict[0]}</strong>{product?.labels_tags?.some(label => /halal/i.test(label)) && <span>Product label mentions halal certification; verify the certifier.</span>}</section>}{summary && <div className="ingredient-summary"><span className="generally-halal"><strong>{summary.generallyHalal}</strong> Generally halal</span><span className="requires-verification-mushbooh"><strong>{summary.requiresVerification}</strong> Verify</span><span className="potentially-haram"><strong>{summary.potentiallyHaram}</strong> Potentially haram</span></div>}
    {analysis?.results?.length > 0 && <div className="ingredient-results">{analysis.results.map((item, index) => <article key={`${item.name}-${index}`}><div className="ingredient-result-heading"><strong>{item.name}</strong><span className={`status ${String(item.classification).toLowerCase().replace(/[^a-z]+/g, "-")}`}>{item.classification}</span></div><p>{item.reason}</p>{item.guidance && <p><strong>What to check:</strong> {item.guidance}</p>}</article>)}</div>}{analysis?.disclaimer && <p className="ingredient-disclaimer"><ShieldAlert />{analysis.disclaimer}</p>}
  </form></div></section></main>;
}

import { useState } from "react";
import { CheckCircle2, HeartHandshake, Info } from "lucide-react";
import PageHero from "../../components/PageHero/PageHero";
import { images } from "../../data/images";
import { countryCodes } from "../../data/countries";
import { useLanguage } from "../../context/LanguageContext";
import "./Volunteers.css";

const roles = ["Teacher", "Video Editor", "Media Manager"];
const instructionLanguages = [["ar", "Arabic"], ["en", "English"], ["fr", "French"], ["hi", "Hindi"], ["pt", "Portuguese"], ["es", "Spanish"], ["sv", "Swedish"], ["tr", "Turkish"], ["ur", "Urdu"], ["other", "Other"]];
const availabilitySlots = [
  "Morning (06:00 - 12:00)",
  "Afternoon (12:00 - 17:00)",
  "Evening (17:00 - 22:00)",
  "Flexible",
  "Other"
];

const roleCopy = {
  Teacher: {
    fieldLabel: "Islamic Education / Background",
    fieldName: "islamicEducation",
    placeholder: "Describe your Islamic education, teachers, or areas of study...",
    goalPlaceholder: "Tell us about your goals, teaching interests, and how you would like to contribute as a volunteer teacher.",
    note: "Share the Islamic knowledge and teaching experience you would like to bring to students."
  },
  "Video Editor": {
    fieldLabel: "Video Editing Skills",
    fieldName: "skills",
    placeholder: "Describe your editing skills, software, tools, and areas of experience...",
    goalPlaceholder: "Please write about your goals and what you would like to achieve as a volunteer video editor. Free training will be provided, so beginners are welcome to apply.",
    note: "Free training will be provided. Beginners are welcome to apply."
  },
  "Media Manager": {
    fieldLabel: "TikTok Account",
    fieldName: "tiktokAccount",
    placeholder: "@username or https://www.tiktok.com/@username",
    goalPlaceholder: "Please write about your goals and what you would like to achieve as a volunteer media manager.",
    note: "Media Manager Role: Content will be provided to you. Your responsibility will be to post the provided content on your TikTok account and manage the content on your account consistently."
  }
};

export default function Volunteers() {
  const { language } = useLanguage();
  const countryDisplayNames = new Intl.DisplayNames([language], { type: "region" });
  const instructionLanguageDisplayNames = new Intl.DisplayNames([language], { type: "language" });
  const [role, setRole] = useState("");
  const [step, setStep] = useState(1);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function goToDetails() {
    if (!role) {
      setErrorMessage("Please select a volunteer role to continue.");
      return;
    }
    setErrorMessage("");
    setStep(2);
  }

  function changeRole(event) {
    setRole(event.target.value);
    setErrorMessage("");
  }

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const payload = {
      fullName: String(data.get("fullName") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      country: String(data.get("country") || "").trim(),
      profession: String(data.get("profession") || "").trim(),
      designation: String(data.get("designation") || "").trim(),
      instructionLanguage: String(data.get("instructionLanguage") || "").trim(),
      availability: String(data.get("availability") || "").trim(),
      availabilityDetails: String(data.get("availabilityDetails") || "").trim(),
      goals: String(data.get("goals") || "").trim(),
      islamicEducation: String(data.get("islamicEducation") || "").trim(),
      skills: String(data.get("skills") || "").trim(),
      tiktokAccount: String(data.get("tiktokAccount") || "").trim()
    };

    try {
      setSubmitting(true);
      setErrorMessage("");
      const apiBaseUrl = (import.meta.env.VITE_API_URL || "https://mauiza-backend.onrender.com").replace(/\/+$/, "");
      const response = await fetch(`${apiBaseUrl}/api/volunteers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const contentType = response.headers.get("content-type") || "";
      const result = contentType.includes("application/json") ? await response.json() : {};
      if (!response.ok) throw new Error(result.message || "Volunteer application failed. Please try again.");
      setSent(true);
      form.reset();
      setRole("");
      setStep(1);
    } catch (error) {
      console.error("Volunteer application error:", error);
      setErrorMessage(error.message || "Volunteer application failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedRole = roleCopy[role];

  return (
    <main className="page volunteer-page">
      <PageHero
        title="Volunteer With Mauiza"
        subtitle="Share your skills, serve with purpose, and help make Quranic learning more accessible."
        image={images.learning}
      />
      <section className="section">
        <div className="container volunteer-layout">
          <aside className="volunteer-intro">
            <p className="eyebrow">JOIN OUR TEAM</p>
            <h2>Bring Your Gifts to Meaningful Work.</h2>
            <p>
              Complete one application and tell us how you would like to support
              Mauiza. Your role-specific questions will appear as soon as you
              choose a volunteer designation.
            </p>
            <div className="volunteer-points">
              <p><HeartHandshake /> One unified application</p>
              <p><HeartHandshake /> Flexible ways to contribute</p>
              <p><HeartHandshake /> Training available for beginners</p>
            </div>
          </aside>

          <form className="volunteer-form" onSubmit={submit} noValidate>
            <div className="volunteer-form-heading">
              <div>
                <p className="eyebrow">VOLUNTEER APPLICATION</p>
                <h2>{step === 1 ? "Choose Your Role" : "Tell Us About Yourself"}</h2>
              </div>
              <span className="form-step">0{step} / 02</span>
            </div>

            {step === 1 ? (
              <div className="volunteer-role-step">
                <div className="role-choice-intro">
                  <HeartHandshake />
                  <p>Select the role that best matches how you would like to contribute. The next step will show the relevant application questions.</p>
                </div>
                <label>
                  Designation / Volunteer Role
                  <select required name="designation" value={role} onChange={changeRole}>
                    <option value="" disabled>Select a volunteer role</option>
                    {roles.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                {errorMessage && <p className="volunteer-error" role="alert">{errorMessage}</p>}
                <button type="button" onClick={goToDetails}>Next: Application Details <span>→</span></button>
              </div>
            ) : (
              <>
                <input type="hidden" name="designation" value={role} />
                <div className="selected-role-strip"><span>Selected role</span><strong>{role}</strong><button type="button" onClick={() => setStep(1)}>Change</button></div>
                <div className="volunteer-form-row">
                  <label>Full Name<input required name="fullName" placeholder="Your full name" /></label>
                  <label>Email Address<input required type="email" name="email" placeholder="you@example.com" /></label>
                </div>
                <div className="volunteer-form-row">
                  <label>WhatsApp Number<input required name="phone" placeholder="Your WhatsApp number" /></label>
                  <label>
                    Country
                    <select required name="country" defaultValue="">
                      <option value="" disabled>Select country</option>
                      {countryCodes.map((code) => <option key={code} value={code}>{countryDisplayNames.of(code) || code}</option>)}
                    </select>
                  </label>
                </div>
                <label>Profession<input required name="profession" placeholder="Your current profession" /></label>
                <div className="volunteer-form-row">
                  <label>
                    Language of Instruction
                    <select required name="instructionLanguage" defaultValue="">
                      <option value="" disabled>Select a language</option>
                      {instructionLanguages.map(([code, label]) => <option key={code} value={code}>{instructionLanguageDisplayNames.of(code) || label}</option>)}
                    </select>
                  </label>
                  <label>
                    Availability Time Slot
                    <select required name="availability" defaultValue="">
                      <option value="" disabled>Select your availability</option>
                      {availabilitySlots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                    </select>
                  </label>
                </div>
                <label>Availability Details (optional)<input name="availabilityDetails" placeholder="Add specific days or times" /></label>

                {selectedRole && (
                  <div className="role-panel">
                    <div className="role-panel-header">
                      <div><span className="role-kicker">SELECTED ROLE</span><h3>{role}</h3></div>
                      <Info />
                    </div>
                    <p>{selectedRole.note}</p>
                    <label>
                      {selectedRole.fieldLabel}
                      {role === "Media Manager" ? (
                        <input required name={selectedRole.fieldName} placeholder={selectedRole.placeholder} />
                      ) : (
                        <textarea required name={selectedRole.fieldName} rows="4" placeholder={selectedRole.placeholder} />
                      )}
                    </label>
                  </div>
                )}

                <label>
                  Write About Your Goals
                  <textarea required name="goals" rows="6" placeholder={selectedRole.goalPlaceholder} />
                </label>

                {errorMessage && <p className="volunteer-error" role="alert">{errorMessage}</p>}
                <div className="volunteer-step-actions">
                  <button type="button" className="volunteer-back-button" onClick={() => setStep(1)}>← Back</button>
                  <button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit Volunteer Application"}<span>→</span></button>
                </div>
              </>
            )}
          </form>
        </div>
      </section>
      {sent && (
        <div className="success-modal-backdrop" onClick={() => setSent(false)}>
          <div className="success-modal" onClick={(event) => event.stopPropagation()}>
            <div className="success-modal-icon"><CheckCircle2 /></div>
            <h3>Thank you for volunteering with Mauiza.</h3>
            <p>Your application has been received. Our team will review it and contact you soon.</p>
            <button type="button" onClick={() => setSent(false)}>Close</button>
          </div>
        </div>
      )}
    </main>
  );
}

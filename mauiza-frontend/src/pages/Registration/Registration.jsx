import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { getTimeZones } from "@vvo/tzdb";
import PageHero from "../../components/PageHero/PageHero";
import WhatsAppIcon from "../../components/WhatsAppIcon";
import { images } from "../../data/images";
import { useLanguage } from "../../context/LanguageContext";
import { countryCodes } from "../../data/countries";
import instructionLanguages from "../../data/languages";
import "./Registration.css";

const timezones = getTimeZones({ includeUtc: true });
const timezonePrefix = {
	en: "Time zone in",
	ur: "ٹائم زون",
	ar: "المنطقة الزمنية في",
	sv: "Tidszon i",
	tr: "Şuradaki saat dilimi:",
	fr: "Fuseau horaire de",
	es: "Zona horaria de",
	"zh-CN": "时区：",
	pt: "Fuso horário em",
	fil: "Time zone sa",
	hi: "समय क्षेत्र",
	ru: "Часовой пояс:"
};

function formatTimezoneOffset(minutes) {
	const sign = minutes < 0 ? "-" : "+";
	const absoluteMinutes = Math.abs(minutes);
	const hours = Math.floor(absoluteMinutes / 60);
	const remainingMinutes = absoluteMinutes % 60;
	return `GMT${sign}${hours}${remainingMinutes ? `:${String(remainingMinutes).padStart(2, "0")}` : ""}`;
}

export default function Registration() {
	const { language, t } = useLanguage();
	const location = useLocation();
	const [sent, setSent] = useState(false);
	const [successMessage, setSuccessMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [selectedCourse, setSelectedCourse] = useState(location.state?.selectedCourse || "");
	const [schedule, setSchedule] = useState({ start: "", end: "" });
	const languageDisplayNames = new Intl.DisplayNames([language], { type: "language" });
	const countryDisplayNames = new Intl.DisplayNames([language], { type: "region" });
	const timezoneCountryCounts = timezones.reduce((counts, timezone) => {
		if (timezone.countryCode) counts[timezone.countryCode] = (counts[timezone.countryCode] || 0) + 1;
		return counts;
	}, {});

	function formatTimezoneLabel(timezone) {
		if (timezone.name === "UTC") return "Time zone in UTC (GMT+0)";
		let country = timezone.countryName;
		if (/^[A-Z]{2}$/.test(timezone.countryCode || "")) {
			try {
				country = countryDisplayNames.of(timezone.countryCode) || country;
			} catch {
				country = timezone.countryName;
			}
		}
		const city = timezoneCountryCounts[timezone.countryCode] > 1 && timezone.mainCities?.[0]
			? ` - ${timezone.mainCities[0]}`
			: "";
		return `${timezonePrefix[language] || timezonePrefix.en} ${country}${city} (${formatTimezoneOffset(timezone.currentTimeOffsetInMinutes)})`;
	}

	useEffect(() => {
		if (location.state?.selectedCourse) {
			setSelectedCourse(location.state.selectedCourse);
		}
	}, [location.state]);

	function formatTimeForDisplay(value) {
		if (!value) return "";
		const [hours, minutes] = value.split(":").map(Number);
		const suffix = hours >= 12 ? "PM" : "AM";
		const hour = hours % 12 || 12;
		return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
	}

	function getHalfHourLater(value) {
		if (!value) return "";
		const [hours, minutes] = value.split(":").map(Number);
		const totalMinutes = hours * 60 + minutes + 30;
		const nextHours = Math.floor(totalMinutes / 60);
		const nextMinutes = totalMinutes % 60;
		return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
	}

	const scheduleSummary = schedule.start && schedule.end ? `${formatTimeForDisplay(schedule.start)} to ${formatTimeForDisplay(schedule.end)}` : "";

	async function submit(event) {
		event.preventDefault();

		const form = event.currentTarget;
		if (!form.checkValidity()) {
			form.reportValidity();
			return;
		}
		const formData = new FormData(form);
		const courseValue = String(formData.get("course") || selectedCourse).trim();
		const payload = {
			fullName: String(formData.get("name") || "").trim(),
			email: String(formData.get("email") || "").trim(),
			phone: String(formData.get("phone") || "").trim(),
			country: String(formData.get("country") || "").trim(),
			ageGroup: String(formData.get("ageGroup") || "").trim(),
			gender: String(formData.get("gender") || "").trim(),
			timezone: String(formData.get("timezone") || "").trim(),
			instructionLanguage: String(formData.get("instructionLanguage") || "").trim(),
			faith: String(formData.get("faith") || "").trim(),
			course: courseValue,
			startTime: schedule.start,
			endTime: schedule.end,
			schedule: `${formatTimeForDisplay(schedule.start)} to ${formatTimeForDisplay(schedule.end)}`,
			goals: String(formData.get("goals") || "").trim()
		};
		if (Object.values(payload).some((value) => !value)) {
			setErrorMessage(t("Please complete all required registration fields."));
			return;
		}
		if (!schedule.start || !schedule.end || schedule.end <= schedule.start) {
			setErrorMessage(t("Please choose a valid preferred schedule."));
			return;
		}

		try {
			setSubmitting(true);
			setErrorMessage("");
			const apiBaseUrl = (import.meta.env.VITE_API_URL || "https://mauiza-backend.onrender.com").replace(/\/+$/, "");
			const response = await fetch(`${apiBaseUrl}/api/registration`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload)
			});

			const contentType = response.headers.get("content-type") || "";
			const data = contentType.includes("application/json")
				? await response.json()
				: { message: t("Registration request failed. Please try again.") };
			if (!response.ok) {
				throw new Error(data.message || t("Registration failed"));
			}

			const whatsappMessage = `Hello Mauiza, I have submitted my registration for ${courseValue}. My name is ${payload.fullName} and my email is ${payload.email}. I would like to continue the conversation.`;
			setSuccessMessage(whatsappMessage);
			setSent(true);
			form.reset();
			setSelectedCourse("");
			setSchedule({ start: "", end: "" });
		} catch (error) {
			console.error("Registration error:", error);
			setErrorMessage(t(error.message || "Failed to submit registration. Please try again."));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<main className="page">
			<PageHero
				title={t("Begin Your Learning Journey")}
				subtitle={t("Complete the form below and take your next step towards meaningful Quranic learning.")}
				image={images.learning}
			/>
			<section className="section">
				<div className="container register-layout">
					<aside>
						<p className="eyebrow">{t("REGISTRATION")}</p>
						<h2>{t("Let’s Find the Right Learning Path for You.")}</h2>
						<p>
							{t("Share a few details about your learning goals and preferred schedule.")} {t("Our team will review your registration and contact you with the next steps.")}
						</p>
						<div className="register-points">
							<p><CheckCircle2 /> {t("Simple online registration")}</p>
							<p><CheckCircle2 /> {t("Choose a suitable course")}</p>
							<p><CheckCircle2 /> {t("Flexible schedule preferences")}</p>
						</div>
					</aside>
					<form onSubmit={submit} className="registration-form">
						<div className="form-row">
							<label>{t("Full Name")}<input required name="name" placeholder={t("Your full name")} /></label>
							<label>{t("Email Address")}<input required type="email" name="email" placeholder="mauizainstitute@gmail.com" /></label>
						</div>
						<div className="form-row">
							<label>{t("WhatsApp Number")}<input required name="phone" placeholder={t("Your WhatsApp number")} /></label>
							<label>
								{t("Country")}
								<select required name="country" defaultValue="">
									<option value="" disabled>{t("Select country")}</option>
									{countryCodes.map((code) => <option key={code} value={code}>{countryDisplayNames.of(code) || code}</option>)}
								</select>
							</label>
						</div>
						<div className="form-row">
							<label>
								{t("Age Group")}
								<select required name="ageGroup" defaultValue="">
									<option value="" disabled>{t("Select age group")}</option>
									<option>{t("Child")}</option>
									<option>{t("Teen")}</option>
									<option>{t("Adult")}</option>
								</select>
							</label>
							<label>
								{t("Gender")}
								<select required name="gender" defaultValue="">
									<option value="" disabled>{t("Select gender")}</option>
									<option value="male">{t("Male")}</option>
									<option value="female">{t("Female")}</option>
								</select>
							</label>
						</div>
						<div className="form-row">
							<label>
								{t("Timezone")}
								<select required name="timezone" defaultValue="">
									<option value="" disabled>{t("Select timezone")}</option>
									{timezones.map((timezone) => <option key={timezone.name} value={timezone.name}>{formatTimezoneLabel(timezone)}</option>)}
								</select>
							</label>
							<label>
								{t("Language of Instruction")}
								<select required name="instructionLanguage" defaultValue="">
									<option value="" disabled>{t("Select language")}</option>
									{instructionLanguages.map(([code, label]) => <option key={code} value={code}>{languageDisplayNames.of(code) || label}</option>)}
								</select>
							</label>
						</div>
						<div className="form-row">
							<label>
								{t("Faith")}
								<select required name="faith" defaultValue="">
									<option value="" disabled>{t("Select faith")}</option>
									<option value="new-muslim">{t("New Muslim")}</option>
									<option value="born-muslim">{t("Born Muslim")}</option>
								</select>
							</label>
							<label>
								{t("Preferred Course")}
								<select
									required
									name="course"
									value={selectedCourse}
									onChange={(event) => setSelectedCourse(event.target.value)}
								>
									<option value="" disabled>{t("Select a course")}</option>
									<option value="Namaz Course">{t("Namaz Course")}</option>
									<option value="Quran Memorization">{t("Quran Memorization")}</option>
									<option value="Tajweed Course">{t("Tajweed Course")}</option>
									<option value="Arabic Reading Course">{t("Arabic Reading Course")}</option>
								</select>
							</label>
						</div>
						<label>
							{t("Preferred Schedule")}
							<div className="time-range-wrap">
								<label className="time-range-field">
									<span>{t("From")}</span>
									<input
										required
										type="time"
										name="startTime"
										step="60"
										max="23:00"
										value={schedule.start}
										onChange={(event) => {
											const start = event.target.value;
											setSchedule({ start, end: getHalfHourLater(start) });
									}}
									/>
								</label>
								<span className="time-range-separator">{t("to")}</span>
								<label className="time-range-field">
									<span>{t("To")}</span>
									<input
										required
										type="time"
										name="endTime"
										step="60"
										min={schedule.start || undefined}
										value={schedule.end}
										onChange={(event) => setSchedule((current) => ({ ...current, end: event.target.value }))}
									/>
								</label>
							</div>
							<input type="hidden" name="schedule" value={scheduleSummary} />
						</label>
						<label>
							{t("Learning Goals")}
							<textarea required name="goals" rows="4" placeholder={t("Tell us briefly what you would like to learn...")} />
						</label>
						{errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
						<button type="submit" disabled={submitting}>{submitting ? t("Submitting...") : t("Submit Registration")} <span>→</span></button>
					</form>
				</div>
			</section>
			{sent && (
				<div className="success-modal-backdrop" onClick={() => setSent(false)}>
					<div className="success-modal" onClick={(event) => event.stopPropagation()}>
						<div className="success-modal-icon"><CheckCircle2 /></div>
						<h3>{t("Your registration has been submitted successfully.")}</h3>
						<p>{t("Thank you for choosing Mauiza. Our team will contact you soon.")}</p>
						<a
							className="whatsapp-cta"
							href={`https://wa.me/1234567891011?text=${encodeURIComponent(successMessage)}`}
							target="_blank"
							rel="noreferrer"
						>
							<WhatsAppIcon />
							{t("Contact on WhatsApp")}
						</a>
					</div>
				</div>
			)}
		</main>
	);
}

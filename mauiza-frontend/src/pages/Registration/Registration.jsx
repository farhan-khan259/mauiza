import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { timeZonesNames } from "@vvo/tzdb";
import PageHero from "../../components/PageHero/PageHero";
import WhatsAppIcon from "../../components/WhatsAppIcon";
import { images } from "../../data/images";
import { useLanguage } from "../../context/LanguageContext";
import "./Registration.css";

const instructionLanguages = [
	["ab", "Abkhazian"], ["af", "Afrikaans"], ["sq", "Albanian"], ["am", "Amharic"], ["ar", "Arabic"],
	["hy", "Armenian"], ["as", "Assamese"], ["az", "Azerbaijani"], ["eu", "Basque"], ["be", "Belarusian"],
	["bn", "Bengali"], ["bs", "Bosnian"], ["bg", "Bulgarian"], ["my", "Burmese"], ["ca", "Catalan"],
	["zh", "Chinese"], ["hr", "Croatian"], ["cs", "Czech"], ["da", "Danish"], ["nl", "Dutch"],
	["en", "English"], ["et", "Estonian"], ["fa", "Persian"], ["fi", "Finnish"], ["fr", "French"],
	["gl", "Galician"], ["ka", "Georgian"], ["de", "German"], ["el", "Greek"], ["gu", "Gujarati"],
	["ha", "Hausa"], ["he", "Hebrew"], ["hi", "Hindi"], ["hu", "Hungarian"], ["is", "Icelandic"],
	["id", "Indonesian"], ["ga", "Irish"], ["it", "Italian"], ["ja", "Japanese"], ["jv", "Javanese"],
	["kn", "Kannada"], ["kk", "Kazakh"], ["km", "Khmer"], ["ko", "Korean"], ["ky", "Kyrgyz"],
	["lo", "Lao"], ["lv", "Latvian"], ["lt", "Lithuanian"], ["mk", "Macedonian"], ["ms", "Malay"],
	["ml", "Malayalam"], ["mr", "Marathi"], ["mn", "Mongolian"], ["ne", "Nepali"], ["no", "Norwegian"],
	["or", "Odia"], ["pa", "Punjabi"], ["pl", "Polish"], ["pt", "Portuguese"], ["ro", "Romanian"],
	["ru", "Russian"], ["sr", "Serbian"], ["si", "Sinhala"], ["sk", "Slovak"], ["sl", "Slovenian"],
	["so", "Somali"], ["es", "Spanish"], ["sw", "Swahili"], ["sv", "Swedish"], ["tl", "Filipino"],
	["tg", "Tajik"], ["ta", "Tamil"], ["te", "Telugu"], ["th", "Thai"], ["tr", "Turkish"],
	["tk", "Turkmen"], ["uk", "Ukrainian"], ["ur", "Urdu"], ["ug", "Uyghur"], ["uz", "Uzbek"],
	["vi", "Vietnamese"], ["cy", "Welsh"], ["yo", "Yoruba"], ["zu", "Zulu"]
];

const timezones = ["UTC", ...timeZonesNames];

export default function Registration() {
	const { language } = useLanguage();
	const location = useLocation();
	const [sent, setSent] = useState(false);
	const [successMessage, setSuccessMessage] = useState("");
	const [selectedCourse, setSelectedCourse] = useState(location.state?.selectedCourse || "");
	const [schedule, setSchedule] = useState({ start: "", end: "" });
	const languageDisplayNames = new Intl.DisplayNames([language], { type: "language" });

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
			alert("Please complete all required registration fields.");
			return;
		}
		if (!schedule.start || !schedule.end || schedule.end <= schedule.start) {
			alert("Please choose a valid preferred schedule.");
			return;
		}

		try {
			const apiBaseUrl = (import.meta.env.VITE_API_URL || "https://mauiza-backend.onrender.com").replace(/\/+$/, "");
			const response = await fetch(`${apiBaseUrl}/api/registration`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload)
			});

			const contentType = response.headers.get("content-type") || "";
			const data = contentType.includes("application/json")
				? await response.json()
				: { message: `Registration request failed (${response.status}). Please try again.` };
			if (!response.ok) {
				throw new Error(data.message || "Registration failed");
			}

			const whatsappMessage = `Hello Mauiza, I have submitted my registration for ${courseValue}. My name is ${payload.fullName} and my email is ${payload.email}. I would like to continue the conversation.`;
			setSuccessMessage(whatsappMessage);
			setSent(true);
			form.reset();
			setSelectedCourse("");
			setSchedule({ start: "", end: "" });
		} catch (error) {
			console.error("Registration error:", error);
			alert(error.message || "Failed to submit registration. Please try again.");
		}
	}

	return (
		<main className="page">
			<PageHero
				title="Begin Your Learning Journey"
				subtitle="Complete the form below and take your next step towards meaningful Quranic learning."
				image={images.learning}
			/>
			<section className="section">
				<div className="container register-layout">
					<aside>
						<p className="eyebrow">REGISTRATION</p>
						<h2>Let’s Find the Right Learning Path for You.</h2>
						<p>
							Share a few details about your learning goals and preferred schedule.
							Our team will review your registration and contact you with the next steps.
						</p>
						<div className="register-points">
							<p><CheckCircle2 /> Simple online registration</p>
							<p><CheckCircle2 /> Choose a suitable course</p>
							<p><CheckCircle2 /> Flexible schedule preferences</p>
						</div>
					</aside>
					<form onSubmit={submit} className="registration-form">
						<div className="form-row">
							<label>Full Name<input required name="name" placeholder="Your full name" /></label>
							<label>Email Address<input required type="email" name="email" placeholder="mauizainstitute@gmail.com" /></label>
						</div>
						<div className="form-row">
							<label>WhatsApp Number<input required name="phone" placeholder="Your WhatsApp number" /></label>
							<label>Country<input required name="country" placeholder="Your country" /></label>
							<label>
								Age Group
								<select required name="ageGroup" defaultValue="">
									<option value="" disabled>Select age group</option>
									<option>Child</option>
									<option>Teen</option>
									<option>Adult</option>
								</select>
							</label>
						</div>
						<div className="form-row">
							<label>
								Gender
								<select required name="gender" defaultValue="">
									<option value="" disabled>Select gender</option>
									<option value="male">Male</option>
									<option value="female">Female</option>
								</select>
							</label>
							<label>
								Timezone
								<select required name="timezone" defaultValue="">
									<option value="" disabled>Select timezone</option>
									{timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
								</select>
							</label>
							<label>
								Language of Instruction
								<select required name="instructionLanguage" defaultValue="">
									<option value="" disabled>Select language</option>
									{instructionLanguages.map(([code, label]) => <option key={code} value={code}>{languageDisplayNames.of(code) || label}</option>)}
								</select>
							</label>
							<label>
								Faith
								<select required name="faith" defaultValue="">
									<option value="" disabled>Select faith</option>
									<option value="new-muslim">New Muslim</option>
									<option value="born-muslim">Born Muslim</option>
								</select>
							</label>
							<label>
								Preferred Course
								<select
									required
									name="course"
									value={selectedCourse}
									onChange={(event) => setSelectedCourse(event.target.value)}
								>
									<option value="" disabled>Select a course</option>
									<option value="Namaz Course">Namaz Course</option>
									<option value="Quran Memorization">Quran Memorization</option>
									<option value="Tajweed Course">Tajweed Course</option>
									<option value="Arabic Reading Course">Arabic Reading Course</option>
								</select>
							</label>
						</div>
						<label>
							Preferred Schedule
							<div className="time-range-wrap">
								<label className="time-range-field">
									<span>From</span>
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
								<span className="time-range-separator">to</span>
								<label className="time-range-field">
									<span>To</span>
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
							Learning Goals
							<textarea required name="goals" rows="4" placeholder="Tell us briefly what you would like to learn..." />
						</label>
						<button type="submit">Submit Registration <span>→</span></button>
					</form>
				</div>
			</section>
			{sent && (
				<div className="success-modal-backdrop" onClick={() => setSent(false)}>
					<div className="success-modal" onClick={(event) => event.stopPropagation()}>
						<div className="success-modal-icon"><CheckCircle2 /></div>
						<h3>Your registration has been submitted successfully.</h3>
						<p>Thank you for choosing Mauiza. Our team will contact you soon.</p>
						<a
							className="whatsapp-cta"
							href={`https://wa.me/1234567891011?text=${encodeURIComponent(successMessage)}`}
							target="_blank"
							rel="noreferrer"
						>
							<WhatsAppIcon />
							Contact on WhatsApp
						</a>
					</div>
				</div>
			)}
		</main>
	);
}

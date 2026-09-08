import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import PageHero from "../../components/PageHero/PageHero";
import WhatsAppIcon from "../../components/WhatsAppIcon";
import { images } from "../../data/images";
import "./Registration.css";

export default function Registration() {
	const location = useLocation();
	const [sent, setSent] = useState(false);
	const [successMessage, setSuccessMessage] = useState("");
	const [selectedCourse, setSelectedCourse] = useState(location.state?.selectedCourse || "");
	const [schedule, setSchedule] = useState({ start: "", end: "" });

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
		const formData = new FormData(form);
		const courseValue = formData.get("course") || selectedCourse;
		const payload = {
			fullName: formData.get("name")?.trim(),
			email: formData.get("email")?.trim(),
			phone: formData.get("phone")?.trim(),
			country: formData.get("country")?.trim(),
			ageGroup: formData.get("ageGroup")?.trim(),
			gender: formData.get("gender")?.trim(),
			course: courseValue,
			startTime: schedule.start,
			endTime: schedule.end,
			schedule: `${formatTimeForDisplay(schedule.start)} to ${formatTimeForDisplay(schedule.end)}`,
			goals: formData.get("goals")?.trim()
		};
		if (Object.values(payload).some((value) => !value) || schedule.end <= schedule.start) return;

		try {
			const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/registration`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload)
			});

			const data = await response.json();
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
										step="1800"
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
										step="1800"
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
							href={`https://wa.me/447460020357?text=${encodeURIComponent(successMessage)}`}
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

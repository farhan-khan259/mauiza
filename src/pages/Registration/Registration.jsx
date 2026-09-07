import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import PageHero from "../../components/PageHero/PageHero";
import { images } from "../../data/images";
import "./Registration.css";

export default function Registration() {
	const [sent, setSent] = useState(false);

	function submit(event) {
		event.preventDefault();
		setSent(true);
		event.currentTarget.reset();
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
							<label>Email Address<input required type="email" name="email" placeholder="you@example.com" /></label>
						</div>
						<div className="form-row">
							<label>WhatsApp Number<input required name="phone" placeholder="Your WhatsApp number" /></label>
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
								<select required name="course" defaultValue="">
									<option value="" disabled>Select a course</option>
									<option>Namaz Course</option>
									<option>Quran Memorization</option>
									<option>Tajweed Course</option>
									<option>Arabic Reading Course</option>
								</select>
							</label>
						</div>
						<label>
							Preferred Schedule
							<select required name="schedule" defaultValue="">
								<option value="" disabled>Select a preference</option>
								<option>Weekday mornings</option>
								<option>Weekday evenings</option>
								<option>Weekends</option>
								<option>Flexible</option>
							</select>
						</label>
						<label>
							Learning Goals
							<textarea name="goals" rows="4" placeholder="Tell us briefly what you would like to learn..." />
						</label>
						<button type="submit">Submit Registration <span>→</span></button>
						{sent && <p className="form-success"><CheckCircle2 /> Thank you. Your registration has been received.</p>}
					</form>
				</div>
			</section>
		</main>
	);
}

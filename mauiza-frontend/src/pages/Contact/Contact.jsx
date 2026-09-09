import { useState } from "react";
import { CheckCircle2, Clock, Mail, MapPin, Send } from "lucide-react";
import PageHero from "../../components/PageHero/PageHero";
import WhatsAppIcon from "../../components/WhatsAppIcon";
import { images } from "../../data/images";
import "./Contact.css";
const infos = [
  [Mail, "Email Us", "mauizainstitute@gmail.com"],
  [WhatsAppIcon, "WhatsApp Number", "+12 3456 7891011"],
  [Clock, "Availability", "Flexible online learning"],
  [MapPin, "Our Classroom", "Online, worldwide"],
];
export default function Contact() {
  const [sent, setSent] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  return (
    <main className="page">
      <PageHero
        title="We’re Here to Help"
        subtitle="Have a question about a course or your learning journey? Get in touch with us."
        image={images.mosque}
      />
      <section className="section">
        <div className="container">
          <div className="contact-info-grid">
            {infos.map(([Icon, title, text]) => (
              <div key={title}>
                <Icon />
                <small>{title}</small>
                <b>{text}</b>
              </div>
            ))}
          </div>
          <div className="contact-layout">
            <div>
              <p className="eyebrow">GET IN TOUCH</p>
              <h2>Let’s Start a Conversation.</h2>
              <p>
                We would be happy to answer your questions and help you find a
                course that suits your goals.
              </p>
              <p>
                Send us a message and our team will get back to you as soon as
                possible.
              </p>
            </div>
            <form
              className="contact-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);
                const payload = {
                  name: formData.get("name")?.trim(),
                  email: formData.get("email")?.trim(),
                  subject: formData.get("subject")?.trim(),
                  message: formData.get("message")?.trim(),
                };
                if (Object.values(payload).some((value) => !value)) {
                  setErrorMessage("Please complete all required fields.");
                  return;
                }
                try {
                  setSubmitting(true);
                  setErrorMessage("");
                  const apiBaseUrl = (
                    import.meta.env.VITE_API_URL ||
                    "https://mauiza-backend.onrender.com"
                  ).replace(/\/+$/, "");
                  const response = await fetch(
                    `${apiBaseUrl}/api/contact`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    },
                  );
                  const contentType = response.headers.get("content-type") || "";
                  const data = contentType.includes("application/json")
                    ? await response.json()
                    : {
                        message: `Contact request failed (${response.status}). Please try again.`,
                      };
                  if (!response.ok)
                    throw new Error(data.message || "Failed to send message");
                  const whatsappMessage = `Hello Mauiza, I have sent a message through your contact form. My name is ${payload.name} and my email is ${payload.email}. I would like to follow up regarding: ${payload.subject}.`;
                  setSuccessMessage(whatsappMessage);
                  setSent(true);
                  form.reset();
                } catch (error) {
                  console.error("Contact form error:", error);
                  setErrorMessage(error.message || "Failed to send message. Please try again.");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <label>
                Your Name
                <input required name="name" placeholder="Your name" />
              </label>
              <label>
                Email Address
                <input
                  required
                  type="email"
                  name="email"
                  placeholder="mauizainstitute@gmail.com"
                />
              </label>
              <label>
                Subject
                <input required name="subject" placeholder="How can we help?" />
              </label>
              <label>
                Your Message
                <textarea
                  required
                  rows="5"
                  name="message"
                  placeholder="Write your message here..."
                />
              </label>
              {errorMessage && <p className="contact-error" role="alert">{errorMessage}</p>}
              <button type="submit" disabled={submitting}>
                <Send /> {submitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      </section>
      {sent && (
        <div className="success-modal-backdrop" onClick={() => setSent(false)}>
          <div
            className="success-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="success-modal-icon">
              <CheckCircle2 />
            </div>
            <h3>Your message has been sent successfully.</h3>
            <p>Thank you for reaching out to Mauiza. We’ll be in touch soon.</p>
            <a
              className="whatsapp-cta"
              href={`https://wa.me/1234567891011?text=${encodeURIComponent(successMessage)}`}
              target="_blank"
              rel="noreferrer"
            >
              <WhatsAppIcon /> Contact on WhatsApp
            </a>
          </div>
        </div>
      )}
    </main>
  );
}

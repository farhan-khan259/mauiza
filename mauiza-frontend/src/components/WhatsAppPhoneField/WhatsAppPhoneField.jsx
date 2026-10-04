import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js/min";
import { useLanguage } from "../../context/LanguageContext";
import "./WhatsAppPhoneField.css";

const supportedCountries = getCountries();

export default function WhatsAppPhoneField() {
	const { language, t } = useLanguage();
	const fieldId = useId();
	const phoneRef = useRef(null);
	const [selectedCountry, setSelectedCountry] = useState("");
	const [phoneNumber, setPhoneNumber] = useState("");
	const displayNames = new Intl.DisplayNames([language], { type: "region" });
	const countries = useMemo(() => supportedCountries.map((code) => ({
		code,
		name: displayNames.of(code) || code,
		dialCode: `+${getCountryCallingCode(code)}`
	})).sort((first, second) => new Intl.Collator(language).compare(first.name, second.name)), [language]);
	const selected = countries.find((country) => country.code === selectedCountry);
	const parsedPhone = selectedCountry && phoneNumber
		? parsePhoneNumberFromString(phoneNumber, selectedCountry)
		: undefined;
	const completePhoneNumber = parsedPhone?.isValid() ? parsedPhone.number : "";

	useEffect(() => {
		const input = phoneRef.current;
		if (!input) return;
		if (!selectedCountry) {
			input.setCustomValidity(t("Please select a country code."));
		} else if (phoneNumber && !isValidPhoneNumber(phoneNumber, selectedCountry)) {
			input.setCustomValidity(t("Enter a valid phone number for the selected country code."));
		} else {
			input.setCustomValidity("");
		}
	}, [phoneNumber, selectedCountry, t]);

	useEffect(() => {
		const form = phoneRef.current?.form;
		const reset = () => {
			setSelectedCountry("");
			setPhoneNumber("");
		};
		form?.addEventListener("reset", reset);
		return () => form?.removeEventListener("reset", reset);
	}, []);

	return (
		<div className="whatsapp-phone-field" data-translation-owned="true">
			<label htmlFor={`${fieldId}-number`}>{t("WhatsApp Number")}</label>
			<div className="whatsapp-phone-control">
				<select
					className="whatsapp-country-select"
					name="phoneCountry"
					aria-label={t("Select country calling code")}
					value={selectedCountry}
					onChange={(event) => setSelectedCountry(event.target.value)}
					required
				>
					<option value="" disabled>{t("Code")}</option>
					{countries.map((country) => (
						<option key={country.code} value={country.code}>{country.dialCode} {country.name}</option>
					))}
				</select>
				<input type="hidden" name="phoneCountryCode" value={selected?.dialCode || ""} />
				<input
					id={`${fieldId}-number`}
					ref={phoneRef}
					type="tel"
					name="phoneNumber"
					value={phoneNumber}
					required
					inputMode="tel"
					autoComplete="tel-national"
					placeholder={t("Your WhatsApp number")}
					aria-label={t("Phone number without country code")}
					aria-invalid={Boolean(phoneNumber && selectedCountry && !isValidPhoneNumber(phoneNumber, selectedCountry))}
					onChange={(event) => setPhoneNumber(event.target.value)}
				/>
				<input type="hidden" name="phone" value={completePhoneNumber} />
			</div>
		</div>
	);
}
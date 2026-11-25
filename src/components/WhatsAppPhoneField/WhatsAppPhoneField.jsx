import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js/min";
import { useLanguage } from "../../context/LanguageContext";
import "./WhatsAppPhoneField.css";

const supportedCountries = getCountries();

export default function WhatsAppPhoneField() {
	const { language, t } = useLanguage();
	const fieldId = useId();
	const phoneRef = useRef(null);
	const countryRef = useRef(null);
	const [selectedCountry, setSelectedCountry] = useState("");
	const [phoneNumber, setPhoneNumber] = useState("");
	const [countrySearch, setCountrySearch] = useState("");
	const displayNames = new Intl.DisplayNames([language], { type: "region" });
	const countries = useMemo(() => supportedCountries.map((code) => ({
		code,
		name: displayNames.of(code) || code,
		dialCode: `+${getCountryCallingCode(code)}`
	})).sort((first, second) => {
		const dialCodeDifference = Number(first.dialCode.slice(1)) - Number(second.dialCode.slice(1));
		return dialCodeDifference || new Intl.Collator(language).compare(first.name, second.name);
	}), [language]);
	const visibleCountries = useMemo(() => {
		const query = countrySearch.trim().toLocaleLowerCase(language);
		if (!query) return countries;
		return countries
			.filter((country) => `${country.dialCode} ${country.name}`.toLocaleLowerCase(language).includes(query))
			.sort((first, second) => {
				const firstStartsWithQuery = first.name.toLocaleLowerCase(language).startsWith(query);
				const secondStartsWithQuery = second.name.toLocaleLowerCase(language).startsWith(query);
				return Number(secondStartsWithQuery) - Number(firstStartsWithQuery);
			});
	}, [countries, countrySearch, language]);
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
		const input = countryRef.current;
		if (!input) return;
		input.setCustomValidity(selectedCountry ? "" : t("Please select a country code."));
	}, [selectedCountry, t]);

	useEffect(() => {
		const form = phoneRef.current?.form;
		const reset = () => {
			setSelectedCountry("");
			setPhoneNumber("");
			setCountrySearch("");
		};
		form?.addEventListener("reset", reset);
		return () => form?.removeEventListener("reset", reset);
	}, []);

	return (
		<div className="whatsapp-phone-field" data-translation-owned="true">
			<label htmlFor={`${fieldId}-number`}>{t("WhatsApp Number")}</label>
			<div className="whatsapp-phone-control">
				<input
					ref={countryRef}
					className="whatsapp-country-select"
					name="phoneCountry"
					type="text"
					list={`${fieldId}-countries`}
					aria-label={t("Select country calling code")}
					placeholder={t("Code")}
					value={countrySearch}
					onChange={(event) => {
						const value = event.target.value;
						const country = countries.find((item) => `${item.dialCode} ${item.name}` === value);
						setCountrySearch(value);
						setSelectedCountry(country?.code || "");
					}}
					required
				/>
				<datalist id={`${fieldId}-countries`}>
					{visibleCountries.map((country) => (
						<option key={country.code} value={`${country.dialCode} ${country.name}`} />
					))}
				</datalist>
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
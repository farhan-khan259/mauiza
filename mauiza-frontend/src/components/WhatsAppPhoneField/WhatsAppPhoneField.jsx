import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js/min";
import { useLanguage } from "../../context/LanguageContext";
import "./WhatsAppPhoneField.css";

const supportedCountries = getCountries();

export default function WhatsAppPhoneField() {
	const { language, t } = useLanguage();
	const fieldId = useId();
	const rootRef = useRef(null);
	const searchRef = useRef(null);
	const phoneRef = useRef(null);
	const [selectedCountry, setSelectedCountry] = useState("");
	const [phoneNumber, setPhoneNumber] = useState("");
	const [search, setSearch] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	const displayNames = new Intl.DisplayNames([language], { type: "region" });
	const countries = useMemo(() => supportedCountries.map((code) => ({
		code,
		name: displayNames.of(code) || code,
		dialCode: `+${getCountryCallingCode(code)}`
	})).sort((first, second) => new Intl.Collator(language).compare(first.name, second.name)), [language]);
	const selected = countries.find((country) => country.code === selectedCountry);
	const normalizedSearch = search.trim().toLocaleLowerCase(language);
	const matchingCountries = countries.filter(({ code, name, dialCode }) =>
		`${name} ${code} ${dialCode}`.toLocaleLowerCase(language).includes(normalizedSearch)
	).sort((first, second) => {
		const relevance = (country) => {
			const countryCode = country.code.toLocaleLowerCase(language);
			const name = country.name.toLocaleLowerCase(language);
			const dialCode = country.dialCode.toLocaleLowerCase(language);
			const dialDigits = dialCode.slice(1);
			if (countryCode === normalizedSearch || dialCode === normalizedSearch || dialDigits === normalizedSearch) return 0;
			if (name.startsWith(normalizedSearch)) return 1;
			if (countryCode.startsWith(normalizedSearch) || dialCode.startsWith(normalizedSearch)) return 2;
			return 3;
		};
		return relevance(first) - relevance(second) || new Intl.Collator(language).compare(first.name, second.name);
	});
	const parsedPhone = selectedCountry && phoneNumber
		? parsePhoneNumberFromString(phoneNumber, selectedCountry)
		: undefined;
	const completePhoneNumber = parsedPhone?.isValid() ? parsedPhone.number : "";

	useEffect(() => {
		if (!isOpen) return undefined;
		searchRef.current?.focus();
		const closeOnOutsideClick = (event) => {
			if (!rootRef.current?.contains(event.target)) setIsOpen(false);
		};
		document.addEventListener("pointerdown", closeOnOutsideClick);
		return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
	}, [isOpen]);

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
			setSearch("");
			setIsOpen(false);
		};
		form?.addEventListener("reset", reset);
		return () => form?.removeEventListener("reset", reset);
	}, []);

	function handleSearchKeyDown(event) {
		if (event.key === "Escape") {
			event.preventDefault();
			setIsOpen(false);
		} else if (event.key === "ArrowDown" && matchingCountries.length) {
			event.preventDefault();
			setActiveIndex((index) => (index + 1) % matchingCountries.length);
		} else if (event.key === "ArrowUp" && matchingCountries.length) {
			event.preventDefault();
			setActiveIndex((index) => (index - 1 + matchingCountries.length) % matchingCountries.length);
		} else if (event.key === "Enter" && matchingCountries[activeIndex]) {
			event.preventDefault();
			setSelectedCountry(matchingCountries[activeIndex].code);
			setIsOpen(false);
		}
	}

	return (
		<div className="whatsapp-phone-field" ref={rootRef}>
			<label htmlFor={`${fieldId}-number`}>{t("WhatsApp Number")}</label>
			<div className="whatsapp-phone-control">
				<button
					className="whatsapp-code-trigger"
					type="button"
					aria-label={t("Select country calling code")}
					aria-haspopup="listbox"
					aria-expanded={isOpen}
					onClick={() => {
						setSearch("");
						setActiveIndex(0);
						setIsOpen((open) => !open);
					}}
				>
					<span>{selected ? `${selected.dialCode} ${selected.name}` : t("Code")}</span>
					<span aria-hidden="true">▾</span>
				</button>
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
				{isOpen && (
					<div className="whatsapp-country-menu">
						<input
							ref={searchRef}
							className="whatsapp-country-search"
							type="search"
							role="combobox"
							aria-label={t("Search country or calling code")}
							aria-autocomplete="list"
							aria-controls={`${fieldId}-country-list`}
							aria-activedescendant={matchingCountries[activeIndex] ? `${fieldId}-country-${matchingCountries[activeIndex].code}` : undefined}
							aria-expanded="true"
							placeholder={t("Search country or calling code")}
							value={search}
							onChange={(event) => {
								setSearch(event.target.value);
								setActiveIndex(0);
							}}
							onKeyDown={handleSearchKeyDown}
						/>
						<div id={`${fieldId}-country-list`} className="whatsapp-country-options" role="listbox">
							{matchingCountries.length ? matchingCountries.map((country, index) => (
								<button
									key={country.code}
									id={`${fieldId}-country-${country.code}`}
									className="whatsapp-country-option"
									data-active={index === activeIndex}
									role="option"
									aria-selected={country.code === selectedCountry}
									type="button"
									onMouseEnter={() => setActiveIndex(index)}
									onClick={() => {
										setSelectedCountry(country.code);
										setIsOpen(false);
									}}
								>
									<span>{country.name}</span>
									<strong>{country.dialCode}</strong>
								</button>
							)) : <p className="whatsapp-country-empty">{t("No countries found")}</p>}
						</div>
					</div>
					)}
			</div>
		</div>
	);
}
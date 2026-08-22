"use client";

import { useEffect, useRef, useState } from "react";

export type GooglePlaceSelection = {
  city?: string;
  country?: string;
  formattedAddress?: string;
  latitude: string;
  longitude: string;
  postalCode?: string;
  province?: string;
  street?: string;
};

type GooglePlacesSearchProps = {
  apiKey?: string;
  disabled?: boolean;
  label: string;
  maxLength?: number;
  minLength?: number;
  name?: string;
  onInputChange?: (value: string) => void;
  onPlaceSelect: (selection: GooglePlaceSelection) => void;
  placeholder?: string;
  required?: boolean;
  value?: string;
};

type GoogleMapsApi = {
  maps: {
    importLibrary: (libraryName: "places") => Promise<GooglePlacesLibrary>;
  };
};

type GooglePlacesLibrary = {
  PlaceAutocompleteElement: new (options?: Record<string, unknown>) => GooglePlaceAutocompleteElement;
};

type GooglePlaceAutocompleteElement = HTMLElement & {
  includedRegionCodes?: string[];
  placeholder?: string;
  value?: string;
};

type GooglePlacePredictionSelectEvent = Event & {
  placePrediction?: {
    toPlace: () => GooglePlace;
  };
};

type GooglePlace = {
  addressComponents?: GoogleAddressComponent[];
  fetchFields: (request: { fields: string[] }) => Promise<void>;
  formattedAddress?: string;
  location?: {
    lat: () => number;
    lng: () => number;
  };
};

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type WindowWithGoogleMaps = Window & {
  google?: GoogleMapsApi;
  __medshiftGoogleMapsReady?: () => void;
  __medshiftGooglePlacesLoading?: Promise<GoogleMapsApi>;
};

const googleMapsScriptId = "medshift-google-maps-places";
const googleMapsCallbackName = "__medshiftGoogleMapsReady";

export function GooglePlacesSearch({
  apiKey,
  disabled = false,
  label,
  maxLength,
  minLength,
  name,
  onInputChange,
  onPlaceSelect,
  placeholder = "Search address",
  required = false,
  value
}: GooglePlacesSearchProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const autocompleteRef = useRef<GooglePlaceAutocompleteElement | null>(null);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "fallback">("idle");

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  useEffect(() => {
    if (!apiKey || disabled || !hostRef.current) {
      setStatus("fallback");
      return;
    }

    let cancelled = false;
    setStatus("loading");

    loadGooglePlaces(apiKey)
      .then((googleMaps) => googleMaps.maps.importLibrary("places"))
      .then(({ PlaceAutocompleteElement }) => {
        if (cancelled || !hostRef.current) {
          return;
        }

        if (!autocompleteRef.current) {
          const autocomplete = new PlaceAutocompleteElement();
          autocomplete.placeholder = placeholder;
          autocomplete.value = value ?? "";
          autocomplete.includedRegionCodes = ["ca"];
          autocomplete.addEventListener("gmp-select", (event) => {
            void handlePlaceSelect(event as GooglePlacePredictionSelectEvent, (selection) => onPlaceSelectRef.current(selection), setStatus);
          });
          hostRef.current.replaceChildren(autocomplete);
          autocompleteRef.current = autocomplete;
        }

        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("fallback");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, disabled, placeholder]);

  useEffect(() => {
    if (autocompleteRef.current && value !== undefined && autocompleteRef.current.value !== value) {
      autocompleteRef.current.value = value;
    }
  }, [value]);

  useEffect(() => {
    return () => {
      autocompleteRef.current?.remove();
      autocompleteRef.current = null;
    };
  }, []);

  return (
    <label className="places-search-field">
      <span>{label}</span>
      <div className={status === "fallback" ? "places-search-control is-hidden" : "places-search-control"} ref={hostRef} aria-busy={status === "loading"} />
      {status === "fallback" ? (
        <input disabled={disabled} maxLength={maxLength} minLength={minLength} name={name} onChange={(event) => onInputChange?.(event.target.value)} placeholder={placeholder} required={required} value={value ?? ""} />
      ) : null}
      <small>{getStatusText(status, Boolean(apiKey), disabled)}</small>
    </label>
  );
}

async function handlePlaceSelect(
  event: GooglePlacePredictionSelectEvent,
  onPlaceSelect: (selection: GooglePlaceSelection) => void,
  setStatus: (status: "idle" | "loading" | "ready" | "fallback") => void
) {
  const place = event.placePrediction?.toPlace();

  if (!place) {
    return;
  }

  setStatus("loading");

  try {
    await place.fetchFields({ fields: ["formattedAddress", "location", "addressComponents"] });

    const latitude = place.location?.lat();
    const longitude = place.location?.lng();

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setStatus("fallback");
      return;
    }

    onPlaceSelect({
      ...extractAddressFields(place.addressComponents ?? []),
      formattedAddress: place.formattedAddress,
      latitude: (latitude as number).toFixed(6),
      longitude: (longitude as number).toFixed(6)
    });
    setStatus("ready");
  } catch {
    setStatus("fallback");
  }
}

function extractAddressFields(addressComponents: GoogleAddressComponent[]) {
  const streetNumber = findComponent(addressComponents, "street_number")?.shortText;
  const route = findComponent(addressComponents, "route")?.longText;
  const city =
    findComponent(addressComponents, "locality")?.longText ??
    findComponent(addressComponents, "postal_town")?.longText ??
    findComponent(addressComponents, "administrative_area_level_3")?.longText;
  const province = findComponent(addressComponents, "administrative_area_level_1")?.shortText;
  const postalCode = findComponent(addressComponents, "postal_code")?.longText;
  const country = findComponent(addressComponents, "country")?.shortText;
  const street = [streetNumber, route].filter(Boolean).join(" ");

  return {
    city,
    country,
    postalCode,
    province,
    street: street || undefined
  };
}

function findComponent(addressComponents: GoogleAddressComponent[], componentType: string) {
  return addressComponents.find((component) => component.types?.includes(componentType));
}

function loadGooglePlaces(apiKey: string) {
  const browserWindow = window as WindowWithGoogleMaps;

  if (browserWindow.google?.maps?.importLibrary) {
    return Promise.resolve(browserWindow.google);
  }

  if (browserWindow.__medshiftGooglePlacesLoading) {
    return browserWindow.__medshiftGooglePlacesLoading;
  }

  browserWindow.__medshiftGooglePlacesLoading = new Promise<GoogleMapsApi>((resolve, reject) => {
    const existingScript = document.getElementById(googleMapsScriptId) as HTMLScriptElement | null;

    browserWindow.__medshiftGoogleMapsReady = () => {
      if (browserWindow.google?.maps?.importLibrary) {
        resolve(browserWindow.google);
        return;
      }

      reject(new Error("Google Maps unavailable"));
    };

    if (existingScript) {
      existingScript.addEventListener("error", () => reject(new Error("Google Maps failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.id = googleMapsScriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=${googleMapsCallbackName}&loading=async`;
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });

  return browserWindow.__medshiftGooglePlacesLoading;
}

function getStatusText(status: "idle" | "loading" | "ready" | "fallback", hasApiKey: boolean, disabled: boolean) {
  if (disabled) {
    return "Address search is paused while this form is loading.";
  }

  if (!hasApiKey) {
    return "Set NEXT_PUBLIC_GOOGLE_PLACES_API_KEY to enable address search.";
  }

  if (status === "ready") {
    return "Select an address to prefill coordinates.";
  }

  if (status === "loading" || status === "idle") {
    return "Loading address search.";
  }

  return "Address search is unavailable. Manual fields still work.";
}

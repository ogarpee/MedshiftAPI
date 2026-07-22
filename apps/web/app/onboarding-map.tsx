"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type OnboardingMapProps = {
  label: string;
  latitude: string;
  longitude: string;
  token?: string;
  zoom?: number;
  onCoordinatesChange?: (coordinates: { latitude: string; longitude: string }) => void;
};

type MapboxApi = {
  accessToken: string;
  Map: new (options: Record<string, unknown>) => MapboxMap;
  Marker: new (options?: Record<string, unknown>) => MapboxMarker;
  NavigationControl: new (options?: Record<string, unknown>) => unknown;
};

type MapboxMap = {
  addControl: (control: unknown, position?: string) => void;
  easeTo: (options: { center: [number, number]; zoom?: number }) => void;
  on: (event: string, callback: (event: { lngLat: { lng: number; lat: number } }) => void) => void;
  remove: () => void;
  resize: () => void;
};

type MapboxMarker = {
  addTo: (map: MapboxMap) => MapboxMarker;
  getLngLat: () => { lng: number; lat: number };
  on: (event: string, callback: () => void) => void;
  remove: () => void;
  setLngLat: (coordinates: [number, number]) => MapboxMarker;
};

type WindowWithMapbox = Window & { mapboxgl?: MapboxApi; __medshiftMapboxLoading?: Promise<MapboxApi> };

const mapboxScriptUrl = "https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.js";
const mapboxCssUrl = "https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css";

export function OnboardingMap({ label, latitude, longitude, token, zoom = 11, onCoordinatesChange }: OnboardingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<MapboxMarker | null>(null);
  const [mapState, setMapState] = useState<"idle" | "loading" | "ready" | "fallback">("idle");
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  const hasCoordinates = Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude);
  const coordinates = useMemo<[number, number] | null>(() => (hasCoordinates ? [parsedLongitude, parsedLatitude] : null), [hasCoordinates, parsedLatitude, parsedLongitude]);

  useEffect(() => {
    if (!token || !coordinates || !containerRef.current) {
      setMapState("fallback");
      return;
    }

    let cancelled = false;
    setMapState("loading");

    loadMapbox()
      .then((mapboxgl) => {
        if (cancelled || !containerRef.current) {
          return;
        }

        mapboxgl.accessToken = token;

        if (!mapRef.current) {
          const map = new mapboxgl.Map({
            center: coordinates,
            container: containerRef.current,
            style: "mapbox://styles/mapbox/streets-v12",
            zoom
          });
          const marker = new mapboxgl.Marker({ color: "#0b1f3a", draggable: Boolean(onCoordinatesChange) }).setLngLat(coordinates).addTo(map);

          map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
          map.on("click", (event) => {
            if (!onCoordinatesChange) {
              return;
            }

            marker.setLngLat([event.lngLat.lng, event.lngLat.lat]);
            onCoordinatesChange(formatCoordinates(event.lngLat.lat, event.lngLat.lng));
          });
          marker.on("dragend", () => {
            if (!onCoordinatesChange) {
              return;
            }

            const nextCoordinates = marker.getLngLat();
            onCoordinatesChange(formatCoordinates(nextCoordinates.lat, nextCoordinates.lng));
          });

          mapRef.current = map;
          markerRef.current = marker;
          window.requestAnimationFrame(() => map.resize());
        } else {
          mapRef.current.easeTo({ center: coordinates, zoom });
          markerRef.current?.setLngLat(coordinates);
        }

        setMapState("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setMapState("fallback");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [coordinates, onCoordinatesChange, token, zoom]);

  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      mapRef.current?.remove();
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="mapbox-panel" aria-label={label}>
      <div className="mapbox-canvas" ref={containerRef} />
      <div className={mapState === "ready" ? "mapbox-fallback compact" : "mapbox-fallback"}>
        <strong>{label}</strong>
        <span>{hasCoordinates ? `${parsedLatitude.toFixed(4)}, ${parsedLongitude.toFixed(4)}` : "Enter valid coordinates"}</span>
        <small>{getMapStatusText(mapState, Boolean(token))}</small>
      </div>
    </div>
  );
}

function loadMapbox() {
  const browserWindow = window as WindowWithMapbox;

  if (browserWindow.mapboxgl) {
    return Promise.resolve(browserWindow.mapboxgl);
  }

  if (browserWindow.__medshiftMapboxLoading) {
    return browserWindow.__medshiftMapboxLoading;
  }

  browserWindow.__medshiftMapboxLoading = new Promise<MapboxApi>((resolve, reject) => {
    if (!document.querySelector(`link[href="${mapboxCssUrl}"]`)) {
      const link = document.createElement("link");
      link.href = mapboxCssUrl;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${mapboxScriptUrl}"]`);

    if (existingScript) {
      existingScript.addEventListener("load", () => (browserWindow.mapboxgl ? resolve(browserWindow.mapboxgl) : reject(new Error("Mapbox unavailable"))), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Mapbox failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = mapboxScriptUrl;
    script.onload = () => (browserWindow.mapboxgl ? resolve(browserWindow.mapboxgl) : reject(new Error("Mapbox unavailable")));
    script.onerror = () => reject(new Error("Mapbox failed to load"));
    document.head.appendChild(script);
  });

  return browserWindow.__medshiftMapboxLoading;
}

function formatCoordinates(latitude: number, longitude: number) {
  return {
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6)
  };
}

function getMapStatusText(mapState: "idle" | "loading" | "ready" | "fallback", hasToken: boolean) {
  if (!hasToken) {
    return "Set NEXT_PUBLIC_MAPBOX_TOKEN or NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN for live Mapbox";
  }

  if (mapState === "ready") {
    return "Click or drag the pin to refine this location";
  }

  if (mapState === "loading" || mapState === "idle") {
    return "Loading Mapbox";
  }

  return "Mapbox could not load. Coordinates are still saved.";
}

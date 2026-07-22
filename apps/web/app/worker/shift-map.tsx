"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MatchedShiftSummary } from "@medshift/shared-types";

type ShiftMapProps = {
  selectedShiftId?: string;
  shifts: MatchedShiftSummary[];
  token?: string;
  onSelectShift: (shiftId: string) => void;
};

type MapboxApi = {
  accessToken: string;
  Map: new (options: Record<string, unknown>) => MapboxMap;
  Marker: new (element?: HTMLElement, options?: Record<string, unknown>) => MapboxMarker;
  NavigationControl: new (options?: Record<string, unknown>) => unknown;
};

type MapboxMap = {
  addControl: (control: unknown, position?: string) => void;
  easeTo: (options: { center: [number, number]; zoom?: number }) => void;
  remove: () => void;
  resize: () => void;
};

type MapboxMarker = {
  addTo: (map: MapboxMap) => MapboxMarker;
  remove: () => void;
  setLngLat: (coordinates: [number, number]) => MapboxMarker;
};

type WindowWithMapbox = Window & { mapboxgl?: MapboxApi; __medshiftMapboxLoading?: Promise<MapboxApi> };

const mapboxScriptUrl = "https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.js";
const mapboxCssUrl = "https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css";

export function ShiftMap({ selectedShiftId, shifts, token, onSelectShift }: ShiftMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRefs = useRef<MapboxMarker[]>([]);
  const [mapState, setMapState] = useState<"idle" | "loading" | "ready" | "fallback">("idle");
  const validShifts = useMemo(
    () =>
      shifts.filter((shift) => {
        const [longitude, latitude] = shift.location.coordinates;
        return Number.isFinite(longitude) && Number.isFinite(latitude);
      }),
    [shifts]
  );
  const center = useMemo<[number, number]>(() => {
    const selectedShift = validShifts.find((shift) => shift.id === selectedShiftId) ?? validShifts[0];
    return selectedShift?.location.coordinates ?? [-114.0719, 51.0447];
  }, [selectedShiftId, validShifts]);

  useEffect(() => {
    if (!token || !containerRef.current || !validShifts.length) {
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
            center,
            container: containerRef.current,
            style: "mapbox://styles/mapbox/streets-v12",
            zoom: 11
          });
          map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
          mapRef.current = map;
        } else {
          mapRef.current.easeTo({ center, zoom: 11 });
        }

        markerRefs.current.forEach((marker) => marker.remove());
        markerRefs.current = validShifts.map((shift) => {
          const markerElement = document.createElement("button");
          markerElement.type = "button";
          markerElement.className = shift.id === selectedShiftId ? "shift-map-marker active" : "shift-map-marker";
          markerElement.setAttribute("aria-label", `Select ${shift.facility?.name ?? shift.roleRequired} shift`);
          markerElement.textContent = `$${shift.hourlyRate}`;
          markerElement.addEventListener("click", () => onSelectShift(shift.id));

          return new mapboxgl.Marker(markerElement).setLngLat(shift.location.coordinates).addTo(mapRef.current as MapboxMap);
        });

        window.requestAnimationFrame(() => mapRef.current?.resize());
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
  }, [center, onSelectShift, selectedShiftId, token, validShifts]);

  useEffect(() => {
    return () => {
      markerRefs.current.forEach((marker) => marker.remove());
      mapRef.current?.remove();
      markerRefs.current = [];
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="shift-mapbox" aria-label="Nearby shifts Mapbox view">
      <div className="shift-mapbox-canvas" ref={containerRef} />
      <div className={mapState === "ready" ? "shift-mapbox-status compact" : "shift-mapbox-status"}>
        <strong>Nearby shift map</strong>
        <span>{validShifts.length ? `${validShifts.length} shifts around Calgary` : "No valid shift coordinates"}</span>
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

function getMapStatusText(mapState: "idle" | "loading" | "ready" | "fallback", hasToken: boolean) {
  if (!hasToken) {
    return "Set NEXT_PUBLIC_MAPBOX_TOKEN or NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN for live Mapbox";
  }

  if (mapState === "ready") {
    return "Select a pin to inspect a shift";
  }

  if (mapState === "loading" || mapState === "idle") {
    return "Loading Mapbox";
  }

  return "Mapbox could not load. Shift coordinates are still shown.";
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const request = withSession(init);
  let response = await globalThis.fetch(input, request);
  if (response.status === 401 && !String(input).endsWith("/auth/refresh")) {
    const refreshed = await globalThis.fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/auth/refresh`, withSession({ method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
    if (refreshed.ok) response = await globalThis.fetch(input, withSession(init));
  }
  return response;
}

function withSession(init: RequestInit): RequestInit {
  const headers = new Headers(init.headers);
  headers.delete("Authorization");
  if (typeof document !== "undefined" && init.method && !["GET", "HEAD", "OPTIONS"].includes(init.method.toUpperCase())) {
    const csrf = readCookie("medshift_csrf");
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  return { ...init, credentials: "include", headers };
}

function readCookie(name: string) {
  const entry = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined;
}

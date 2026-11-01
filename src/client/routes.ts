/**
 * Client routes, kept in the URL hash so the server only ever serves one page
 * and reloads/back/forward work. The only place route URLs are built or parsed.
 */
import { useEffect, useState } from "react";

export type Route = { view: "library" } | { view: "reader"; documentId: string };

export function parseRoute(hash: string): Route {
  const match = /^#\/documents\/([^/]+)$/.exec(hash);
  return match ? { view: "reader", documentId: decodeURIComponent(match[1]!) } : { view: "library" };
}

export function routeHref(route: Route): string {
  return route.view === "reader" ? `#/documents/${encodeURIComponent(route.documentId)}` : "#/";
}

/** The current route; re-renders on navigation. */
export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

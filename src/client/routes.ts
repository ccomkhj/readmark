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

/** History state a `navigate` call leaves for the target view. */
type RouteState = { notice?: string };

/**
 * Go to `route`. `notice` is a one-off message for the target view to show
 * (read it with `routeNotice`, then drop it with `clearRouteNotice`), so it
 * is not shown again on reload.
 */
export function navigate(route: Route, notice?: string): void {
  window.history.pushState({ notice } satisfies RouteState, "", routeHref(route));
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

/** The notice the current history entry was navigated to with, if any. Pure. */
export function routeNotice(): string | null {
  return (window.history.state as RouteState | null)?.notice ?? null;
}

/** Drop the current history entry's notice (the URL stays). */
export function clearRouteNotice(): void {
  window.history.replaceState(null, "");
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

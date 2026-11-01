import { LibraryView } from "./library/LibraryView.tsx";
import { ReaderView } from "./reader/ReaderView.tsx";
import { useRoute } from "./routes.ts";

/** Top-level view switch, driven by the URL hash (see routes.ts). */
export function App() {
  const route = useRoute();
  return route.view === "reader" ? <ReaderView key={route.documentId} documentId={route.documentId} /> : <LibraryView />;
}

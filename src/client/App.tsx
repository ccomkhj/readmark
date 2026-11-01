import { LibraryView } from "./library/LibraryView.tsx";

/** Top-level view switch. Only the Library exists so far; the Reader view comes later. */
export function App() {
  return <LibraryView />;
}

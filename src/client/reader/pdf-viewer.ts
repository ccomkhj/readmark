/**
 * PdfViewer: imperative continuous-scroll PDF renderer for the Reader view.
 *
 * Owns the DOM inside a scroll container: one `.pdf-page` element per page,
 * sized up front from the page's dimensions, rendered (canvas + PDF.js text
 * layer) only while it is near the viewport and released when it scrolls far
 * away, so long Documents stay responsive.
 *
 * Extension points for later features (selection mapping, Highlight overlays,
 * sidebar scroll-to):
 * - `renderedPage(n)` / `whenRendered(n)` give a page's text-layer elements,
 *   each with its start offset in the canonical page text.
 * - `on("pageRendered" | "pageReleased", ...)` to (re)draw / drop overlays;
 *   `on("pageError", ...)` when a page could not be rendered.
 *   A page is re-rendered (new elements) after every zoom change.
 * - `scrollToPage(n, y)` scrolls to a point on a page.
 * - `pageElement(n)` is a positioned container overlays can be appended to.
 * - `scrollContainer` is the element that scrolls (for scroll/click listeners).
 */
import { layoutPageText, type PdfTextItem } from "../../shared/page-text.ts";
import { loadPdf, pdfjs } from "../pdf/pdfjs.ts";

/** One text-layer element: exactly one PDF.js text item of the page. */
export type TextItemElement = {
  /** The span PDF.js created for the item. Empty-string items are not in the DOM. */
  element: HTMLElement;
  /** The item's string (PDF.js `str`; equals `element.textContent`). */
  str: string;
  /** Offset of the item's first character in the page's canonical page text. */
  start: number;
};

/** A page whose canvas and text layer are currently in the DOM. */
export type RenderedPage = {
  /** 1-based physical page index (same as anchors). */
  pageNumber: number;
  /** The `.pdf-page` element (position: relative). */
  element: HTMLElement;
  /** The `.textLayer` element. */
  textLayer: HTMLElement;
  /** Canonical page text (identical to what the server stored at import). */
  text: string;
  /** Text items in canonical order. */
  items: TextItemElement[];
  /** Scale this rendering was made at. */
  scale: number;
};

type ViewerEvents = {
  /** The page under the top part of the viewport changed. */
  pageChange: number;
  scaleChange: number;
  pageRendered: RenderedPage;
  /** A page's canvas and text layer were removed (scrolled away or zoom changed). */
  pageReleased: number;
  /** A page failed to render (it shows an error message in place of its content). */
  pageError: number;
};

type Listener<T> = (value: T) => void;

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 4;
/** Vertical gap between pages, px. Keep in sync with `.pdf-pages` gap in styles.css. */
const PAGE_GAP = 16;
/** Fraction of the viewport height whose page counts as "current". */
const CURRENT_PAGE_PROBE = 0.3;

type PageSlot = {
  pageNumber: number;
  element: HTMLElement;
  /** Unscaled page size (PDF units at scale 1, rotation applied). */
  width: number;
  height: number;
  /** Bumped on every render/release so stale async work is dropped. */
  generation: number;
  renderTask: { cancel(): void } | null;
  textLayer: pdfjs.TextLayer | null;
  rendered: RenderedPage | null;
};

export class PdfViewer {
  #pdf: pdfjs.PDFDocumentProxy;
  #scroller: HTMLElement;
  #pagesEl: HTMLElement;
  #slots: PageSlot[];
  #scale: number;
  #currentPage = 1;
  #observer: IntersectionObserver;
  #listeners = new Map<keyof ViewerEvents, Set<Listener<never>>>();
  #waiters = new Map<number, Array<(page: RenderedPage) => void>>();
  #scrollFrame = 0;
  #destroyed = false;
  #untrackSelection: () => void;

  /**
   * Load the PDF at `url` and lay out all its pages inside `scroller` (an
   * element with `overflow: auto`). Rendering starts immediately for pages
   * near the viewport.
   */
  static async open(scroller: HTMLElement, url: string, options: { scale: number }): Promise<PdfViewer> {
    const pdf = await loadPdf(url);
    const sizes = await Promise.all(
      Array.from({ length: pdf.numPages }, async (_, i) => {
        const viewport = (await pdf.getPage(i + 1)).getViewport({ scale: 1 });
        return { width: viewport.width, height: viewport.height };
      }),
    );
    return new PdfViewer(pdf, scroller, sizes, options.scale);
  }

  private constructor(
    pdf: pdfjs.PDFDocumentProxy,
    scroller: HTMLElement,
    sizes: Array<{ width: number; height: number }>,
    scale: number,
  ) {
    this.#pdf = pdf;
    this.#scroller = scroller;
    this.#scale = clampScale(scale);

    this.#pagesEl = document.createElement("div");
    this.#pagesEl.className = "pdf-pages";
    this.#slots = sizes.map(({ width, height }, i) => {
      const element = document.createElement("div");
      element.className = "pdf-page";
      element.dataset.pageNumber = String(i + 1);
      element.setAttribute("aria-label", `Page ${i + 1}`);
      this.#pagesEl.append(element);
      return { pageNumber: i + 1, element, width, height, generation: 0, renderTask: null, textLayer: null, rendered: null };
    });
    this.#applyScale();
    scroller.replaceChildren(this.#pagesEl);

    // Render pages within one viewport height above/below the visible area.
    this.#observer = new IntersectionObserver((entries) => this.#onIntersect(entries), {
      root: scroller,
      rootMargin: "100% 0px",
    });
    this.#observeAll();
    scroller.addEventListener("scroll", this.#onScroll, { passive: true });
    this.#untrackSelection = trackSelectingLayers(this.#pagesEl);
  }

  get pageCount(): number {
    return this.#slots.length;
  }

  get scale(): number {
    return this.#scale;
  }

  /** The scroll container passed to `open` (holds all pages). */
  get scrollContainer(): HTMLElement {
    return this.#scroller;
  }

  /** 1-based page currently under the top part of the viewport. */
  get currentPage(): number {
    return this.#currentPage;
  }

  on<K extends keyof ViewerEvents>(event: K, listener: Listener<ViewerEvents[K]>): () => void {
    let set = this.#listeners.get(event);
    if (!set) this.#listeners.set(event, (set = new Set()));
    set.add(listener as Listener<never>);
    return () => set.delete(listener as Listener<never>);
  }

  /** Clamp a requested page number into `1..pageCount`. */
  clampPage(pageNumber: number): number {
    return Math.min(Math.max(Math.round(pageNumber), 1), this.pageCount);
  }

  /** The `.pdf-page` element of a page (always present, rendered or not). */
  pageElement(pageNumber: number): HTMLElement {
    return this.#slot(pageNumber).element;
  }

  /** The page's current rendering, if it is rendered right now. */
  renderedPage(pageNumber: number): RenderedPage | undefined {
    return this.#slot(pageNumber).rendered ?? undefined;
  }

  /**
   * Resolves with the page's rendering once it is rendered (immediately if it
   * already is). Pages render when near the viewport: scroll there first.
   */
  whenRendered(pageNumber: number): Promise<RenderedPage> {
    const slot = this.#slot(pageNumber);
    if (slot.rendered) return Promise.resolve(slot.rendered);
    return new Promise((resolve) => {
      const list = this.#waiters.get(pageNumber) ?? [];
      list.push(resolve);
      this.#waiters.set(pageNumber, list);
    });
  }

  /**
   * Scroll so that point `y` (CSS px from the page's top edge at the current
   * scale) is at the top of the viewport. Out-of-range pages are clamped.
   * Returns the page actually scrolled to.
   */
  scrollToPage(pageNumber: number, y = 0): number {
    const page = this.clampPage(pageNumber);
    const el = this.#slot(page).element;
    this.#scroller.scrollTop = el.offsetTop - this.#pagesEl.offsetTop - PAGE_GAP / 2 + y;
    this.#updateCurrentPage();
    return page;
  }

  /** Zoom, keeping the point at the top of the viewport in place. Clamped to MIN/MAX_SCALE. */
  setScale(scale: number): void {
    const next = clampScale(scale);
    if (next === this.#scale) return;
    const anchorPage = this.#pageAt(this.#scroller.scrollTop + this.#pagesEl.offsetTop);
    const anchorEl = this.#slot(anchorPage).element;
    const fraction = (this.#scroller.scrollTop - (anchorEl.offsetTop - this.#pagesEl.offsetTop)) / anchorEl.offsetHeight;

    this.#observer.disconnect();
    for (const slot of this.#slots) this.#release(slot);
    this.#scale = next;
    this.#applyScale();
    this.#scroller.scrollTop = anchorEl.offsetTop - this.#pagesEl.offsetTop + fraction * anchorEl.offsetHeight;
    this.#observeAll();
    this.#emit("scaleChange", next);
    this.#updateCurrentPage();
  }

  destroy(): void {
    this.#destroyed = true;
    this.#observer.disconnect();
    this.#scroller.removeEventListener("scroll", this.#onScroll);
    this.#untrackSelection();
    cancelAnimationFrame(this.#scrollFrame);
    for (const slot of this.#slots) this.#release(slot);
    this.#listeners.clear();
    this.#waiters.clear();
    this.#pagesEl.remove();
    void this.#pdf.loadingTask.destroy();
  }

  #slot(pageNumber: number): PageSlot {
    const slot = this.#slots[pageNumber - 1];
    if (!slot) throw new RangeError(`Page ${pageNumber} out of range 1..${this.pageCount}`);
    return slot;
  }

  #emit<K extends keyof ViewerEvents>(event: K, value: ViewerEvents[K]): void {
    for (const listener of this.#listeners.get(event) ?? []) (listener as Listener<ViewerEvents[K]>)(value);
  }

  #applyScale(): void {
    // PDF.js text layer CSS sizes and positions text from these variables.
    this.#pagesEl.style.setProperty("--scale-factor", String(this.#scale));
    this.#pagesEl.style.setProperty("--total-scale-factor", String(this.#scale));
    for (const slot of this.#slots) {
      slot.element.style.width = `${Math.floor(slot.width * this.#scale)}px`;
      slot.element.style.height = `${Math.floor(slot.height * this.#scale)}px`;
    }
  }

  #observeAll(): void {
    // observe() reports each element's current state, so re-observing after a
    // layout change renders exactly the pages now near the viewport.
    for (const slot of this.#slots) this.#observer.observe(slot.element);
  }

  #onIntersect(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      const slot = this.#slot(Number((entry.target as HTMLElement).dataset.pageNumber));
      if (entry.isIntersecting) {
        if (slot.generation % 2 === 0) void this.#render(slot);
      } else {
        this.#release(slot);
      }
    }
  }

  #onScroll = (): void => {
    cancelAnimationFrame(this.#scrollFrame);
    this.#scrollFrame = requestAnimationFrame(() => this.#updateCurrentPage());
  };

  #updateCurrentPage(): void {
    const { scrollTop, scrollHeight, clientHeight } = this.#scroller;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
    const page = atBottom
      ? this.pageCount
      : this.#pageAt(scrollTop + this.#pagesEl.offsetTop + clientHeight * CURRENT_PAGE_PROBE);
    if (page === this.#currentPage) return;
    this.#currentPage = page;
    this.#emit("pageChange", page);
  }

  /** Page whose box (including half the gap around it) contains scroll-content y. */
  #pageAt(y: number): number {
    let lo = 0;
    let hi = this.#slots.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.#slots[mid]!.element.offsetTop - PAGE_GAP / 2 <= y) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  }

  /**
   * Render canvas + text layer. `generation` is odd while a rendering is
   * active (in progress or done), even when released.
   */
  async #render(slot: PageSlot): Promise<void> {
    const generation = ++slot.generation;
    const stale = () => this.#destroyed || slot.generation !== generation;
    const scale = this.#scale;
    try {
      const page = await this.#pdf.getPage(slot.pageNumber);
      if (stale()) return;
      const viewport = page.getViewport({ scale });
      const ratio = window.devicePixelRatio || 1;

      const canvas = document.createElement("canvas");
      canvas.className = "pdf-canvas";
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const textLayerEl = document.createElement("div");
      textLayerEl.className = "textLayer";
      slot.element.replaceChildren(canvas, textLayerEl);

      const renderTask = page.render({
        canvas,
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });
      slot.renderTask = renderTask;
      const textContent = await page.getTextContent();
      if (stale()) return;
      const textLayer = new pdfjs.TextLayer({ textContentSource: textContent, container: textLayerEl, viewport });
      slot.textLayer = textLayer;
      await Promise.all([renderTask.promise, textLayer.render()]);
      if (stale()) return;
      slot.renderTask = null;
      slot.textLayer = null;
      addEndOfContent(textLayerEl);
      slot.rendered = buildRenderedPage(slot, textLayerEl, textContent.items as PdfTextItem[], textLayer, scale);
    } catch (error) {
      if (stale() || isCancellation(error)) return;
      console.error(`Failed to render page ${slot.pageNumber}`, error);
      slot.element.classList.add("pdf-page-error");
      this.#emit("pageError", slot.pageNumber);
      return;
    }
    const rendered = slot.rendered;
    this.#emit("pageRendered", rendered);
    const waiters = this.#waiters.get(slot.pageNumber);
    this.#waiters.delete(slot.pageNumber);
    for (const resolve of waiters ?? []) resolve(rendered);
  }

  #release(slot: PageSlot): void {
    if (slot.generation % 2 === 0) return;
    slot.generation++;
    slot.renderTask?.cancel();
    slot.textLayer?.cancel();
    slot.renderTask = null;
    slot.textLayer = null;
    const wasRendered = slot.rendered !== null;
    slot.rendered = null;
    // Shrink the canvas before dropping it so its backing store is freed promptly.
    for (const canvas of slot.element.querySelectorAll("canvas")) canvas.width = canvas.height = 0;
    slot.element.replaceChildren();
    slot.element.classList.remove("pdf-page-error");
    void this.#pdf.getPage(slot.pageNumber).then((p) => p.cleanup());
    if (wasRendered) this.#emit("pageReleased", slot.pageNumber);
  }
}

function buildRenderedPage(
  slot: PageSlot,
  textLayer: HTMLElement,
  items: PdfTextItem[],
  layer: pdfjs.TextLayer,
  scale: number,
): RenderedPage {
  const { text, itemStarts } = layoutPageText(items);
  const { textDivs, textContentItemsStr } = layer;
  // Contract: PDF.js creates exactly one text div per text item (marked
  // content skipped), in order. Selection mapping depends on it.
  if (textDivs.length !== itemStarts.length) {
    throw new Error(
      `Page ${slot.pageNumber}: text layer has ${textDivs.length} elements for ${itemStarts.length} text items`,
    );
  }
  return {
    pageNumber: slot.pageNumber,
    element: slot.element,
    textLayer,
    text,
    items: textDivs.map((element, i) => ({ element, str: textContentItemsStr[i]!, start: itemStarts[i]! })),
    scale,
  };
}

/**
 * As PDF.js's own viewer does: a block after the text that, while a selection
 * covers its text layer (`.selecting`, see `trackSelectingLayers`), covers the
 * page so the selection doesn't jump when the pointer is over blank space.
 */
function addEndOfContent(textLayer: HTMLElement): void {
  const end = document.createElement("div");
  end.className = "endOfContent";
  textLayer.append(end);
}

/**
 * Port of PDF.js TextLayerBuilder's global selection listener (modern
 * Chromium / Firefox path): a text layer is `.selecting` while the selection
 * intersects it, cleared on pointer up. Marking only on pointerdown instead
 * breaks drags that start in a page margin (no selection starts) or end on
 * another page's blank area (the selection jumps to the document start).
 * Returns a function that removes the listeners.
 */
function trackSelectingLayers(root: HTMLElement): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const layers = () => root.querySelectorAll<HTMLElement>(".textLayer");
  const resetAll = () => layers().forEach((layer) => layer.classList.remove("selecting"));
  let pointerDown = false;
  document.addEventListener("pointerdown", () => (pointerDown = true), { signal });
  document.addEventListener(
    "pointerup",
    () => {
      pointerDown = false;
      resetAll();
    },
    { signal },
  );
  window.addEventListener(
    "blur",
    () => {
      pointerDown = false;
      resetAll();
    },
    { signal },
  );
  document.addEventListener("keyup", () => !pointerDown && resetAll(), { signal });
  document.addEventListener(
    "selectionchange",
    () => {
      const selection = document.getSelection();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const active = range && (!range.collapsed || pointerDown) ? range : null;
      for (const layer of layers()) layer.classList.toggle("selecting", !!active?.intersectsNode(layer));
    },
    { signal },
  );
  return () => controller.abort();
}

function clampScale(scale: number): number {
  return Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE);
}

function isCancellation(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  return name === "RenderingCancelledException" || name === "AbortException";
}

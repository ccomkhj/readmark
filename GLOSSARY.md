# Book Reader

A personal reading tool: the reader marks passages in PDFs, attaches their own thoughts, and exports the result as source material an agent can summarize.

## Language

**Library**:
The app-owned collection of every imported Document.
_Avoid_: Shelf, Collection, Folder

**Document**:
A single imported PDF in the Library, identified by its content rather than its location; a different edition is a different Document.
_Avoid_: Book, File, PDF (as a domain term)

**Highlight**:
One contiguous span of one or more sentences in a Document, anchored to its exact position; may cross a page break.
_Avoid_: Annotation, Selection, Quote, Clip

**Note**:
The reader's own words attached to exactly one Highlight; a Highlight has at most one Note.
_Avoid_: Comment, Insight, Annotation

**Insight Export**:
The artifact generated from one Document's Highlights and Notes, in reading order, handed to an agent for summarizing. Not stored; produced on demand.
_Avoid_: Summary, Digest, Insight (alone)

export type DocumentKind =
  | "yearAtAGlance"
  | "syllabus"
  | "powerPoint"
  | "canvasShell";

export type Accent = {
  color: string;
  tint: string;
};

export type DocumentLink = {
  kind: DocumentKind;
  category: string;
  title: string;
  url: string;
};

export type Course = {
  name: string;
  documents: ReadonlyArray<DocumentLink>;
  accent: Accent;
};

export type FoundationResource = {
  name: string;
  document: DocumentLink;
  accent: Accent;
};

export type CurriculumCatalog = {
  title: string;
  program: string;
  preparedBy: string;
  foundationResources: ReadonlyArray<FoundationResource>;
  courses: ReadonlyArray<Course>;
  loadedAt: Date;
};

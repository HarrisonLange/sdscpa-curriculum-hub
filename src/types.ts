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
  grade: string;
  documents: ReadonlyArray<DocumentLink>;
};

export type OtherLink = {
  name: string;
  label: string;
  url: string;
};

export type FoundationResource = {
  name: string;
  document: DocumentLink;
};

export type CurriculumCatalog = {
  title: string;
  program: string;
  preparedBy: string;
  otherLinks: ReadonlyArray<OtherLink>;
  foundationResources: ReadonlyArray<FoundationResource>;
  courses: ReadonlyArray<Course>;
  loadedAt: Date;
};

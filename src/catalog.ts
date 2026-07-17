import { strFromU8, unzipSync } from "fflate";

import type {
  Course,
  CurriculumCatalog,
  DocumentKind,
  DocumentLink,
  FoundationResource,
  OtherLink,
} from "./types";

const SHARED_STRINGS_PATH = "xl/sharedStrings.xml";
const CURRICULUM_WORKSHEET_PATH = "xl/worksheets/sheet1.xml";
const CURRICULUM_RELATIONSHIPS_PATH = "xl/worksheets/_rels/sheet1.xml.rels";
const OTHER_LINKS_WORKSHEET_PATH = "xl/worksheets/sheet2.xml";
const OTHER_LINKS_RELATIONSHIPS_PATH = "xl/worksheets/_rels/sheet2.xml.rels";
const RELATIONSHIP_ID_ATTRIBUTE = "r:id";

const DOCUMENT_COLUMNS: ReadonlyArray<{
  column: string;
  kind: DocumentKind;
  defaultCategory: string;
}> = [
  { column: "C", kind: "yearAtAGlance", defaultCategory: "Year at a Glance" },
  { column: "D", kind: "syllabus", defaultCategory: "Syllabus" },
  { column: "E", kind: "powerPoint", defaultCategory: "PowerPoint" },
  { column: "F", kind: "canvasShell", defaultCategory: "Canvas Shell Template" },
];

export class WorkbookArchiveError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "WorkbookArchiveError";
  }
}

type WorkbookGrid = {
  values: ReadonlyMap<string, string>;
  links: ReadonlyMap<string, string>;
  maximumRow: number;
};

const getRequiredArchiveText = (
  archive: Readonly<Record<string, Uint8Array>>,
  path: string,
): string => {
  const entry: Uint8Array | undefined = archive[path];
  if (entry === undefined) {
    throw new WorkbookArchiveError(`The workbook is missing the required entry: ${path}`);
  }

  return strFromU8(entry);
};

const parseXml = (xml: string, sourceName: string): XMLDocument => {
  const documentNode: XMLDocument = new DOMParser().parseFromString(xml, "application/xml");
  const parserError: Element | null = documentNode.querySelector("parsererror");
  if (parserError !== null) {
    throw new WorkbookArchiveError(
      `The workbook entry ${sourceName} contains invalid XML: ${parserError.textContent ?? "Unknown XML error"}`,
    );
  }

  return documentNode;
};

const readSharedStrings = (documentNode: XMLDocument): ReadonlyArray<string> =>
  Array.from(documentNode.getElementsByTagName("si")).map((stringItem: Element) =>
    Array.from(stringItem.getElementsByTagName("t"))
      .map((textNode: Element) => textNode.textContent ?? "")
      .join(""),
  );

const readRelationshipTargets = (documentNode: XMLDocument): ReadonlyMap<string, string> => {
  const targets: Map<string, string> = new Map<string, string>();
  Array.from(documentNode.getElementsByTagName("Relationship")).forEach(
    (relationship: Element) => {
      const id: string | null = relationship.getAttribute("Id");
      const target: string | null = relationship.getAttribute("Target");
      if (id !== null && target !== null) {
        targets.set(id, target);
      }
    },
  );
  return targets;
};

const rowNumberFromReference = (reference: string): number => {
  const match: RegExpMatchArray | null = reference.match(/\d+$/);
  if (match === null) {
    throw new WorkbookArchiveError(`The workbook contains an invalid cell reference: ${reference}`);
  }

  return Number.parseInt(match[0], 10);
};

const readWorkbookGrid = (
  worksheet: XMLDocument,
  sharedStrings: ReadonlyArray<string>,
  relationshipTargets: ReadonlyMap<string, string>,
): WorkbookGrid => {
  const values: Map<string, string> = new Map<string, string>();
  let maximumRow: number = 0;

  Array.from(worksheet.getElementsByTagName("c")).forEach((cell: Element) => {
    const reference: string | null = cell.getAttribute("r");
    if (reference === null) {
      throw new WorkbookArchiveError("The workbook contains a cell without a reference.");
    }

    maximumRow = Math.max(maximumRow, rowNumberFromReference(reference));
    const rawValue: string = cell.getElementsByTagName("v")[0]?.textContent ?? "";
    const isSharedString: boolean = cell.getAttribute("t") === "s";
    const sharedStringIndex: number = Number.parseInt(rawValue, 10);
    const value: string = isSharedString
      ? (sharedStrings[sharedStringIndex] ?? "")
      : rawValue;
    values.set(reference, value.trim());
  });

  const links: Map<string, string> = new Map<string, string>();
  Array.from(worksheet.getElementsByTagName("hyperlink")).forEach((hyperlink: Element) => {
    const reference: string | null = hyperlink.getAttribute("ref");
    const relationshipId: string | null = hyperlink.getAttribute(RELATIONSHIP_ID_ATTRIBUTE);
    if (reference === null || relationshipId === null) {
      return;
    }

    const target: string | undefined = relationshipTargets.get(relationshipId);
    if (target === undefined) {
      throw new WorkbookArchiveError(
        `The workbook hyperlink in ${reference} points to missing relationship ${relationshipId}.`,
      );
    }
    links.set(reference, target);
  });

  return { values, links, maximumRow };
};

const cleanPreparedBy = (value: string): string => value.replace(/^Prepared by:\s*/i, "").trim();

const normalizeGrade = (value: string): string => {
  const normalized: string = value.trim();
  const numericGrade: number = Number(normalized);
  return normalized !== "" && Number.isFinite(numericGrade)
    ? String(numericGrade)
    : normalized;
};

const normalizeCategory = (value: string, fallback: string): string => {
  const normalized: string = value.trim().toLowerCase();
  if (normalized === "sylibus" || normalized === "syllabus") {
    return "Syllabus";
  }
  if (normalized === "powerpoint") {
    return "PowerPoint";
  }
  return value.trim() === "" ? fallback : value.trim();
};

const createDocumentLink = (
  grid: WorkbookGrid,
  reference: string,
  kind: DocumentKind,
  category: string,
): DocumentLink | null => {
  const title: string = grid.values.get(reference) ?? "";
  const url: string | undefined = grid.links.get(reference);
  if (title === "" || url === undefined) {
    return null;
  }

  return { kind, category, title, url };
};

const createFoundationResources = (grid: WorkbookGrid): ReadonlyArray<FoundationResource> =>
  [4, 5].flatMap((row: number) => {
    const name: string = grid.values.get(`A${row}`) ?? "";
    const documentLink: DocumentLink | null = createDocumentLink(
      grid,
      `C${row}`,
      "yearAtAGlance",
      "Program Resource",
    );
    if (name === "" || documentLink === null) {
      return [];
    }

    return [{ name, document: documentLink }];
  });

const createOtherLinks = (grid: WorkbookGrid): ReadonlyArray<OtherLink> => {
  const rowNumbers: ReadonlyArray<number> = Array.from(
    { length: grid.maximumRow },
    (_value: unknown, index: number) => index + 1,
  );

  return rowNumbers.flatMap((row: number) => {
    const name: string = grid.values.get(`A${row}`) ?? "";
    const label: string = grid.values.get(`B${row}`) ?? "";
    const url: string | undefined = grid.links.get(`B${row}`);
    return name === "" || label === "" || url === undefined
      ? []
      : [{ name, label, url }];
  });
};

const createCourses = (grid: WorkbookGrid): ReadonlyArray<Course> => {
  const categories: ReadonlyMap<string, string> = new Map<string, string>(
    DOCUMENT_COLUMNS.map(({ column, defaultCategory }) => [
      column,
      normalizeCategory(grid.values.get(`${column}6`) ?? "", defaultCategory),
    ]),
  );

  const rowNumbers: ReadonlyArray<number> = Array.from(
    { length: Math.max(0, grid.maximumRow - 6) },
    (_value: unknown, index: number) => index + 7,
  );

  return rowNumbers.flatMap((row: number) => {
    const name: string = grid.values.get(`A${row}`) ?? "";
    const grade: string = normalizeGrade(grid.values.get(`B${row}`) ?? "");
    if (name === "") {
      return [];
    }

    const documents: ReadonlyArray<DocumentLink> = DOCUMENT_COLUMNS.flatMap(
      ({ column, kind, defaultCategory }) => {
        const category: string = categories.get(column) ?? defaultCategory;
        const documentLink: DocumentLink | null = createDocumentLink(
          grid,
          `${column}${row}`,
          kind,
          category,
        );
        return documentLink === null ? [] : [documentLink];
      },
    );

    return [{ name, grade, documents }];
  });
};

export const parseCurriculumWorkbook = (workbookBytes: Uint8Array): CurriculumCatalog => {
  const archive: Record<string, Uint8Array> = unzipSync(workbookBytes);
  const sharedStrings: ReadonlyArray<string> = readSharedStrings(
    parseXml(getRequiredArchiveText(archive, SHARED_STRINGS_PATH), SHARED_STRINGS_PATH),
  );
  const curriculumRelationshipTargets: ReadonlyMap<string, string> = readRelationshipTargets(
    parseXml(
      getRequiredArchiveText(archive, CURRICULUM_RELATIONSHIPS_PATH),
      CURRICULUM_RELATIONSHIPS_PATH,
    ),
  );
  const curriculumGrid: WorkbookGrid = readWorkbookGrid(
    parseXml(
      getRequiredArchiveText(archive, CURRICULUM_WORKSHEET_PATH),
      CURRICULUM_WORKSHEET_PATH,
    ),
    sharedStrings,
    curriculumRelationshipTargets,
  );
  const otherLinksRelationshipTargets: ReadonlyMap<string, string> = readRelationshipTargets(
    parseXml(
      getRequiredArchiveText(archive, OTHER_LINKS_RELATIONSHIPS_PATH),
      OTHER_LINKS_RELATIONSHIPS_PATH,
    ),
  );
  const otherLinksGrid: WorkbookGrid = readWorkbookGrid(
    parseXml(
      getRequiredArchiveText(archive, OTHER_LINKS_WORKSHEET_PATH),
      OTHER_LINKS_WORKSHEET_PATH,
    ),
    sharedStrings,
    otherLinksRelationshipTargets,
  );

  return {
    title: curriculumGrid.values.get("A1") ?? "Design and Production Curriculum Hub",
    program: curriculumGrid.values.get("A2") ?? "SDSCPA",
    preparedBy: cleanPreparedBy(curriculumGrid.values.get("A3") ?? ""),
    otherLinks: createOtherLinks(otherLinksGrid),
    foundationResources: createFoundationResources(curriculumGrid),
    courses: createCourses(curriculumGrid),
    loadedAt: new Date(),
  };
};

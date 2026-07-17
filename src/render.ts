import type {
  Accent,
  Course,
  CurriculumCatalog,
  DocumentLink,
  FoundationResource,
} from "./types";

const createElement = <K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
  text: string,
): HTMLElementTagNameMap[K] => {
  const element: HTMLElementTagNameMap[K] = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
};

const applyAccent = (element: HTMLElement, accent: Accent): HTMLElement => {
  element.style.setProperty("--section-accent", accent.color);
  element.style.setProperty("--section-tint", accent.tint);
  return element;
};

const createWordmark = (): SVGSVGElement => {
  const namespace: string = "http://www.w3.org/2000/svg";
  const svg: SVGSVGElement = document.createElementNS(namespace, "svg") as SVGSVGElement;
  svg.classList.add("wordmark");
  svg.setAttribute("viewBox", "0 0 420 88");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "SDSCPA");

  const definitions: SVGDefsElement = document.createElementNS(namespace, "defs") as SVGDefsElement;
  const gradient: SVGLinearGradientElement = document.createElementNS(
    namespace,
    "linearGradient",
  ) as SVGLinearGradientElement;
  gradient.id = "wordmark-gradient";
  gradient.setAttribute("x1", "0");
  gradient.setAttribute("x2", "1");
  const colors: ReadonlyArray<string> = [
    "#7AC143",
    "#F7941E",
    "#ED1C45",
    "#EC008C",
    "#92278F",
    "#2E3192",
    "#00AEEF",
  ];
  colors.forEach((color: string, index: number) => {
    const stop: SVGStopElement = document.createElementNS(namespace, "stop") as SVGStopElement;
    stop.setAttribute("offset", `${(index / (colors.length - 1)) * 100}%`);
    stop.setAttribute("stop-color", color);
    gradient.append(stop);
  });
  definitions.append(gradient);

  const text: SVGTextElement = document.createElementNS(namespace, "text") as SVGTextElement;
  text.setAttribute("x", "210");
  text.setAttribute("y", "68");
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("fill", "url(#wordmark-gradient)");
  text.textContent = "SDSCPA";
  svg.append(definitions, text);
  return svg;
};

const createHeader = (catalog: CurriculumCatalog): HTMLElement => {
  const header: HTMLElement = createElement("header", "site-header", "");
  const headerInner: HTMLDivElement = createElement("div", "header-inner", "");
  const tagline: HTMLParagraphElement = createElement(
    "p",
    "tagline",
    "Design & Production · Curriculum Documentation",
  );
  const title: HTMLHeadingElement = createElement("h1", "site-title", catalog.title);
  const description: HTMLParagraphElement = createElement(
    "p",
    "site-description",
    "Find current course plans, syllabi, program standards, and Canvas shell templates in one place.",
  );
  headerInner.append(createWordmark(), tagline, title, description);
  header.append(headerInner, createElement("div", "rainbow-rule", ""));
  return header;
};

const createExternalLink = (documentLink: DocumentLink, className: string): HTMLAnchorElement => {
  const link: HTMLAnchorElement = createElement("a", className, "");
  link.href = documentLink.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `${documentLink.category}: ${documentLink.title} (opens in a new tab)`);

  const content: HTMLSpanElement = createElement("span", "document-copy", "");
  content.append(
    createElement("span", "document-category", documentLink.category),
    createElement("span", "document-title", documentLink.title),
  );
  link.append(content, createElement("span", "external-arrow", "↗"));
  return link;
};

const createFoundationCard = (resource: FoundationResource): HTMLElement => {
  const card: HTMLElement = applyAccent(createElement("article", "foundation-card panel", ""), resource.accent);
  card.append(
    createElement("p", "eyebrow", "Program foundation"),
    createElement("h3", "foundation-name", resource.name),
    createExternalLink(resource.document, "resource-link"),
  );
  return card;
};

const createFoundationSection = (
  resources: ReadonlyArray<FoundationResource>,
): HTMLElement => {
  const section: HTMLElement = createElement("section", "section-block", "");
  section.setAttribute("aria-labelledby", "foundation-heading");
  const heading: HTMLHeadingElement = createElement(
    "h2",
    "section-heading",
    "Program foundations",
  );
  heading.id = "foundation-heading";
  const intro: HTMLParagraphElement = createElement(
    "p",
    "section-intro",
    "Shared standards and skill progressions for the full Design & Production pathway.",
  );
  const grid: HTMLDivElement = createElement("div", "foundation-grid", "");
  resources.forEach((resource: FoundationResource) => grid.append(createFoundationCard(resource)));
  section.append(heading, intro, grid);
  return section;
};

const createCourseCard = (course: Course): HTMLElement => {
  const card: HTMLElement = applyAccent(createElement("article", "course-card panel", ""), course.accent);
  const header: HTMLDivElement = createElement("div", "course-header", "");
  header.append(
    createElement("p", "eyebrow", "Course documentation"),
    createElement("span", "document-count", `${course.documents.length} ${course.documents.length === 1 ? "file" : "files"}`),
  );
  card.append(header, createElement("h3", "course-name", course.name));

  if (course.documents.length === 0) {
    card.append(
      createElement(
        "p",
        "empty-state",
        "No linked documentation is listed in the curriculum sheet yet.",
      ),
    );
    return card;
  }

  const documents: HTMLDivElement = createElement("div", "document-list", "");
  course.documents.forEach((documentLink: DocumentLink) =>
    documents.append(createExternalLink(documentLink, "document-link")),
  );
  card.append(documents);
  return card;
};

const matchesQuery = (course: Course, query: string): boolean => {
  const searchableText: string = [
    course.name,
    ...course.documents.flatMap((documentLink: DocumentLink) => [
      documentLink.category,
      documentLink.title,
    ]),
  ]
    .join(" ")
    .toLowerCase();
  return searchableText.includes(query.trim().toLowerCase());
};

const createCourseGrid = (
  courses: ReadonlyArray<Course>,
  query: string,
): HTMLDivElement => {
  const matchingCourses: ReadonlyArray<Course> = courses.filter((course: Course) =>
    matchesQuery(course, query),
  );
  const wrapper: HTMLDivElement = createElement("div", "course-results", "");
  wrapper.setAttribute("aria-live", "polite");
  wrapper.append(
    createElement(
      "p",
      "results-count",
      `${matchingCourses.length} ${matchingCourses.length === 1 ? "course" : "courses"}`,
    ),
  );

  if (matchingCourses.length === 0) {
    wrapper.append(
      createElement(
        "div",
        "no-results panel",
        "No course or document matches that search. Try a course name, grade, or file type.",
      ),
    );
    return wrapper;
  }

  const grid: HTMLDivElement = createElement("div", "course-grid", "");
  matchingCourses.forEach((course: Course) => grid.append(createCourseCard(course)));
  wrapper.append(grid);
  return wrapper;
};

const createCoursesSection = (courses: ReadonlyArray<Course>): HTMLElement => {
  const section: HTMLElement = createElement("section", "section-block courses-section", "");
  section.setAttribute("aria-labelledby", "courses-heading");
  const headingRow: HTMLDivElement = createElement("div", "section-heading-row", "");
  const headingCopy: HTMLDivElement = createElement("div", "", "");
  const heading: HTMLHeadingElement = createElement("h2", "section-heading", "Course library");
  heading.id = "courses-heading";
  headingCopy.append(
    heading,
    createElement(
      "p",
      "section-intro",
      "Open a document directly from its course. Empty courses remain visible so gaps are easy to identify.",
    ),
  );

  const searchGroup: HTMLDivElement = createElement("div", "search-group", "");
  const searchLabel: HTMLLabelElement = createElement("label", "search-label", "Search curriculum");
  searchLabel.htmlFor = "course-search";
  const searchInput: HTMLInputElement = createElement("input", "search-input", "");
  searchInput.id = "course-search";
  searchInput.type = "search";
  searchInput.placeholder = "Course, grade, or document…";
  searchInput.autocomplete = "off";
  searchGroup.append(searchLabel, searchInput);
  headingRow.append(headingCopy, searchGroup);

  let currentResults: HTMLDivElement = createCourseGrid(courses, "");
  searchInput.addEventListener("input", () => {
    const nextResults: HTMLDivElement = createCourseGrid(courses, searchInput.value);
    currentResults.replaceWith(nextResults);
    currentResults = nextResults;
  });

  section.append(headingRow, currentResults);
  return section;
};

const createFooter = (catalog: CurriculumCatalog): HTMLElement => {
  const footer: HTMLElement = createElement("footer", "site-footer", "");
  const updateText: string = catalog.loadedAt.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  footer.append(
    createElement("div", "footer-rainbow", ""),
    createElement(
      "p",
      "footer-text",
      `${catalog.program} Design & Production · Curriculum Hub · Live sheet loaded ${updateText}`,
    ),
  );
  if (catalog.preparedBy !== "") {
    footer.append(createElement("p", "footer-credit", `Curriculum prepared by ${catalog.preparedBy}`));
  }
  return footer;
};

export const createApplication = (catalog: CurriculumCatalog): HTMLDivElement => {
  const application: HTMLDivElement = createElement("div", "application", "");
  const main: HTMLElement = createElement("main", "main-content", "");
  main.id = "main-content";
  main.append(
    createFoundationSection(catalog.foundationResources),
    createCoursesSection(catalog.courses),
  );
  application.append(createHeader(catalog), main, createFooter(catalog));
  return application;
};

export const createErrorApplication = (message: string, retry: () => void): HTMLDivElement => {
  const application: HTMLDivElement = createElement("div", "application error-application", "");
  const panel: HTMLElement = createElement("main", "error-panel panel", "");
  panel.id = "main-content";
  const button: HTMLButtonElement = createElement("button", "retry-button", "Try again");
  button.type = "button";
  button.addEventListener("click", retry);
  panel.append(
    createWordmark(),
    createElement("p", "eyebrow", "Curriculum unavailable"),
    createElement("h1", "error-title", "The live spreadsheet could not be loaded."),
    createElement("p", "error-message", message),
    button,
  );
  application.append(panel);
  return application;
};

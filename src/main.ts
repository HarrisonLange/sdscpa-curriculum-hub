import "./styles.css";

import { parseCurriculumWorkbook } from "./catalog";
import { createApplication, createErrorApplication } from "./render";
import type { CurriculumCatalog } from "./types";

const SPREADSHEET_ID = "1GkTZTVBmmoBglmyb2jagxLFYwml5J8rg6ROa8O5X6B0";
const WORKBOOK_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx`;
const FETCH_ATTEMPTS = 3;
const RETRY_DELAY_MILLISECONDS = 700;

export class SpreadsheetRequestError extends Error {
  public readonly status: number;
  public readonly url: string;

  public constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "SpreadsheetRequestError";
    this.status = status;
    this.url = url;
  }
}

const sleep = (milliseconds: number): Promise<void> =>
  new Promise<void>((resolve: () => void) => window.setTimeout(resolve, milliseconds));

const fetchWorkbook = async (url: string): Promise<Uint8Array> => {
  const response: Response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const responseText: string = await response.text();
    throw new SpreadsheetRequestError(
      `Google Sheets returned ${response.status} ${response.statusText}. Response: ${responseText.slice(0, 240)}`,
      response.status,
      url,
    );
  }

  return new Uint8Array(await response.arrayBuffer());
};

const fetchWorkbookWithRetries = async (
  url: string,
  attempts: number,
  retryDelayMilliseconds: number,
): Promise<Uint8Array> => {
  let lastError: unknown = new SpreadsheetRequestError(
    "The curriculum spreadsheet request did not start.",
    0,
    url,
  );

  for (let attempt: number = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchWorkbook(url);
    } catch (error: unknown) {
      lastError = error;
      console.warn("Curriculum spreadsheet request failed", {
        attempt,
        attempts,
        url,
        error,
      });
      if (attempt < attempts) {
        await sleep(retryDelayMilliseconds);
      }
    }
  }

  throw lastError;
};

const getAppRoot = (): HTMLDivElement => {
  const root: HTMLDivElement | null = document.querySelector<HTMLDivElement>("#app");
  if (root === null) {
    throw new Error("The page is missing the required #app root element.");
  }
  return root;
};

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return `Unexpected error: ${String(error)}`;
};

const startApplication = async (): Promise<void> => {
  const root: HTMLDivElement = getAppRoot();
  try {
    const workbookBytes: Uint8Array = await fetchWorkbookWithRetries(
      WORKBOOK_URL,
      FETCH_ATTEMPTS,
      RETRY_DELAY_MILLISECONDS,
    );
    const catalog: CurriculumCatalog = parseCurriculumWorkbook(workbookBytes);
    root.replaceChildren(createApplication(catalog));
  } catch (error: unknown) {
    const message: string = formatError(error);
    console.error("Curriculum hub startup failed", { url: WORKBOOK_URL, error });
    root.replaceChildren(
      createErrorApplication(message, () => {
        window.location.reload();
      }),
    );
  }
};

void startApplication();

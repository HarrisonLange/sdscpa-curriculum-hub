import type { Accent } from "./types";

export const BRAND_ACCENTS: ReadonlyArray<Accent> = [
  { color: "#7AC143", tint: "rgba(122, 193, 67, .16)" },
  { color: "#F7941E", tint: "rgba(247, 148, 30, .16)" },
  { color: "#ED1C45", tint: "rgba(237, 28, 69, .16)" },
  { color: "#EC008C", tint: "rgba(236, 0, 140, .16)" },
  { color: "#92278F", tint: "rgba(146, 39, 143, .16)" },
  { color: "#2E3192", tint: "rgba(46, 49, 146, .22)" },
  { color: "#00AEEF", tint: "rgba(0, 174, 239, .16)" },
];

export const getAccent = (index: number): Accent => {
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(`Accent index must be a non-negative integer. Received: ${index}`);
  }

  const accent: Accent | undefined = BRAND_ACCENTS[index % BRAND_ACCENTS.length];
  if (accent === undefined) {
    throw new Error("The curriculum accent palette is empty.");
  }
  return accent;
};

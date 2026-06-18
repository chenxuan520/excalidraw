export type AlignmentGuideEdge = "top" | "left" | "right";

export const ALIGNMENT_REFERENCE_GAP = 280;

export type AlignmentGuide = {
  edge: AlignmentGuideEdge;
  position: number;
  start: number;
  end: number;
  referenceStart: number;
  referenceEnd: number;
};

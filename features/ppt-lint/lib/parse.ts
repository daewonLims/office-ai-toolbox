/**
 * .pptx → PresentationModel 파서 (클라이언트/노드 공용).
 *
 * 서식 메타데이터만 추출한다. <a:t> 본문 텍스트는 절대 읽지 않는다.
 */
import { openPptx } from "./safe-zip";
import { parseXml, findAll, findFirst, attr, type XmlNode } from "./xml";
import type {
  PresentationModel,
  ShapeInfo,
  SlideModel,
  RunStyle,
  ThemeModel,
} from "./types";

const TITLE_TYPES = new Set(["title", "ctrTitle"]);

function toInt(v: string | null): number | null {
  if (v == null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/** 하나의 도형(p:sp) 노드에서 서식 정보를 추출 */
function extractShape(sp: XmlNode): ShapeInfo {
  // placeholder 역할
  const ph = findFirst(sp, "ph");
  let placeholderType: string | null = null;
  if (ph) {
    placeholderType = attr(ph, "type") ?? "body"; // type 없는 ph는 본문 취급
  }
  const isTitle = placeholderType !== null && TITLE_TYPES.has(placeholderType);

  // 위치/크기 (spPr > xfrm > off/ext). 도형 내 첫 off/ext만 사용.
  const off = findFirst(sp, "off");
  const ext = findFirst(sp, "ext");
  const offset =
    off && attr(off, "x") !== null && attr(off, "y") !== null
      ? { x: toInt(attr(off, "x")) ?? 0, y: toInt(attr(off, "y")) ?? 0 }
      : null;
  const extent =
    ext && attr(ext, "cx") !== null && attr(ext, "cy") !== null
      ? { cx: toInt(attr(ext, "cx")) ?? 0, cy: toInt(attr(ext, "cy")) ?? 0 }
      : null;

  // 런 서식 (a:r > a:rPr). 본문 <a:t>는 읽지 않는다.
  const runs: RunStyle[] = [];
  for (const r of findAll(sp, "r")) {
    const rPr = findFirst(r, "rPr");
    const latin = rPr ? findFirst(rPr, "latin") : null;
    const srgb = rPr ? findFirst(rPr, "srgbClr") : null;
    runs.push({
      font: latin ? attr(latin, "typeface") : null,
      sizeHundredths: rPr ? toInt(attr(rPr, "sz")) : null,
      colorHex: srgb ? normalizeHex(attr(srgb, "val")) : null,
    });
  }

  return { placeholderType, isTitle, offset, extent, runs };
}

function normalizeHex(v: string | null): string | null {
  if (!v) return null;
  const hex = v.trim().toUpperCase();
  return /^[0-9A-F]{6}$/.test(hex) ? hex : null;
}

function parseSlide(xml: string, slideNumber: number): SlideModel {
  const root = parseXml(xml);
  const shapes = findAll(root, "sp").map(extractShape);
  const hasFooter = shapes.some((s) => s.placeholderType === "ftr");
  const hasSlideNumber = shapes.some((s) => s.placeholderType === "sldNum");
  return { slideNumber, shapes, hasFooter, hasSlideNumber };
}

function parseTheme(xml: string): ThemeModel {
  const root = parseXml(xml);
  const major = findFirst(root, "majorFont");
  const minor = findFirst(root, "minorFont");
  const majorLatin = major ? findFirst(major, "latin") : null;
  const minorLatin = minor ? findFirst(minor, "latin") : null;
  const clrScheme = findFirst(root, "clrScheme");
  const schemeColors: string[] = [];
  if (clrScheme) {
    for (const srgb of findAll(clrScheme, "srgbClr")) {
      const hex = normalizeHex(attr(srgb, "val"));
      if (hex) schemeColors.push(hex);
    }
  }
  return {
    majorFont: majorLatin ? attr(majorLatin, "typeface") : null,
    minorFont: minorLatin ? attr(minorLatin, "typeface") : null,
    schemeColors,
  };
}

/** presentation.xml + rels로 슬라이드 표시 순서를 결정 (실패 시 파일명 숫자순 폴백) */
function orderSlidePaths(parts: Map<string, string>): string[] {
  const slidePaths = [...parts.keys()].filter((p) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(p)
  );
  const numericSort = (a: string, b: string) => slideNo(a) - slideNo(b);

  const presXml = parts.get("ppt/presentation.xml");
  const relsXml = parts.get("ppt/_rels/presentation.xml.rels");
  if (!presXml || !relsXml) return slidePaths.sort(numericSort);

  try {
    // rId → target 매핑
    const relsRoot = parseXml(relsXml);
    const relMap = new Map<string, string>();
    for (const rel of findAll(relsRoot, "Relationship")) {
      const id = attr(rel, "Id");
      const target = attr(rel, "Target");
      if (id && target) relMap.set(id, normalizeTarget(target));
    }
    // sldIdLst의 r:id 순서
    const presRoot = parseXml(presXml);
    const lst = findFirst(presRoot, "sldIdLst");
    const ordered: string[] = [];
    if (lst) {
      for (const sldId of findAll(lst, "sldId")) {
        const rid = attr(sldId, "id"); // r:id → local-name "id" (rId..) 우선
        // r:id 속성은 local-name도 "id"라 sldId의 자체 id와 충돌할 수 있어 둘 다 확인
        const ridCandidate = ridOf(sldId) ?? rid;
        if (ridCandidate && relMap.has(ridCandidate)) {
          const path = relMap.get(ridCandidate)!;
          if (parts.has(path)) ordered.push(path);
        }
      }
    }
    // 순서에서 빠진 슬라이드는 뒤에 파일명 순으로 덧붙임
    const seen = new Set(ordered);
    for (const p of slidePaths.sort(numericSort)) {
      if (!seen.has(p)) ordered.push(p);
    }
    return ordered.length > 0 ? ordered : slidePaths.sort(numericSort);
  } catch {
    return slidePaths.sort(numericSort);
  }
}

/** sldId 노드에서 r:id 속성만 정확히 뽑기 (@_r:id) */
function ridOf(node: XmlNode): string | null {
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith("@_") && k.endsWith(":id")) return v == null ? null : String(v);
  }
  return null;
}

function normalizeTarget(target: string): string {
  // rels의 Target은 ppt/ 기준 상대경로 (예: "slides/slide1.xml")
  let t = target.replace(/^\.\//, "");
  if (t.startsWith("/")) t = t.slice(1);
  if (t.startsWith("ppt/")) return t;
  return `ppt/${t}`;
}

function slideNo(path: string): number {
  const m = path.match(/slide(\d+)\.xml$/);
  return m ? Number.parseInt(m[1], 10) : 0;
}

/** 화이트리스트 파트 Map에서 PresentationModel을 조립 (순수 — 파싱 코어) */
export function buildModel(parts: Map<string, string>): PresentationModel {
  const slidePaths = orderSlidePaths(parts);
  const slides: SlideModel[] = slidePaths.map((path, i) =>
    parseSlide(parts.get(path)!, i + 1)
  );

  let theme: ThemeModel | null = null;
  const themePath = [...parts.keys()]
    .filter((p) => /^ppt\/theme\/theme\d+\.xml$/.test(p))
    .sort()[0];
  if (themePath) theme = parseTheme(parts.get(themePath)!);

  return { slides, theme };
}

/** 브라우저 진입점: ArrayBuffer(.pptx) → PresentationModel (보안 검증 포함) */
export async function parsePptx(buffer: ArrayBuffer): Promise<PresentationModel> {
  const { parts } = await openPptx(buffer);
  const model = buildModel(parts);
  if (model.slides.length === 0) {
    throw new Error("슬라이드를 찾을 수 없습니다. 빈 프레젠테이션일 수 있습니다.");
  }
  return model;
}

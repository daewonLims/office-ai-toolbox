/**
 * .docx → 문단 텍스트 추출 (전부 브라우저에서 수행).
 *
 * .docx도 zip 컨테이너이므로 공유 코어(@/lib/safe-zip)의 방어를 그대로 적용한다:
 * 매직 바이트 검증·zip bomb 상한·경로 화이트리스트. word/document.xml만 화이트리스트로
 * 풀고, w:p(문단) → w:t(텍스트)를 문단 배열로 추출한다.
 *
 * XML 파싱은 XXE/엔티티 폭탄을 차단한다:
 *  - processEntities:false 로 엔티티 확장 자체를 끄고(billion-laughs 류 방어),
 *  - assertNoDoctype()로 DOCTYPE/ENTITY 선언이 있는 XML은 파싱 전에 거부한다.
 * (OOXML 파트에는 DOCTYPE가 없으므로 정상 파일에는 영향이 없다.)
 *
 * 서식·속성은 읽지 않고 텍스트만 추출한다.
 */
import { XMLParser } from "fast-xml-parser";
import { openZip, SafeZipError } from "@/lib/safe-zip";

export { SafeZipError };

/** 텍스트 추출에 필요한 파트만 화이트리스트로 추출 */
const WHITELIST: RegExp[] = [/^word\/document\.xml$/];

const parser = new XMLParser({
  // 텍스트만 필요 — 속성은 읽지 않는다
  ignoreAttributes: true,
  // 엔티티 확장 비활성 — XXE / 엔티티 폭탄 방어
  processEntities: false,
  htmlEntities: false,
  // 값 자동 변환 없음(숫자/공백 원문 보존)
  parseTagValue: false,
  trimValues: false,
  removeNSPrefix: false,
});

/** OOXML에는 DOCTYPE가 없음 — 있으면 악의적 XML로 보고 거부 */
function assertNoDoctype(xml: string): void {
  const head = xml.slice(0, 4096);
  if (/<!DOCTYPE/i.test(head) || /<!ENTITY/i.test(xml)) {
    throw new SafeZipError("허용되지 않는 XML 구조입니다 (DOCTYPE/ENTITY).");
  }
}

function localName(key: string): string {
  const i = key.indexOf(":");
  return i >= 0 ? key.slice(i + 1) : key;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toArray(v: unknown): unknown[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** 한 문단(w:p) 하위의 모든 w:t 텍스트를 문서 순서대로 이어붙인다. */
function collectText(node: unknown): string {
  let out = "";
  const visit = (n: unknown) => {
    if (Array.isArray(n)) {
      n.forEach(visit);
      return;
    }
    if (!isObj(n)) return;
    for (const [k, v] of Object.entries(n)) {
      const name = localName(k);
      if (name === "t") {
        for (const t of toArray(v)) {
          if (typeof t === "string") out += t;
          else if (typeof t === "number") out += String(t);
        }
      } else if (name === "tab") {
        out += "\t";
      } else if (name === "br" || name === "cr") {
        out += "\n";
      } else {
        for (const item of toArray(v)) visit(item);
      }
    }
  };
  visit(node);
  return out;
}

/** 트리에서 모든 w:p 문단을 순서대로 수집(w:p는 중첩되지 않으므로 중복 없음). */
function collectParagraphs(root: unknown): string[] {
  const paras: string[] = [];
  const visit = (n: unknown) => {
    if (Array.isArray(n)) {
      n.forEach(visit);
      return;
    }
    if (!isObj(n)) return;
    for (const [k, v] of Object.entries(n)) {
      if (localName(k) === "p") {
        for (const p of toArray(v)) paras.push(collectText(p));
      } else {
        for (const item of toArray(v)) visit(item);
      }
    }
  };
  visit(root);
  return paras;
}

/**
 * ArrayBuffer(.docx) → 문단 문자열 배열 (보안 검증 포함).
 * 빈 문단은 제거한다. 위반 시 SafeZipError(한국어 메시지)를 던진다.
 */
export async function extractDocxParagraphs(
  buffer: ArrayBuffer
): Promise<string[]> {
  const { parts } = await openZip(buffer, {
    whitelist: WHITELIST,
    formatLabel: ".docx",
  });

  const xml = parts.get("word/document.xml");
  if (!xml) {
    throw new SafeZipError(
      "문서 구조를 찾을 수 없습니다. 올바른 .docx 파일인지 확인하세요."
    );
  }

  assertNoDoctype(xml);
  const root = parser.parse(xml) as Record<string, unknown>;

  return collectParagraphs(root)
    .map((p) => p.replace(/\r/g, "").replace(/ /g, " ").trimEnd())
    .filter((p) => p.trim().length > 0);
}

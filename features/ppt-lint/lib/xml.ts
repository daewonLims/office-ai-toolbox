/**
 * 안전한 XML 파싱 + 탐색 헬퍼.
 *
 * 왜 fast-xml-parser인가:
 *  - 브라우저 DOMParser는 XXE에 안전하지만 node에는 없어서 검사 코어를 node에서
 *    단위 테스트할 수 없다. fast-xml-parser는 브라우저/노드 공용이며,
 *    외부 엔티티를 절대 네트워크로 해석(fetch)하지 않는다.
 *  - `processEntities: false`로 엔티티 확장 자체를 끄고(billion-laughs 류 방어),
 *    아래 assertNoDoctype()로 DOCTYPE/ENTITY 선언이 있는 XML은 파싱 전에 거부한다.
 *    OOXML 파트에는 DOCTYPE가 존재하지 않으므로 정상 파일에는 영향이 없다.
 *  - eval/Function 미사용.
 */
import { XMLParser } from "fast-xml-parser";

export type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // 엔티티 확장 비활성 — XXE / 엔티티 폭탄 방어
  processEntities: false,
  htmlEntities: false,
  // 속성값을 숫자로 자동 변환하지 않음 (형식 문자열 보존; 우리가 직접 parseInt)
  parseAttributeValue: false,
  parseTagValue: false,
  allowBooleanAttributes: true,
  // 네임스페이스 접두사는 보존하고, 탐색은 local-name 기준으로 매칭한다.
  removeNSPrefix: false,
});

/** OOXML에는 DOCTYPE가 없음 — 있으면 악의적 XML로 보고 거부 */
export function assertNoDoctype(xml: string): void {
  // 선행 공백/BOM을 건너뛰고 앞부분만 검사
  const head = xml.slice(0, 4096);
  if (/<!DOCTYPE/i.test(head) || /<!ENTITY/i.test(xml)) {
    throw new Error("허용되지 않는 XML 구조입니다 (DOCTYPE/ENTITY).");
  }
}

export function parseXml(xml: string): XmlNode {
  assertNoDoctype(xml);
  return parser.parse(xml) as XmlNode;
}

// ---- 탐색 헬퍼 (네임스페이스 접두사 무시, local-name 기준) -------------------

function localName(key: string): string {
  const i = key.indexOf(":");
  return i >= 0 ? key.slice(i + 1) : key;
}

function toArray(v: unknown): unknown[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function isNode(v: unknown): v is XmlNode {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 노드의 속성값 (local-name 기준). 예: attr(node, "type") → node["@_type"] */
export function attr(node: unknown, name: string): string | null {
  if (!isNode(node)) return null;
  for (const [k, v] of Object.entries(node)) {
    if (!k.startsWith("@_")) continue;
    if (localName(k.slice(2)) === name) {
      return v == null ? null : String(v);
    }
  }
  return null;
}

/**
 * node(및 그 하위 전체)에서 local-name이 name인 모든 노드를 수집.
 * 배열/객체 혼재를 정규화하여 재귀 탐색한다.
 */
export function findAll(node: unknown, name: string): XmlNode[] {
  const acc: XmlNode[] = [];
  const visit = (n: unknown) => {
    if (Array.isArray(n)) {
      for (const item of n) visit(item);
      return;
    }
    if (!isNode(n)) return;
    for (const [k, v] of Object.entries(n)) {
      if (k.startsWith("@_") || k === "#text") continue;
      if (localName(k) === name) {
        for (const item of toArray(v)) {
          if (isNode(item)) acc.push(item);
        }
      }
      for (const item of toArray(v)) visit(item);
    }
  };
  visit(node);
  return acc;
}

/** node(및 하위)에서 local-name이 name인 첫 노드 (없으면 null) */
export function findFirst(node: unknown, name: string): XmlNode | null {
  return findAll(node, name)[0] ?? null;
}

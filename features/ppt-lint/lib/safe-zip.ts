/**
 * 악성 .pptx(zip) 방어 — 공유 코어(@/lib/safe-zip) 위의 얇은 래퍼.
 *
 * 매직 바이트·zip bomb·경로 순회·XXE 관련 상한 검사는 공유 코어가 담당하고,
 * 이 모듈은 PPTX 전용 화이트리스트와 구조 검증(presentation.xml 존재)만 얹는다.
 * SafeZipError·SafeZipResult는 기존 import 경로 호환을 위해 재노출한다.
 */
import { openZip, SafeZipError } from "@/lib/safe-zip";

export { SafeZipError };
export type { SafeZipResult } from "@/lib/safe-zip";

/** 검사에 필요한 파트만 화이트리스트로 추출 (나머지는 무시하되 크기 검사는 수행) */
const WHITELIST: RegExp[] = [
  /^\[Content_Types\]\.xml$/,
  /^_rels\/\.rels$/,
  /^ppt\/presentation\.xml$/,
  /^ppt\/_rels\/presentation\.xml\.rels$/,
  /^ppt\/slides\/slide\d+\.xml$/,
  /^ppt\/theme\/theme\d+\.xml$/,
  /^docProps\/(core|app)\.xml$/,
];

/**
 * ArrayBuffer(.pptx)를 안전하게 열어 화이트리스트 텍스트 파트를 반환.
 * 위반 시 SafeZipError(한국어 메시지)를 던진다.
 */
export async function openPptx(
  buffer: ArrayBuffer
): Promise<{ parts: Map<string, string> }> {
  const result = await openZip(buffer, {
    whitelist: WHITELIST,
    formatLabel: ".pptx",
  });

  if (!result.parts.has("ppt/presentation.xml")) {
    throw new SafeZipError(
      "PPT 구조를 찾을 수 없습니다. 올바른 .pptx 파일인지 확인하세요."
    );
  }

  return result;
}

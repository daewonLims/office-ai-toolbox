/**
 * 악성 zip(Office Open XML) 방어 공유 코어.
 *
 * .pptx·.docx·.xlsx는 모두 zip 컨테이너이므로 신뢰할 수 없는 업로드로 취급하고
 * 다음을 방어한다:
 *  1. 매직 바이트 검증 — 선두가 "PK"(0x50 0x4B)인지 확인 (확장자만 믿지 않음).
 *  2. zip bomb — 엔트리 수/엔트리당 크기/총 압축 해제 크기 상한. 풀기 전에
 *     메타데이터(선언된 압축 해제 크기)로 1차 검증하고, 화이트리스트 엔트리를
 *     풀면서 누적 실제 크기를 추적해 상한 초과 시 즉시 중단.
 *  3. 경로 검증 — ".." 포함/절대경로 무시, 처리 대상은 호출자가 준 화이트리스트로 제한.
 *
 * 반환값은 "화이트리스트에 해당하는 텍스트 파트"만 담은 Map<경로, 내용>.
 * 도구별 화이트리스트/형식 라벨은 호출자가 SafeZipOptions로 주입한다.
 * (ppt-lint·doc-diff 등 zip 기반 도구가 이 코어를 공유한다.)
 */
import JSZip from "jszip";

// ---- 업로드 / zip 보안 상한 -------------------------------------------------

/** 업로드 파일 크기 상한 (원본 zip 바이트) */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB
export const MAX_UPLOAD_LABEL = "50MB";

/** zip 엔트리 개수 상한 (zip bomb 방어) */
export const MAX_ENTRIES = 2_000;

/** 엔트리 1개당 압축 해제 크기 상한 */
export const MAX_ENTRY_BYTES = 50 * 1024 * 1024; // 50MB

/** 전체 압축 해제 누적 크기 상한 */
export const MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200MB

export class SafeZipError extends Error {}

export interface SafeZipOptions {
  /** 이 패턴 중 하나에 매칭되는 엔트리만 텍스트로 추출한다(나머지는 크기 검사만 수행). */
  whitelist: RegExp[];
  /** 매직 바이트 실패 메시지에 넣는 형식 라벨. 예: ".pptx", ".docx". */
  formatLabel: string;
}

export interface SafeZipResult {
  /** 화이트리스트에 해당하는 파트: 경로 → UTF-8 텍스트 */
  parts: Map<string, string>;
}

/** 경로 순회(zip slip) 방지: 절대경로/역슬래시/".." 세그먼트 거부 */
function isSafePath(name: string): boolean {
  if (name.length === 0) return false;
  if (name.startsWith("/") || name.startsWith("\\")) return false;
  if (name.includes("\\")) return false;
  const segments = name.split("/");
  return !segments.some((s) => s === ".." || s === ".");
}

/** JSZip 내부 메타에서 선언된 압축 해제 크기를 방어적으로 읽는다 (없으면 null) */
function declaredUncompressedSize(file: JSZip.JSZipObject): number | null {
  const data = (file as unknown as { _data?: { uncompressedSize?: unknown } })
    ._data;
  const size = data?.uncompressedSize;
  return typeof size === "number" && Number.isFinite(size) ? size : null;
}

/** UTF-8 바이트 길이 (TextEncoder가 있으면 사용, 없으면 근사) */
function byteLength(s: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(s).length;
  }
  // 폴백: 코드포인트 기반 근사
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    bytes += c < 0x80 ? 1 : c < 0x800 ? 2 : 3;
  }
  return bytes;
}

/**
 * ArrayBuffer(zip 컨테이너)를 안전하게 열어 화이트리스트 텍스트 파트를 반환.
 * 위반 시 SafeZipError(한국어 메시지)를 던진다.
 */
export async function openZip(
  buffer: ArrayBuffer,
  options: SafeZipOptions
): Promise<SafeZipResult> {
  const isWhitelisted = (name: string): boolean =>
    options.whitelist.some((re) => re.test(name));

  // 0) 업로드 크기 상한
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new SafeZipError(
      `파일이 너무 큽니다. 최대 ${MAX_UPLOAD_LABEL}까지 업로드할 수 있습니다.`
    );
  }

  // 1) 매직 바이트 검증 — zip은 "PK" (0x50 0x4B)로 시작
  const head = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  if (head.length < 2 || head[0] !== 0x50 || head[1] !== 0x4b) {
    throw new SafeZipError(
      `유효한 ${options.formatLabel} 파일이 아닙니다. (zip 서명이 확인되지 않았습니다)`
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer, { createFolders: false });
  } catch {
    throw new SafeZipError(
      "파일을 열 수 없습니다. 손상되었거나 지원하지 않는 형식입니다."
    );
  }

  const entries = Object.values(zip.files).filter((f) => !f.dir);

  // 2) 엔트리 수 상한
  if (entries.length > MAX_ENTRIES) {
    throw new SafeZipError(
      `압축 파일의 항목이 너무 많습니다 (최대 ${MAX_ENTRIES.toLocaleString()}개).`
    );
  }

  // 3) 메타데이터 1차 검증 — 선언된 압축 해제 크기 합/엔트리당 크기
  let declaredTotal = 0;
  for (const file of entries) {
    if (!isSafePath(file.name)) {
      throw new SafeZipError("허용되지 않는 경로가 포함되어 있습니다.");
    }
    const declared = declaredUncompressedSize(file);
    if (declared !== null) {
      if (declared > MAX_ENTRY_BYTES) {
        throw new SafeZipError(
          "압축 해제 크기가 허용치를 초과하는 항목이 있습니다. (zip bomb 의심)"
        );
      }
      declaredTotal += declared;
      if (declaredTotal > MAX_TOTAL_BYTES) {
        throw new SafeZipError(
          "전체 압축 해제 크기가 허용치를 초과합니다. (zip bomb 의심)"
        );
      }
    }
  }

  // 4) 화이트리스트 파트만 실제로 풀면서 누적 실제 크기를 추적
  const parts = new Map<string, string>();
  let actualTotal = 0;
  for (const file of entries) {
    if (!isWhitelisted(file.name)) continue;
    const text = await file.async("string");
    // Byte 길이로 누적 (문자열 length가 아니라 UTF-8 바이트 기준 근사)
    const bytes = byteLength(text);
    if (bytes > MAX_ENTRY_BYTES) {
      throw new SafeZipError(
        "압축 해제 크기가 허용치를 초과하는 항목이 있습니다. (zip bomb 의심)"
      );
    }
    actualTotal += bytes;
    if (actualTotal > MAX_TOTAL_BYTES) {
      throw new SafeZipError(
        "전체 압축 해제 크기가 허용치를 초과합니다. (zip bomb 의심)"
      );
    }
    parts.set(file.name, text);
  }

  return { parts };
}

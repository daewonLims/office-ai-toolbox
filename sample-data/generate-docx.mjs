/**
 * 문서 버전 비교(doc-diff) 데모용 .docx 생성기.
 * 실행: node sample-data/generate-docx.mjs
 *
 * 가상의 '사업계획서' v1/v2 두 버전을 각각 .docx로 만든다.
 * features/doc-diff/lib/demo.ts의 BEFORE_PARAS(v1) / AFTER_PARAS(v2)를 그대로 옮겨,
 * 배열의 문자열 하나당 문단(Paragraph) 하나로 기록한다.
 * (앱의 추출 로직 docx.ts는 word/document.xml의 w:p → w:t 를 문단 배열로 읽으므로
 *  이 매핑이 그대로 재현된다.)
 *
 * 출력:
 *  - 사업계획서_v1.docx (BEFORE_PARAS)
 *  - 사업계획서_v2.docx (AFTER_PARAS)
 */
import { Document, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));

// features/doc-diff/lib/demo.ts 에서 그대로 복사 (문자·공백·구두점 동일)
const BEFORE_PARAS = [
  "2026년 하반기 신제품 'A-라인' 출시 사업계획서",
  "1. 추진 배경",
  "최근 프리미엄 주방가전 시장이 연 8% 성장하며 신규 수요가 확대되고 있음.",
  "자사 기존 제품군은 중저가에 집중되어 프리미엄 세그먼트 대응이 미흡한 상황임.",
  "2. 사업 목표",
  "하반기 매출 목표는 12억 원으로 설정함.",
  "신규 고객 500명 확보를 목표로 함.",
  "브랜드 인지도를 현재 32%에서 40%까지 끌어올림.",
  "3. 출시 일정",
  "제품 양산은 8월 20일부터 시작함.",
  "공식 출시일은 9월 15일로 확정함.",
  "사전 예약은 9월 1일부터 2주간 운영함.",
  "4. 마케팅 전략",
  "초기 타깃 지역은 서울·경기로 한정함.",
  "온라인 채널 중심으로 광고를 집행하되, 오프라인 체험 매장 3곳을 병행 운영함.",
  "인플루언서 협업은 검토 후 결정함.",
  "5. 예산 및 리스크",
  "총 마케팅 예산은 2억 원으로 편성함.",
  "원자재 수급이 지연되면 출시가 늦어질 수 있음.",
  "6. 기대 효과",
  "프리미엄 라인 안착으로 브랜드 포지셔닝을 강화함.",
];

const AFTER_PARAS = [
  "2026년 하반기 신제품 'A-라인' 출시 사업계획서",
  "1. 추진 배경",
  "최근 프리미엄 주방가전 시장이 연 11% 성장하며 신규 수요가 빠르게 확대되고 있음.",
  "자사 기존 제품군은 중저가에 집중되어 프리미엄 세그먼트 대응이 부족하다는 지적이 있음.",
  "2. 사업 목표",
  "하반기 매출 목표는 15억 원으로 상향 설정함.",
  "신규 고객 650명 확보를 목표로 함.",
  "브랜드 인지도를 현재 32%에서 40%까지 끌어올림.",
  "3. 출시 일정",
  "제품 양산은 8월 20일부터 시작함.",
  "공식 출시일은 10월 5일로 확정함.",
  "사전 예약은 9월 20일부터 3주간 운영함.",
  "4. 마케팅 전략",
  "초기 타깃 지역은 수도권 전역(서울·경기·인천)으로 확대함.",
  "온라인 광고를 핵심 채널로 삼고, 오프라인 체험 매장을 5곳으로 확대 운영함.",
  "인플루언서 협업 3건을 9월 중 진행함.",
  "SNS 숏폼 콘텐츠를 주 2회 발행해 초기 화제성을 확보함.",
  "5. 예산 및 리스크",
  "총 마케팅 예산은 2.5억 원으로 편성함.",
  "6. 기대 효과",
  "프리미엄 라인 안착으로 브랜드 포지셔닝을 강화함.",
  "고객 후기 이벤트를 통해 재구매율 제고를 도모함.",
];

// ---- 파일 쓰기 --------------------------------------------------------------

async function writeDocx(fileName, paras) {
  const doc = new Document({
    sections: [
      {
        children: paras.map(
          (text) => new Paragraph({ children: [new TextRun(text)] })
        ),
      },
    ],
  });

  const raw = await Packer.toBuffer(doc);

  // 앱의 추출기(docx.ts)는 보안상 XML 엔티티를 확장하지 않는다(processEntities:false).
  // 그런데 docx 라이브러리는 아포스트로피를 &apos; 로 과도하게 이스케이프한다.
  // 아포스트로피는 텍스트 콘텐츠에서 이스케이프가 필요 없으므로 리터럴 ' 로 되돌려,
  // 앱이 demo.ts 원문("...'A-라인'...")을 그대로 읽게 한다.
  const zip = await JSZip.loadAsync(raw);
  const xml = await zip.file("word/document.xml").async("string");
  zip.file("word/document.xml", xml.replace(/&apos;/g, "'"));
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  const out = path.join(here, fileName);
  writeFileSync(out, buffer);
  console.log(
    `생성: ${out} (${paras.length}문단, ${(buffer.length / 1024).toFixed(1)} KB)`
  );
  return { out, buffer, paras };
}

const files = [
  await writeDocx("사업계획서_v1.docx", BEFORE_PARAS),
  await writeDocx("사업계획서_v2.docx", AFTER_PARAS),
];

// ---- 자체 검증: 다시 열어 문단 텍스트가 그대로 들어갔는지 확인 ----------------
// word/document.xml 을 풀어 각 원본 문자열이 실제로 기록됐는지,
// w:t 런 수가 문단 수와 일치하는지 본다(문단당 TextRun 1개).
for (const { out, buffer, paras } of files) {
  const zip = await JSZip.loadAsync(buffer);
  const xmlEntry = zip.file("word/document.xml");
  if (!xmlEntry) {
    console.error(`검증 실패: ${out} 에 word/document.xml 없음`);
    process.exit(1);
  }
  const xml = await xmlEntry.async("string");

  const runCount = (xml.match(/<w:t[ >]/g) || []).length;
  if (runCount !== paras.length) {
    console.error(
      `검증 실패: ${out} — w:t 런 ${runCount}개 ≠ 문단 ${paras.length}개`
    );
    process.exit(1);
  }

  const missing = paras.filter((t) => !xml.includes(t));
  if (missing.length > 0) {
    console.error(`검증 실패: ${out} — 누락된 문단 ${missing.length}개`, missing);
    process.exit(1);
  }

  console.log(`검증: ${path.basename(out)} — 문단 ${paras.length}개 모두 기록됨 ✓`);
}

console.log("완료 — 이 파일들을 /tools/doc-diff 에 업로드해 v1↔v2 비교를 테스트하세요.");

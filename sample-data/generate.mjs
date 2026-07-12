/**
 * 엑셀 취합 도구 테스트용 샘플 파일 생성기.
 * 실행: node sample-data/generate.mjs
 *
 * 같은 의미의 데이터를 서로 다른 컬럼명·날짜 형식으로 담은 3개 파일을 만든다.
 *  - 본사_직원명단.xlsx  (기준 양식)  : 성명 / 입사일 / 부서 / 연락처 / 이메일
 *  - 지점A_인원현황.xlsx (소스)      : 이름 / 입사날짜(YYYY/MM/DD) / 소속 / 전화 / 메일주소 / 비고
 *  - 지점B_명단.xlsx    (소스)      : 담당자명 / Join Date(MM-DD-YYYY) / 팀 / 휴대폰 / E-mail
 */
import ExcelJS from "exceljs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

async function writeSheet(fileName, headers, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));
  const out = path.join(here, fileName);
  await wb.xlsx.writeFile(out);
  console.log(`생성: ${out} (${rows.length}행)`);
}

await writeSheet(
  "본사_직원명단.xlsx",
  ["성명", "입사일", "부서", "연락처", "이메일"],
  [
    ["김철수", "2021-03-02", "영업1팀", "010-1111-2222", "cskim@corp.co.kr"],
    ["이영희", "2019-07-15", "총무팀", "010-2222-3333", "yhlee@corp.co.kr"],
    ["박민수", "2022-01-10", "개발팀", "010-3333-4444", "mspark@corp.co.kr"],
    ["최지은", "2020-11-23", "인사팀", "010-4444-5555", "jechoi@corp.co.kr"],
    ["정우성", "2023-05-08", "영업2팀", "010-5555-6666", "wsjung@corp.co.kr"],
    ["한소라", "2018-09-03", "재무팀", "010-6666-7777", "srhan@corp.co.kr"],
  ]
);

await writeSheet(
  "지점A_인원현황.xlsx",
  ["이름", "입사날짜", "소속", "전화", "메일주소", "비고"],
  [
    ["강동원", "2022/04/11", "영업", "010-1010-2020", "dwkang@brancha.kr", "파트타임"],
    ["송혜교", "2021/12/01", "관리", "010-3030-4040", "hksong@brancha.kr", ""],
    ["유재석", "2020/06/20", "영업", "010-5050-6060", "jsyoo@brancha.kr", "팀장"],
    ["아이유", "2023/02/14", "회계", "010-7070-8080", "iu@brancha.kr", ""],
    ["마동석", "2019/10/30", "물류", "010-9090-1010", "dsma@brancha.kr", "주간조"],
  ]
);

await writeSheet(
  "지점B_명단.xlsx",
  ["담당자명", "Join Date", "팀", "휴대폰", "E-mail"],
  [
    ["오하늘", "03-15-2022", "Sales", "01022334455", "hnoh@branchb.kr"],
    ["임바다", "08-01-2020", "Admin", "01033445566", "bdlim@branchb.kr"],
    ["서준호", "11-20-2021", "Sales", "01044556677", "jhseo@branchb.kr"],
    ["문가영", "01-05-2024", "Finance", "01055667788", "gymoon@branchb.kr"],
  ]
);

console.log("완료 — 이 파일들을 /tools/excel-merge에 업로드해 테스트하세요.");

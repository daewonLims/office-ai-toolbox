/**
 * PPT 린터 데모용 .pptx 생성기.
 * 실행: node sample-data/generate-pptx.mjs
 *
 * JSZip으로 최소 OOXML 구조를 직접 조립한다 (PowerPoint에서 실제로 열리는 유효 파일).
 * 의도적으로 심어둔 위반:
 *   - 슬라이드 3: 다른 글꼴("굴림")               → 글꼴 불일치
 *   - 슬라이드 4: 제목 위치 어긋남 + 팔레트 밖 색상(FF00FF) → 제목 위치 편차 + 색상 이탈
 *   - 슬라이드 5: 바닥글 누락                      → 바닥글 누락
 * 나머지는 일관되게 유지(오탐 없음 확인용).
 */
import JSZip from "jszip";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));

const XMLNS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const XMLNS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XMLNS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";

const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const BASE_FONT = "맑은 고딕";
const ALT_FONT = "굴림";
const TITLE_COLOR = "1F3864"; // 팔레트로 인정될 자주 쓰이는 색
const BODY_COLOR = "595959"; // 회색 계열(허용)
const BAD_COLOR = "FF00FF"; // 팔레트 밖(마젠타)

const TITLE_OFF = { x: 838200, y: 365125 };
const TITLE_EXT = { cx: 7467600, cy: 1470025 };
const SHIFTED_TITLE_OFF = { x: 3600000, y: 1600000 }; // 슬라이드 4 (크게 이동)

const NUM_SLIDES = 5;

// ---- 파트 빌더 --------------------------------------------------------------

function run(text, { font, sz, color }) {
  return (
    `<a:r><a:rPr lang="ko-KR" sz="${sz}" dirty="0">` +
    `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>` +
    `<a:latin typeface="${font}"/></a:rPr>` +
    `<a:t>${text}</a:t></a:r>`
  );
}

function shape(id, name, phXml, off, ext, paragraphs) {
  return (
    `<p:sp>` +
    `<p:nvSpPr>` +
    `<p:cNvPr id="${id}" name="${name}"/>` +
    `<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>` +
    `<p:nvPr>${phXml}</p:nvPr>` +
    `</p:nvSpPr>` +
    `<p:spPr>` +
    `<a:xfrm><a:off x="${off.x}" y="${off.y}"/><a:ext cx="${ext.cx}" cy="${ext.cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    `</p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/>` +
    paragraphs +
    `</p:txBody>` +
    `</p:sp>`
  );
}

function slideXml(n) {
  const font = n === 3 ? ALT_FONT : BASE_FONT;
  const bodyColor = n === 4 ? BAD_COLOR : BODY_COLOR;
  const titleOff = n === 4 ? SHIFTED_TITLE_OFF : TITLE_OFF;
  const hasFooter = n !== 5;

  const shapes = [];

  // 제목 placeholder
  shapes.push(
    shape(
      2,
      "Title 1",
      '<p:ph type="title"/>',
      titleOff,
      TITLE_EXT,
      `<a:p>${run(`발표 자료 제목 ${n}`, { font, sz: 4000, color: TITLE_COLOR })}</a:p>`
    )
  );

  // 본문 placeholder
  shapes.push(
    shape(
      3,
      "Content 1",
      '<p:ph type="body" idx="1"/>',
      { x: 838200, y: 1975000 },
      { cx: 7467600, cy: 3600000 },
      `<a:p>${run("본문 내용 항목입니다.", { font, sz: 1800, color: bodyColor })}</a:p>`
    )
  );

  // 바닥글 (슬라이드 5 제외)
  if (hasFooter) {
    shapes.push(
      shape(
        4,
        "Footer Placeholder 1",
        '<p:ph type="ftr" sz="quarter" idx="2"/>',
        { x: 457200, y: 6356350 },
        { cx: 2743200, cy: 365125 },
        `<a:p>${run("사내 발표자료", { font, sz: 1200, color: BODY_COLOR })}</a:p>`
      )
    );
  }

  // 슬라이드 번호 (모든 슬라이드)
  shapes.push(
    shape(
      5,
      "Slide Number Placeholder 1",
      '<p:ph type="sldNum" sz="quarter" idx="3"/>',
      { x: 8001000, y: 6356350 },
      { cx: 685800, cy: 365125 },
      `<a:p>${run(String(n), { font, sz: 1200, color: BODY_COLOR })}</a:p>`
    )
  );

  return (
    DECL +
    `<p:sld xmlns:a="${XMLNS_A}" xmlns:r="${XMLNS_R}" xmlns:p="${XMLNS_P}">` +
    `<p:cSld><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>` +
    `<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
    shapes.join("") +
    `</p:spTree></p:cSld>` +
    `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>` +
    `</p:sld>`
  );
}

function contentTypesXml() {
  const slideOverrides = Array.from(
    { length: NUM_SLIDES },
    (_, i) =>
      `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
  ).join("");
  return (
    DECL +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>` +
    `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>` +
    `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>` +
    `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>` +
    slideOverrides +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
    `</Types>`
  );
}

function rootRels() {
  return (
    DECL +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
    `</Relationships>`
  );
}

function presentationXml() {
  const sldIds = Array.from(
    { length: NUM_SLIDES },
    (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`
  ).join("");
  return (
    DECL +
    `<p:presentation xmlns:a="${XMLNS_A}" xmlns:r="${XMLNS_R}" xmlns:p="${XMLNS_P}">` +
    `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
    `<p:sldIdLst>${sldIds}</p:sldIdLst>` +
    `<p:sldSz cx="9144000" cy="6858000" type="screen4x3"/>` +
    `<p:notesSz cx="6858000" cy="9144000"/>` +
    `</p:presentation>`
  );
}

function presentationRels() {
  const slideRels = Array.from(
    { length: NUM_SLIDES },
    (_, i) =>
      `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
  ).join("");
  return (
    DECL +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>` +
    slideRels +
    `</Relationships>`
  );
}

function slideRels() {
  return (
    DECL +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
    `</Relationships>`
  );
}

function slideMasterXml() {
  return (
    DECL +
    `<p:sldMaster xmlns:a="${XMLNS_A}" xmlns:r="${XMLNS_R}" xmlns:p="${XMLNS_P}">` +
    `<p:cSld><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>` +
    `<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
    `</p:spTree></p:cSld>` +
    `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
    `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>` +
    `<p:txStyles>` +
    `<p:titleStyle><a:lvl1pPr algn="ctr"><a:defRPr sz="4400" kern="1200"/></a:lvl1pPr></p:titleStyle>` +
    `<p:bodyStyle><a:lvl1pPr><a:defRPr sz="2800" kern="1200"/></a:lvl1pPr></p:bodyStyle>` +
    `<p:otherStyle><a:lvl1pPr><a:defRPr sz="1800" kern="1200"/></a:lvl1pPr></p:otherStyle>` +
    `</p:txStyles>` +
    `</p:sldMaster>`
  );
}

function slideMasterRels() {
  return (
    DECL +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>` +
    `</Relationships>`
  );
}

function slideLayoutXml() {
  return (
    DECL +
    `<p:sldLayout xmlns:a="${XMLNS_A}" xmlns:r="${XMLNS_R}" xmlns:p="${XMLNS_P}" type="blank" preserve="1">` +
    `<p:cSld name="빈 화면"><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>` +
    `<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
    `</p:spTree></p:cSld>` +
    `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>` +
    `</p:sldLayout>`
  );
}

function slideLayoutRels() {
  return (
    DECL +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>` +
    `</Relationships>`
  );
}

function themeXml() {
  return (
    DECL +
    `<a:theme xmlns:a="${XMLNS_A}" name="Office 테마">` +
    `<a:themeElements>` +
    `<a:clrScheme name="Office">` +
    `<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>` +
    `<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>` +
    `<a:dk2><a:srgbClr val="44546A"/></a:dk2>` +
    `<a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>` +
    `<a:accent1><a:srgbClr val="4472C4"/></a:accent1>` +
    `<a:accent2><a:srgbClr val="ED7D31"/></a:accent2>` +
    `<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>` +
    `<a:accent4><a:srgbClr val="FFC000"/></a:accent4>` +
    `<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>` +
    `<a:accent6><a:srgbClr val="70AD47"/></a:accent6>` +
    `<a:hlink><a:srgbClr val="0563C1"/></a:hlink>` +
    `<a:folHlink><a:srgbClr val="954F72"/></a:folHlink>` +
    `</a:clrScheme>` +
    `<a:fontScheme name="Office">` +
    `<a:majorFont><a:latin typeface="${BASE_FONT}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>` +
    `<a:minorFont><a:latin typeface="${BASE_FONT}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>` +
    `</a:fontScheme>` +
    `<a:fmtScheme name="Office">` +
    `<a:fillStyleLst>` +
    `<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>` +
    `<a:gradFill rotWithShape="1"><a:gsLst>` +
    `<a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="110000"/><a:satMod val="105000"/><a:tint val="67000"/></a:schemeClr></a:gs>` +
    `<a:gs pos="50000"><a:schemeClr val="phClr"><a:lumMod val="105000"/><a:satMod val="103000"/><a:tint val="73000"/></a:schemeClr></a:gs>` +
    `<a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="105000"/><a:satMod val="109000"/><a:tint val="81000"/></a:schemeClr></a:gs>` +
    `</a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>` +
    `<a:gradFill rotWithShape="1"><a:gsLst>` +
    `<a:gs pos="0"><a:schemeClr val="phClr"><a:satMod val="103000"/><a:lumMod val="102000"/><a:tint val="94000"/></a:schemeClr></a:gs>` +
    `<a:gs pos="50000"><a:schemeClr val="phClr"><a:satMod val="110000"/><a:lumMod val="100000"/><a:shade val="100000"/></a:schemeClr></a:gs>` +
    `<a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="99000"/><a:satMod val="120000"/><a:shade val="78000"/></a:schemeClr></a:gs>` +
    `</a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>` +
    `</a:fillStyleLst>` +
    `<a:lnStyleLst>` +
    `<a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>` +
    `<a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>` +
    `<a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>` +
    `</a:lnStyleLst>` +
    `<a:effectStyleLst>` +
    `<a:effectStyle><a:effectLst/></a:effectStyle>` +
    `<a:effectStyle><a:effectLst/></a:effectStyle>` +
    `<a:effectStyle><a:effectLst><a:outerShdw blurRad="57150" dist="19050" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="63000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle>` +
    `</a:effectStyleLst>` +
    `<a:bgFillStyleLst>` +
    `<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>` +
    `<a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/><a:satMod val="170000"/></a:schemeClr></a:solidFill>` +
    `<a:gradFill rotWithShape="1"><a:gsLst>` +
    `<a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="93000"/><a:satMod val="150000"/><a:shade val="98000"/><a:lumMod val="102000"/></a:schemeClr></a:gs>` +
    `<a:gs pos="50000"><a:schemeClr val="phClr"><a:tint val="98000"/><a:satMod val="130000"/><a:shade val="90000"/><a:lumMod val="103000"/></a:schemeClr></a:gs>` +
    `<a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="63000"/><a:satMod val="120000"/></a:schemeClr></a:gs>` +
    `</a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>` +
    `</a:bgFillStyleLst>` +
    `</a:fmtScheme>` +
    `</a:themeElements>` +
    `</a:theme>`
  );
}

function coreXml() {
  return (
    DECL +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>발표자료 데모</dc:title>` +
    `<dc:creator>Office AI Toolbox</dc:creator>` +
    `<cp:lastModifiedBy>Office AI Toolbox</cp:lastModifiedBy>` +
    `</cp:coreProperties>`
  );
}

function appXml() {
  return (
    DECL +
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
    `<Application>Microsoft Office PowerPoint</Application>` +
    `<Slides>${NUM_SLIDES}</Slides>` +
    `<Company>Office AI Toolbox</Company>` +
    `</Properties>`
  );
}

// ---- 조립 ------------------------------------------------------------------

const zip = new JSZip();
zip.file("[Content_Types].xml", contentTypesXml());
zip.file("_rels/.rels", rootRels());
zip.file("docProps/core.xml", coreXml());
zip.file("docProps/app.xml", appXml());
zip.file("ppt/presentation.xml", presentationXml());
zip.file("ppt/_rels/presentation.xml.rels", presentationRels());
zip.file("ppt/theme/theme1.xml", themeXml());
zip.file("ppt/slideMasters/slideMaster1.xml", slideMasterXml());
zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", slideMasterRels());
zip.file("ppt/slideLayouts/slideLayout1.xml", slideLayoutXml());
zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", slideLayoutRels());
for (let n = 1; n <= NUM_SLIDES; n++) {
  zip.file(`ppt/slides/slide${n}.xml`, slideXml(n));
  zip.file(`ppt/slides/_rels/slide${n}.xml.rels`, slideRels());
}

const outPath = path.join(here, "발표자료_데모.pptx");
const buffer = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
});
writeFileSync(outPath, buffer);

// ---- 자체 검증: 필수 파트 존재 확인 -----------------------------------------
const REQUIRED = [
  "[Content_Types].xml",
  "_rels/.rels",
  "ppt/presentation.xml",
  "ppt/_rels/presentation.xml.rels",
  "ppt/theme/theme1.xml",
  "ppt/slideMasters/slideMaster1.xml",
  "ppt/slideLayouts/slideLayout1.xml",
  ...Array.from({ length: NUM_SLIDES }, (_, i) => `ppt/slides/slide${i + 1}.xml`),
];
const reopened = await JSZip.loadAsync(buffer);
const missing = REQUIRED.filter((p) => !reopened.file(p));
if (missing.length > 0) {
  console.error("누락된 필수 파트:", missing);
  process.exit(1);
}

console.log(`생성: ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
console.log(`필수 파트 ${REQUIRED.length}개 모두 존재 ✓`);
console.log(
  "심어둔 위반 — 슬라이드3: 글꼴, 슬라이드4: 제목위치+색상, 슬라이드5: 바닥글누락"
);

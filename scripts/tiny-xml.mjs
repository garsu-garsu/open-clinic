/**
 * 응급의료정보원 API는 XML만 줘요(JSON 옵션이 없어요).
 * 필요한 건 <item> 목록과 <totalCount> 뿐이라 파서를 통째로 들이지 않고
 * 이 파일 하나로 끝냅니다.
 *
 * ponytail: 평평한 <item><a>1</a></item> 구조만 다뤄요.
 *           중첩·속성·네임스페이스가 필요해지면 fast-xml-parser 를 쓰세요.
 */

const CDATA = /^<!\[CDATA\[([\s\S]*?)\]\]>$/;

function decode(s) {
  const m = s.match(CDATA);
  if (m != null) return m[1];
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/** <item>…</item> 을 전부 평평한 객체로. */
export function XMLParser(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) != null) {
    const obj = {};
    const fieldRe = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;
    let f;
    while ((f = fieldRe.exec(m[1])) != null) obj[f[1]] = decode(f[2]);
    items.push(obj);
  }

  const total = xml.match(/<totalCount>(\d+)<\/totalCount>/);
  // 키가 틀리면 items 가 0건이고 에러 메시지만 들어와요. 그대로 흘려보내 보여줍니다.
  const err = xml.match(/<returnAuthMsg>([\s\S]*?)<\/returnAuthMsg>/);
  if (items.length === 0 && err != null) {
    throw new Error(`API 응답 오류: ${decode(err[1])}`);
  }

  return { items, totalCount: total != null ? Number(total[1]) : items.length };
}

/* 자체 점검 — `node scripts/tiny-xml.mjs` */
export function demo() {
  const xml = `<response><body><totalCount>2</totalCount><items>
    <item><dutyName>가나의원</dutyName><dutyTime1s>0900</dutyTime1s><wgs84Lat>37.5</wgs84Lat></item>
    <item><dutyName><![CDATA[다라&amp;약국]]></dutyName><dutyTel1>02-000-0000</dutyTel1></item>
  </items></body></response>`;
  const r = XMLParser(xml);
  if (r.items.length !== 2) throw new Error("item 2건이어야 해요");
  if (r.items[0].dutyName !== "가나의원") throw new Error("이름 파싱");
  if (r.items[0].wgs84Lat !== "37.5") throw new Error("좌표 파싱");
  if (r.items[1].dutyName !== "다라&amp;약국") throw new Error("CDATA 는 안쪽을 그대로");
  if (r.totalCount !== 2) throw new Error("totalCount");

  let threw = false;
  try {
    XMLParser("<response><returnAuthMsg>SERVICE KEY IS NOT REGISTERED</returnAuthMsg></response>");
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("키 오류는 예외로 터져야 해요");

  console.log("tiny-xml OK");
}

if (process.argv[1]?.endsWith("tiny-xml.mjs")) demo();

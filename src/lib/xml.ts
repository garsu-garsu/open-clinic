/**
 * 응급의료정보원 API는 XML만 줘요(JSON 옵션이 없어요).
 * 필요한 건 <item> 목록과 <totalCount> 뿐이라 파서를 통째로 들이지 않고
 * 이 파일 하나로 끝냅니다. scripts/tiny-xml.mjs 와 같은 로직인데,
 * 이건 브라우저에서 fetch 응답을 바로 파싱하는 런타임용이에요.
 *
 * ponytail: 평평한 <item><a>1</a></item> 구조만 다뤄요.
 *           중첩·속성·네임스페이스가 필요해지면 라이브러리를 쓰세요.
 */

const CDATA = /^<!\[CDATA\[([\s\S]*?)\]\]>$/;

function decode(s: string): string {
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

export interface XmlResult {
  items: Record<string, string>[];
  totalCount: number;
}

/** <item>…</item> 을 전부 평평한 객체로. */
export function parseXml(xml: string): XmlResult {
  const items: Record<string, string>[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) != null) {
    const obj: Record<string, string> = {};
    const fieldRe = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;
    let f: RegExpExecArray | null;
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

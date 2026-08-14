# 문 연 병원 약국 (open-clinic)

내 주변에서 **지금 문 연** 병원·약국만 가까운 순으로 보여주는 앱인토스 미니앱.

## 데이터는 런타임에 직접 불러옵니다

병·의원/약국 정보는 앱을 열 때마다 공공데이터포털 API를 브라우저에서 바로 호출해요.

```
병의원   https://apis.data.go.kr/B552657/HsptlAsembySearchService/getHsptlMdcncListInfoInqire
약국     https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyListInfoInqire
```

이 API는 좌표 반경 검색이 없고 "시도/시군구 이름"으로만 조회가 돼요. 그래서 좌표만 아는
앱이 가장 가까운 시군구를 고를 수 있게 `src/lib/districts.ts` 에 시군구 중심좌표 표를
미리 구워 뒀습니다(`npm run districts` 로 재생성 — 자주 안 바뀌는 1회성 배치예요).

오늘 요일에 해당하는 시군구 데이터를 받아 `localStorage` 에 캐싱하고(날짜가 바뀌면
자동으로 새로 받아요), 인증키는 `.env` 의 `VITE_DATA_KEY` 를 씁니다. 자세한 절충은
`src/lib/env.ts` 주석을 보세요.

## 지도

**Leaflet + OpenStreetMap** 을 씁니다. 지도사 SDK를 쓰지 않아요 — 이 앱에서 지도가
하는 일은 핀 찍기와 반경 원 그리기가 전부라, 타일 주소 한 줄이면 됩니다. 인증키도
도메인 등록도 필요 없고, 앱인토스에서 실제로 도는 게 확인된 경로입니다.

타일이 통째로 막혔을 때만(한두 장 실패는 정상이에요) 안내를 띄우고 목록 탭으로
보냅니다. 타일 주소를 바꾸고 싶으면 `src/lib/env.ts` 의 `TILE_URL` 한 줄만 고치면 됩니다.

⚠️ OSM 공식 타일 서버는 대량 트래픽을 허용하지 않아요. 사용자가 늘면 타일 제공자를
따로 두거나 직접 호스팅해야 합니다.

## 수익화

하단 고정 배너 + 목록 맨 아래 이미지형 배너, 둘뿐입니다.
급한 사람에게 전면·리워드 광고를 물리면 앱을 지웁니다.

## 명령어

```bash
npm run dev             # 개발 서버
npm run check:schedule  # 진료시간 판정 자체 점검
npm run districts       # 시군구 중심좌표 표 재생성 (1회성 배치)
npm run typecheck
npm run build           # vite build + ait build (.ait 번들)
npm run deploy
```

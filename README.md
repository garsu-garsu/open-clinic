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

카카오맵 JS SDK를 씁니다. 키가 없으면 지도를 숨기고 목록만 보여줘요 — 지도가 없어도 앱은 제 역할을 합니다.

`.env` 에 `VITE_KAKAO_JS_KEY` 를 넣고, **카카오 개발자센터 > 앱 설정 > 플랫폼 > Web 에 아래 두 도메인을 반드시 등록**하세요. 등록하지 않으면 SDK가 무한 로딩에 걸립니다.

```
https://open-clinic.apps.tossmini.com
https://open-clinic.private-apps.tossmini.com
```

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

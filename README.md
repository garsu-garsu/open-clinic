# 화장실 어디 (open-clinic)

내 주변에서 **지금 열려 있는** 공중화장실을 가까운 순으로 보여주는 앱인토스 미니앱.

## 서버가 없습니다

공중화장실 위치는 변하지 않아서, 빌드할 때 정적 파일로 구워둡니다.
런타임에 부르는 외부 API가 없으므로 API 키 노출도 CORS 문제도 없어요.

```
public/data/cells/{y}_{x}.json   0.05도(약 5km) 격자 한 칸
```

앱은 내 위치 주변 3×3 칸만 읽습니다. 전국 6만 건을 통째로 내려받지 않아요.

## 데이터 만들기

원본: [전국공중화장실표준데이터](https://www.data.go.kr/data/15012892/standard.do) (공공누리 — 저장·재배포 자유)

**⚠️ 2025년 2월부터 이 데이터에서 위도·경도 제공이 중단됐어요.** 주소만 남아서 직접 좌표를 찍어야 합니다.

```bash
# 1) 위 링크에서 CSV를 받아 data/ 에 둡니다
# 2) VWorld 지오코더 키를 발급받습니다 (https://www.vworld.kr, 무료)
VWORLD_KEY=발급받은키 npm run data data/전국공중화장실표준데이터.csv
```

카카오·네이버 지오코딩은 **결과를 DB에 저장하는 게 약관 위반**이라 쓰지 않습니다.
VWorld는 국토부 공공데이터라 저장·재배포가 됩니다.

지오코딩 결과는 `scripts/.geocache.json` 에 쌓여서, 중간에 끊고 다시 돌려도 이어집니다.

커버리지를 넓히려면 [전국공공시설개방정보표준데이터](https://www.data.go.kr/data/15013117/standard.do)(관공서 개방 화장실)를 같은 스크립트로 한 번 더 돌려 합치세요. 공중화장실만으로는 도심 커버리지가 얕습니다.

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
npm run dev          # 개발 서버
npm run check:hours  # 개방시간 판정 자체 점검
npm run typecheck
npm run build        # vite build + ait build (.ait 번들)
npm run deploy
```

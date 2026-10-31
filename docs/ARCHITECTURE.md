# 아키텍처 개요

Sumdoku는 Android 네이티브 셸(Java) 위에 WebView로 게임 화면을 올린 하이브리드 앱입니다. 게임 로직과 UI는 JavaScript, 플랫폼 기능(광고·결제·Play 게임즈·로컬 네트워크)은 Java 브리지가 담당합니다.

```mermaid
flowchart LR
  subgraph Android["Android 셸 (Java)"]
    MA["MainActivity / JS 브리지"]
    BS["로컬 배틀 서버 · 방 탐색"]
    MON["AdMob · Play Billing"]
    PG["Play 게임즈 · 클라우드 저장"]
  end
  subgraph Web["WebView (HTML/CSS/JS)"]
    UI["게임 UI · 17개 언어"]
    GEN["퍼즐 생성기 (Web Worker)"]
    DED["연역 엔진 · 힌트"]
    RT["레이팅 · 랭킹 · 보상"]
    OM["온라인 배틀 (WebRTC)"]
  end
  CF["Cloudflare Workers\n매칭 · 순위표 · 신고 접수"]
  UI <--> MA
  UI --> GEN --> DED
  UI --> RT
  OM <--> CF
  RT <--> CF
  MA --- BS & MON & PG
```

## 퍼즐 생성 파이프라인

```mermaid
flowchart LR
  A["1. 9×9 정답판"] --> B["2. 2~4칸 케이지 분할"] --> C["2.5 유일해 검사\n(MRV 백트래킹, 실패 시 국소 재분할)"] --> D["3. 사람 연역 규칙만으로\n81칸 확정 가능한지 검증"] --> E["제공"]
```

난이도는 공개 앵커 수와 케이지 합계 공개 여부(루나틱은 일부 합계 비공개)로 조절하며, 모든 난이도에서 추측 없이 풀리는지 3단계에서 확인합니다.

## 온라인 배틀

- 시그널링·매칭은 Cloudflare Workers(Durable Objects), 게임 데이터는 WebRTC DataChannel로 직접 주고받습니다. 직접 연결이 안 되면 TURN 중계로 전환합니다.
- 두 플레이어는 같은 퍼즐을 풀며 진행 상황·점수·채팅을 실시간으로 동기화합니다.
- 결과는 난이도별 ELO 레이팅에 반영되고, 서버 순위표는 현재 RP 기준으로 계산합니다.

## 다국어 처리

- 기본 8개 언어 표 + 추가 9개 언어는 영어 문구를 키로 하는 확장 표로 번역합니다.
- 긴 번역으로 레이아웃이 깨지지 않도록 고정 그리드 + 글자 크기 자동 축소(`showcase/sd-fit.js`)를 사용합니다.
- 아랍어·히브리어는 RTL 레이아웃을 적용합니다.

## 운영

- 앱의 신고 창과 처리되지 않은 JS 오류는 Workers로 전송되어 같은 오류끼리 묶입니다.
- 개발자는 별도 웹 대시보드에서 상태(새 신고·처리 중·해결·보류)와 메모를 관리합니다.

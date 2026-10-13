# Sumdoku (썸도쿠)

> **찍지 않고 100% 순수 논리 추론만으로 풀 수 있는 킬러 수도쿠 퍼즐 안드로이드 앱**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/yjw071218/sumdoku)](https://github.com/yjw071218/sumdoku/releases)

---

## 📱 주요 특징

- **100% 연역 추론 보장 엔진**: 백트래킹(가정/찍기) 없이 오직 소거법과 연역적 추론만으로 모든 칸이 100% 풀리도록 수학적으로 검증된 맵 생성
- **완전한 빈칸 시작 & 1칸 시작 힌트**: 어떤 숫자도 미리 채워지지 않은 상태에서 1칸짜리 케이지의 합계 숫자를 시작 단서 삼아 직접 풀어나가는 재미
- **반응형 태블릿 & 폰 맞춤 UI**:
  - **스마트폰**: 세로형 단일 컬럼 레이아웃, 하단 1~9 원형 키패드
  - **태블릿**: 2컬럼 분할 레이아웃(좌측 대형 9x9 보드 + 우측 케이지 상세 도우미 카드 & 컨트롤 패널)
- **전적 및 통계 시스템**:
  - 총 게임 수, 승리 횟수, 승률(%), 최고 연승 기록
  - 난이도별(초급, 중급, 전문가) 최단 클리어 기록 및 평균 소요 시간
- **게임 이어하기**: 앱 종료 후에도 직전 진행 중이던 게임 자동 보존
- **GitHub 자동 업데이트 체커**: 새로운 APK 버전이 릴리스되면 앱 내에서 감지하고 즉시 다운로드 안내

---

## 🛠 기술 스택

- **Android SDK & WebView Architecture** (Java 17, Gradle 8.11.1)
- **HTML5 / CSS3 / Vanilla JavaScript Core Engine**
- **Offline Self-Contained**: 인터넷 연결 없이도 무한 생성 및 플레이 가능

---

## 📦 설치 및 다운로드

[GitHub Releases](https://github.com/yjw071218/sumdoku/releases/latest)에서 최신 `Sumdoku-v1.0.0.apk`를 다운로드하여 안드로이드 기기에 설치할 수 있습니다.

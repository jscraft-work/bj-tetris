# 03-architecture: 웹게임 아키텍처

## 1. 목적

- 목표: 모바일 웹(갤럭시 우선)에서 안정적으로 동작하는 테트리스 핵심 게임 루프를 빠르게 구현하고, 추후 WebView/앱 포장 시에도 구조 변경 비용을 최소화한다.
- 우선순위: 기능 정확도 > 입력 반응성 > 렌더 효율성.

## 2. 플랫폼/기술 스택

- 런타임: 브라우저 기반 단일 페이지(정적 자산 우선)
- 렌더링: `HTMLCanvasElement` 2D (`2d` 컨텍스트)
- 상태/로직: 순수 TS/JS 모듈(React 없어도 가능), UI는 최소 HTML 오버레이
- 입력: 터치 버튼 + 키보드(개발/테스트 보조)
- 폰트/타이밍: `requestAnimationFrame` + 고정 스텝 타이머(낙하 주기)

## 3. 아키텍처 원칙

- 책임 분리: `게임 상태` / `게임 규칙` / `렌더링` / `입력` / `오디오`를 분리.
- 결정적 상태 업데이트: 입력·시간 진행은 하나의 `dispatch` 경로로 통일하여 예측 가능한 재현성 확보.
- 불변성 준수 범위: 핵심 상태는 참조 일관성을 위해 얕은 불변 갱신, 렌더 최적화 구간은 구조 공유 허용.
- 모바일 우선: 레이아웃 계산은 화면 크기 변경(회전 포함) 이벤트에서만 재계산.

## 4. 디렉터리 구조(안)

```text
src/
  core/
    engine/
      gameLoop.ts
      scheduler.ts
      gameState.ts
    logic/
      board.ts
      pieces.ts
      collision.ts
      rotation.ts
      lines.ts
      scoring.ts
      random.ts
    render/
      tetrisCanvas.ts
      assets.ts
  input/
    touchControls.ts
    keyboard.ts
  services/
    audio.ts
    vibration.ts
    storage.ts
  ui/
    hud.ts
    controls.ts
  index.ts
```

- `core/engine`가 전반 루프와 상태 전이를 담당.
- `core/logic`은 규칙/물리/점수만 갖고, DOM/Canvas 의존 없음.
- `render`는 픽셀 렌더 및 dirty-region 중심 재그리기 담당.

## 5. 핵심 상태 모델

```ts
type GameState = {
  status: 'idle' | 'playing' | 'paused' | 'gameover';
  board: number[][];        // 12x22(10칸 게임 너비 + 좌우 가드, 상단 2칸 버퍼)
  active: ActivePiece | null;
  nextQueue: PieceType[];
  hold: PieceType | null;
  score: number;
  lines: number;
  level: number;
  dropMs: number;
  softDrop: boolean;
  lastTick: number;
  dropAccumulator: number;
  rngSeed?: number;
  stats: { moved: number; rotated: number; hardDrops: number; linesCleared: number };
};
```

- `board`: 내부 규칙 처리용 좌표계(고정 크기)를 사용하면 충돌 체크가 단순해짐.
- 보드 크기 변경이 필요하면, 렌더 전용 스케일만 바꿔서 논리 영역은 고정 유지.

## 6. 게임 루프 및 타이밍

- `gameLoop`
  - `requestAnimationFrame(step)`에서 실제 경과 시간(`delta`) 누적.
  - 누적 시간으로 낙하 타이밍은 고정 간격(예: `dropMs`)을 기반으로 여러 스텝 소모 가능.
  - `softDrop` 중일 때 유효 드롭 간격은 `dropMs * 0.2` 내외로 보정.
- `physics step`(고정)
  - `입력 처리 -> 이동/회전 시도 -> 중력 적용 -> 고정/라인클리어 -> 다음 블록` 순서.
- 재개(Resume)
 - 잔여 누적시간을 유지한 상태로 재개 가능(권장), 게임 정지 시 `delta` 버퍼를 초기화해 급격한 낙하 방지.
- 애니메이션 스텝(권장 추가 레이어)
  - 낙하/회전/클리어 애니메이션을 독립적인 `animState`로 추적.
  - 물리 스텝은 즉시 상태를 갱신하고, 렌더 스텝에서 보간/이펙트를 적용.
  - 주요 애니메이션: 회전 보간, 라인 플래시, 라인 제거 후 재낙하.

## 7. 렌더링 전략

- 프레임당 전부 다시 그리지 않고, 상태 변경이 있을 때만 캔버스 갱신.
- 렌더링 계층 분리
  - 배경/격자/필드/활성 블록/고스트/다음 블록/오버레이를 레이어로 분리.
  - 모바일 성능상 그라디언트/필터 과다 사용 지양.
- 고정 픽셀 사이즈 계산
  - 보드 실제 표시 크기 = `min(vw, vh * aspect)` 기반.
  - DPR 고려하여 `canvas.width = cssW * dpr`, `canvas.height = cssH * dpr`, 스케일링 적용.
- 30~60 FPS 안정화를 위해
  - 오버레이 문자열은 매 프레임 갱신 금지, 상태 변화 시만 갱신.
  - 오디오/진동 호출을 렌더 경로에서 분리.
- 라인 제거 후 낙하 애니메이션은 타임 스텝별 위치 보간(`t in [0,1]`)으로 표시하고, 최종 물리 상태는 즉시 정합.

## 8. 충돌 및 조작 모듈

- `collision.ts`
  - `canMove(piece, board, dx, dy)`
  - `canRotate(piece, board, rotateDir)`
  - 회전 실패 시 오프셋 시도 순서 적용(제자리 -> 좌/우/상/하 1칸)
- 입력은 키-액션 맵으로 분해
  - 입력 시작/종료 이벤트를 받아 `action`으로 큐잉
  - 연속 입력(좌우/하강)은 자동 반복 간격(초기/유지)으로 처리
- 하드드롭
  - 목표 y를 끝까지 탐색(`while canMove`)하고 이동거리*점수 보정.

## 9. 피스/랜덤 설계

- 14-bag 생성기와 `RESET` 토큰 룰은 `random.ts`로 격리.
- 동일한 바구니를 공유하지 않고 `shuffle bag`를 즉시 분리 생성 후 소비.
- `nextQueue`는 최소 2~3개 선조회 가능.
- 스폰시 충돌 즉시 `gameover` 판정.

## 10. 점수/레벨/속도 모듈

- 점수 계산은 `scoring.ts`
  - 싱글 100, 더블 300, 트리플 500, 텔리스 800
  - 백투백 보너스, 하드드롭 거리 보너스 분리 계산.
- 레벨은 누적 라인 기준 10단위 상승.
- 레벨별 낙하 간격은 `dropTable[level]` 또는 `baseDropMs * 0.9^level` 형태.

## 11. 입력/사운드/진동 분리

- `input`은 실제 장치 이벤트를 받아 정규화된 `GameAction`으로 변환.
- 오디오/진동은 `services` 레이어:
  - `audio.play(effect)`
  - `vibration.pulse(ms)`
  - 정책: 사용자 제스처가 먼저 들어온 뒤에만 오디오 활성화.

## 12. 데이터 영속성

- 세션성 최고 점수/설정만 `localStorage` 저장.
- 저장 스키마: `bestScore`, `sound`, `vibration`, `orientationPref`
- 초기 로드 시 데이터 검증/기본값 폴백 적용.

## 13. 테스트 전략(최소)

- 순수 로직 단위 테스트(권장)
  - 회전/벽킥/충돌 경계
  - 라인 클리어(1~4줄), 연쇄 처리
  - 레벨업과 낙하 속도 테이블
  - 14-bag 공정성 + RESET 토큰 동작
- 수동 테스트 시나리오
  - 갤럭시 크기 3종(세로/가로)에서 렌더 깨짐 없는지
  - 장시간 플레이 후 메모리 증가/프레임 저하
  - 터치 버튼 누름, 길게 누르기, 떨림/중복 터치

## 14. 구현 순서(Phase 1 제안)

1. 상태/보드/충돌/이동/회전 유닛 로직부터 구현
2. requestAnimationFrame 루프 + 고정 스텝 낙하 연결
3. Canvas 렌더러(필드+HUD 최소) 연결
4. 터치 버튼 + 키보드 입력 어댑터 연결
5. 라인클리어/점수/레벨/게임오버 완성
6. 회전/클리어/라인 낙하 애니메이션 계층 추가
7. 사운드/진동, 설정 저장, pause/resume 보완

## 15. 비고

- WebView 전환 시 `Canvas` 렌더 경로를 유지하고 플랫폼 브릿지(진동/사운드)만 래핑하면 추가 구현 최소화.

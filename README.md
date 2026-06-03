# 버니에코 (Bunnecho)

Bunnecho는 카메라 촬영 화면에서 얼굴 기반 프레임(버니 프레임)과 파티클 오버레이를 적용하고,
촬영 결과를 확인/공유 화면으로 이어주는 웹 포토부스 프로젝트입니다.

## 핵심 기능

- 실시간 카메라 미리보기 + 필터 선택
- 얼굴 감지 기반 버니 프레임 오버레이
- 파티클 선택 UI (없음/별/사과/토끼/장미/음표)
- 파티클 커스텀 색상 팔레트 랜덤 적용
- 촬영 결과 저장 및 최근 사진 보기
- 얼굴 기준 공유용 사각 크롭 이미지 생성
- 공유 화면에서 떠다니는 얼굴 버블 표시

## 기술 스택

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- MediaPipe Tasks Vision + FaceDetector API 대체 경로
- localStorage + IndexedDB

## 화면 구성

- 카메라: app/page.tsx
	- 실시간 비디오 렌더
	- 필터/파티클 선택
	- 얼굴 감지 후 프레임 렌더
	- 캡처 시 프레임/파티클 합성
- 사진 보기: app/view-photo/page.tsx
	- 최신 촬영 사진 표시
	- 공유용 컷아웃 생성 트리거
- 공유 화면: app/share-face/page.tsx
	- 공유 이미지 버블 애니메이션

## 에셋 폴더 규칙

- 배경: public/img/background
	- main-bg.png
- 프레임: public/img/frame
	- bunny.png
- 파티클: public/img/particle
	- star.png
	- apple.png
	- bunny.png.png
	- rose.png
	- note.png

## 저장 구조

- 촬영 최종 이미지: localStorage
	- 키: bunnecho-photos
	- 구현: lib/photo-store.ts
- 원본(후처리 전) 이미지: IndexedDB
	- DB: bunnecho / store: raw_photos
	- 구현: lib/photo-raw-store.ts
- 공유용 얼굴 이미지 목록: localStorage
	- 키: bunnecho-shared-faces
	- 구현: lib/shared-face-store.ts

## 얼굴 감지 파이프라인

구현 파일: lib/face-detection.ts

1. MediaPipe FaceDetector 우선 사용
2. 사용 불가 시 브라우저 FaceDetector 사용
3. 둘 다 실패 시 휴리스틱 대체 감지 사용
4. 감지 결과를 정제하여 비정상 박스 필터링

## 캡처 렌더링 개요

구현 파일: app/page.tsx

1. 비디오 프레임을 필터와 함께 캔버스에 렌더
2. 셔터 시점 오버레이 상태(프레임/파티클)를 스냅샷
3. 프레임 이미지와 파티클 이미지를 동일 좌표계로 합성
4. 결과 JPEG를 photo-store에 저장

## 파티클 설정

- 설정 위치: app/page.tsx의 PARTICLE_PRESETS
- 색상 팔레트: lib/particle-colors.ts
- 현재 팔레트
	- #faeea4
	- #f6ccdd
	- #9cc2e7
	- #beaed4
	- #facea3

## 프레임 기반 공유 크롭

구현 파일: lib/bunny-share-cutout.ts

- 얼굴 박스를 기준으로 프레임 크롭 프로필(frameScale, bottomOffsetFaceRatio)을 적용
- OUTPUT_SIZE(320x320)로 사각형 공유 이미지를 생성
- 프레임 종류가 늘어나면 프로필만 추가해 확장 가능

## 빠른 시작

1. 의존성 설치

```bash
yarn install
```

2. 개발 서버 실행

```bash
yarn dev
```

3. 브라우저에서 확인

```text
http://localhost:3000
```

## 스크립트

- 개발 서버: yarn dev
- 프로덕션 빌드: yarn build
- 프로덕션 실행: yarn start
- 린트: yarn lint

## 커스터마이징 가이드

### 새 파티클 추가

1. 이미지를 public/img/particle에 추가
2. app/page.tsx의 PARTICLE_PRESETS에 항목 추가
3. 필요 시 개수/크기/속도 파라미터 조정

### 새 프레임 추가

1. 이미지를 public/img/frame에 추가
2. 카메라 프레임 URL/선택 로직 확장
3. 공유 컷아웃용 FrameCropProfile 추가

### 배경 교체

1. 파일을 public/img/background에 추가
2. app/view-photo/page.tsx, app/share-face/page.tsx의 BG_URL 변경

## 주의사항

- 현재 components/reset-storage-on-load.tsx는 앱 진입 시 clearPhotos, clearSharedFaces를 실행합니다.
	- 개발 단계에서 테스트 데이터 초기화를 위해 넣은 동작입니다.
	- 운영 환경에서는 제거 또는 환경 분기 처리 권장
- 카메라 권한이 거부되면 촬영 화면이 동작하지 않습니다.

## 트러블슈팅

- 카메라가 안 뜰 때
	- 브라우저 카메라 권한 확인
	- https 또는 localhost 환경 확인
- 얼굴 프레임이 느리거나 튈 때
	- 조명 밝기 확보
	- 얼굴이 화면 중앙에 오도록 조정
	- 저사양 기기에서는 감지 주기 및 오버레이 수를 줄여 최적화
- 저장이 실패할 때
	- localStorage/IndexedDB 사용 가능 여부 확인
	- 브라우저 저장 용량(Quota) 확인

## 라이선스

별도 라이선스 정책이 필요하면 저장소 정책에 맞춰 추가하세요.

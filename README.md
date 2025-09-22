# CPX1 - CPX 시험 시스템

CPX(Clinical Performance Examination) 시험을 위한 웹 기반 시스템입니다.

## 기능

### 시험 화면
- 12분 타이머
- 49개 증례 선택 (카테고리별 분류)
- 공통 체크리스트: O L D Co Ex C A F E 외 과 약 사 가 여
- 증례별 체크리스트:
  - 문진 체크리스트 (한 줄에 하나씩)
  - P/E 체크리스트 (버튼 형식)
- 감별진단 및 Plan 표시

### 관리 화면
- 증례별 체크리스트 항목 추가/삭제
- 문진, P/E, 감별진단, Plan 관리
- 실시간 저장

### 통계 화면
- 체크리스트 항목 통계
- 연습한 증례 통계
- 시간대별 연습 패턴
- CSV/JSON 내보내기

## 설치 및 실행

1. 의존성 설치
```bash
npm install
```

2. 서버 실행
```bash
npm start
```

3. 브라우저에서 접속
- 시험: http://localhost:3001
- 관리: http://localhost:3001/admin
- 통계: http://localhost:3001/stats

## 파일 구조

```
CPX1/
├── data/
│   ├── cases.json          # 증례 데이터
│   ├── checklists.json     # 체크리스트 데이터
│   └── sessions.json       # 연습 세션 데이터
├── css/
│   └── style.css           # 스타일시트
├── js/
│   ├── app.js              # 시험 화면 로직
│   ├── admin.js            # 관리 화면 로직
│   └── stats.js            # 통계 화면 로직
├── index.html              # 시험 화면
├── admin.html              # 관리 화면
├── stats.html              # 통계 화면
├── server.js               # 서버
└── package.json            # 패키지 설정
```

## 사용법

### 시험 화면
1. 증례를 선택합니다
2. 타이머를 시작합니다
3. 공통 체크리스트와 증례별 체크리스트를 체크합니다
4. 감별진단과 Plan을 참고합니다
5. 종료 버튼을 눌러 세션을 저장합니다

### 관리 화면
1. "체크리스트 관리" 탭을 선택합니다
2. 증례를 클릭하여 선택합니다
3. 각 섹션에서 항목을 추가/삭제합니다
4. "저장" 버튼을 눌러 변경사항을 저장합니다

### 통계 화면
1. 연습 기록을 확인합니다
2. 체크리스트 사용 통계를 봅니다
3. 필요시 데이터를 내보냅니다

## 키보드 단축키

- **스페이스바**: 타이머 시작/일시정지
- **R**: 타이머 리셋

## 기술 스택

- Frontend: HTML5, CSS3, JavaScript (ES6+)
- Backend: Node.js, Express.js
- Charts: Chart.js
- Data: JSON 파일 기반

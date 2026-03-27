# Chrome 확장프로그램 팀 테스트 가이드

## 목적
`DefectFlow Reporter` 확장프로그램 MVP를 팀원이 `압축해제된 확장 프로그램` 방식으로 설치해 캡처 흐름을 검증합니다.

## 확장 위치
- `extension/defectflow-reporter`

## 설치 방법
1. `chrome://extensions` 로 이동합니다.
2. 우측 상단 `개발자 모드`를 켭니다.
3. `압축해제된 확장 프로그램을 로드`를 클릭합니다.
4. 아래 폴더를 선택합니다.
   - `D:\Workspace\defect_manage\extension\defectflow-reporter`

## 사용 방법
1. 결함이 있는 대상 웹페이지를 엽니다.
2. Chrome 툴바에서 `DefectFlow Reporter` 확장 아이콘을 클릭합니다.
3. 현재 페이지 위에 뜨는 `https://mohenz.github.io/defect_manage/?mode=standalone#register` 오버레이를 확인합니다.
4. 아래 항목을 점검합니다.
   - 캡처 이미지가 전달되는지
   - 현재 페이지 URL이 전달되는지
   - 신규 결함 등록이 정상 저장되는지

## 점검 포인트
- 이미지가 이전 `html2canvas` 방식보다 정상적으로 보이는지
- 외부 자산이 많은 페이지에서도 캡처가 안정적인지
- 팀원이 추가 권한 팝업 없이 한 번의 확장 아이콘 클릭으로 사용할 수 있는지

## 현재 구조
- 캡처: `chrome.tabs.captureVisibleTab()`
- 전달: `chrome.runtime.sendMessage()` + iframe `window.postMessage()`
- 등록 화면: 기존 standalone 등록 흐름을 오버레이 iframe으로 재사용

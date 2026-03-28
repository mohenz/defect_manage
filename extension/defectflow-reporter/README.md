# DefectFlow Reporter Extension MVP

Chrome `압축해제된 확장 프로그램` 방식으로 팀 단위 테스트할 수 있는 MVP입니다.

## 용도
- 현재 보이는 탭을 캡처합니다.
- 캡처 후 `DefectFlow`의 `?mode=standalone#register` 화면을 현재 페이지 위 오버레이로 엽니다.
- 등록 화면에는 캡처 이미지와 현재 페이지 URL이 자동으로 전달됩니다.

## 설치
1. `chrome://extensions` 이동
2. `개발자 모드` 켜기
3. `압축해제된 확장 프로그램을 로드` 클릭
4. 이 폴더 선택
   - `D:\Workspace\defect_manage\extension\defectflow-reporter`

## 테스트 방법
1. 결함이 있는 웹페이지를 엽니다.
2. Chrome 우측 상단에서 `DefectFlow Reporter` 확장 아이콘을 클릭합니다.
3. 현재 페이지 위에 열린 `DefectFlow` 등록 오버레이에서 캡처 이미지와 URL 전달 여부를 확인합니다.

## 현재 범위
- 내부 팀 테스트용 MVP
- Chrome 툴바 아이콘 클릭 후 현재 페이지 위 오버레이 실행 방식
- GitHub Pages 등록 화면 연동
- PC 버전과 형태를 맞춘 bug 모티프의 전용 extension 아이콘 포함

## 제한 사항
- `chrome://`, `edge://`, PDF 뷰어 등 일부 특수 페이지는 캡처하지 않습니다.
- 정식 스토어 배포나 사내 강제 배포는 아직 포함하지 않습니다.

## 아이콘 반영
- `manifest.json`에 extension 아이콘이 연결되어 있습니다.
- unpacked extension을 이미 로드한 상태라면 `chrome://extensions`에서 `새로고침` 후 변경된 아이콘이 보입니다.

# 🐛 DefectFlow - 결함 관리 시스템

**Version**: 2.0.0  
**Focus**: 데이터 동기화 및 결함 관리 워크플로우

DefectFlow는 웹 기반의 결함 관리 도구로, Supabase 백엔드를 사용하여 데이터를 관리합니다.

## 📁 기술 스택
- **프론트엔드**: HTML, JavaScript (Vanilla), CSS
- **백엔드**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Storage)
- **암호화**: `bcryptjs` (비밀번호 해싱)
- **추가 라이브러리**: `html2canvas` (화면 캡처)

## 🛡 보안 및 인증
- **로그인 서비스**: 사용자 인증 후 시스템 접근 가능.
- **비밀번호 관리**: 클라이언트 사이드 해싱 후 전송 및 저장.
- **권한 관리**: 사용자 역할(테스터, 조치자, 관리자)에 따른 메뉴 접근 제한.

## 🚀 주요 기능
- **대시보드**: 결함 상태별 통계 및 현황 차트 표시.
- **결함 관리**: 검색, 필터링, 상세 정보 조회 및 수정.
- **테스트 벤치 연동**: 외부 사이트 연동 위젯을 통한 결함 등록 및 화면 캡처 자동화.
- **이미지 저장**: 결함 스크린샷의 Supabase Storage 업로드 및 보관.
- **시간대 설정**: 한국 표준시(KST) 기준 데이터 처리.

---
*Created and maintained by Antigravity AI Assistant.*

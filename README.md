# 🐛 DefectFlow - Defect Management System

**Version**: 2.0.0  
**Focus**: Data Synchronization and Defect Management Workflow

DefectFlow is a web-based defect management tool that uses Supabase for data management.

## Documentation
- Korean overview: [docs/README_ko.md](./docs/README_ko.md)
- Technical docs index: [docs/README.md](./docs/README.md)
- Workspace setup guide: [docs/workspace_setup_guide.md](./docs/workspace_setup_guide.md)
- Chrome extension team test guide: [docs/chrome_extension_test_guide.md](./docs/chrome_extension_test_guide.md)

## 📁 Tech Stack
- **Frontend**: HTML, JavaScript (Vanilla), CSS
- **Backend**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Encryption**: `bcryptjs` (Password hashing)
- **Additional Libraries**: `html2canvas` (Screen capture)

## 🛡 Security & Authentication
- **Login Service**: Authentication required for system access.
- **Password Management**: Client-side hashing used for transmission and storage.
- **Role Management**: Access control based on user roles (Tester, Actioner, Admin).

## 🚀 Key Features
- **Dashboard**: Displays defect statistics and status charts.
- **Defect Management**: Search, filter, view details, and edit defect reports.
- **Test Bench Integration**: External site widget for defect registration and automated screen capture.
- **Chrome Extension MVP**: Team-testable unpacked extension for visible-tab capture and in-page overlay registration.
- **Image Storage**: Existing screenshots may use legacy URLs, and new screenshots are stored inline in `defects.screenshot`.

---
*Created and maintained by Antigravity AI Assistant.*

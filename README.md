# 🐛 DefectFlow - Premium Defect Management System

**Version**: 2.0.0 (Cloud Native)  
**Focus**: Security, Real-time Data Sync, and Enterprise Workflow

DefectFlow is a high-performance, premium defect management system designed for professional QA teams. It combines the simplicity of a Single Page Application (SPA) with the power of Supabase cloud backend.

## 📁 Architecture & Tech Stack
- **Frontend**: Single Page Application (HTML5, Vanilla JS, Premium CSS3)
- **Backend (BaaS)**: [Supabase](https://supabase.com/) (Authentication, PostgreSQL, Storage)
- **Encryption**: Client-side BCrypt (via `bcryptjs`) for enterprise-grade security.
- **Integration**: Real-time screen capture widget using `html2canvas`.

## 🛡 Security & Authentication
- **Secure Login**: Mandatory authentication for all views.
- **Password Protection**: Passwords are never stored or transmitted in plain text.
- **Session Management**: Persistent sessions via LocalStorage with auto-redirect back to intended pages.
- **Role-Based Access**: Specialized views for Testers, Actioners, and Administrators.

## 🚀 Key Features
- **Smart Dashboard**: Insightful charts and real-time statistics of defect status.
- **Test Bench Integration**: A dedicated sandbox mall for defect reproduction and one-click reporting.
- **Storage Sync**: Defect screenshots are automatically uploaded to Supabase Storage for durability.
- **KST Support**: All timestamps are automatically handled in Korean Standard Time (UTC+9).

## 🛠 Project Standards (Smart Working)
1. **Deep Impact Analysis**: Every modification is validated against global project side-effects.
2. **Proactive Debugging**: Potential library or environment errors are identified and fixed preemptively.
3. **'First-Time-Right'**: We aim for perfect results on the first deployment, respect for the user's time.

---
*Created and maintained by Antigravity AI Assistant.*

# 🐛 Defect Management Program MVP
**Project Name**: DefectFlow MVP  
**Version**: 1.0.0  
**Focus**: Security, Premium UX, and Core Logic Validation

## 📁 Directory Structure
- `database/`: SQL Schema and data definition.
- `public/`: Frontend assets (HTML, Modern CSS, JS SPA).
- `server.js`: Node.js Express server with security middleware.
- `data/`: JSON-based persistent storage (for MVP simplicity).

## 🛡 Security Implementation
- **XSS Prevention**: Frontend/Backend input sanitization.
- **Input Validation**: Strict regex-based validation for all fields.
- **SQLi Protection**: Use of parameterized logic (prepared for future SQL migration).

## 🚀 How to Run
1. `npm install`
2. `node server.js`
3. Open `http://localhost:3000`

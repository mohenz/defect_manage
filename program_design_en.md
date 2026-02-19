# 📋 DefectFlow Design Document (Defect Management Program Design)

**Last Updated: 2026-02-19**  
**Author/Reviewer: Antigravity AI Assistant**

---

## 1. Overview and Purpose
The purpose of this document is to standardize data structures and screen designs to manage the lifecycle of defects and enable developers to efficiently reproduce and resolve them. It has been advanced with **Secure Login**, **Supabase Real-time Data Sync**, and **Test Bench Widget** capabilities.

---

## 2. Standard Defect Management Process (Lifecycle)
Defects follow the standard workflow below from registration to closure.

1.  **New**: Initial state when a defect is registered (immediately after registration).
2.  **Open**: Person in charge (Assignee) is assigned and action is decided.
3.  **In Progress**: Defect correction and root cause analysis are underway.
4.  **Resolved**: Developer has completed the action and requested verification.
5.  **Verified**: QA/Reporter has confirmed the action and verified normal operation.
6.  **Closed**: All actions and verifications are completed, and the defect is closed.
7.  **Reopened**: State where action is requested again upon verification failure.

---

## 3. Database Structure (PostgreSQL/Supabase)

### 3.1 Defect Information Table (defects)

| Column Name | Type | Description | Remarks |
|:---|:---|:---|:---|
| **defect_id** | BIGINT (PK) | Unique Defect ID | Timestamp-based |
| **title** | VARCHAR(200)| Defect Title | Min 5 characters required |
| **test_type** | VARCHAR(50) | Test Type | Unit, Integration, User Test, etc. |
| **severity** | VARCHAR(20) | **Severity** | Critical, Major, Minor, Simple |
| **priority** | VARCHAR(10) | **Priority** | P1 (Urgent), P2, P3, P4 |
| **status** | VARCHAR(20) | Defect Status | New ~ Closed |
| **steps_to_repro** | TEXT | **Steps to Reproduce** | Sequential path to occurrence |
| **menu_name** | VARCHAR(100)| Menu Name | Page Category (L/M) |
| **screen_name** | VARCHAR(100)| Screen Name | Physical screen name |
| **screen_url** | TEXT | Source Screen URL | Actual browser address |
| **screenshot** | TEXT | **Screen Capture** | Supabase Storage Public URL |
| **env_info** | TEXT | **Environment Info** | OS, Browser, etc. |
| **creator** | VARCHAR(50) | Creator | User name link |
| **assignee** | VARCHAR(50) | Assignee | Actioner name link |
| **action_comment** | TEXT | Resolution Comment | Root cause and action analysis |
| **action_start** | DATE | Action Start Date | |
| **action_end** | DATE | Action Completion Date | |
| **created_at** | TIMESTAMPTZ | Registration Timestamp | |
| **updated_at** | TIMESTAMPTZ | Last Update Timestamp | |

### 3.2 User Management Table (users)

| Column Name | Type | Description | Remarks |
|:---|:---|:---|:---|
| **user_id** | BIGINT (PK) | Management Number | Timestamp-based |
| **email** | VARCHAR(100)| Email (UNIQUE) | Login ID and notification |
| **password** | VARCHAR(255)| Password | BCrypt hashed storage |
| **name** | VARCHAR(50) | Full Name | UI display name |
| **department** | VARCHAR(50) | Department | QA Team, Dev Team, etc. |
| **role** | VARCHAR(20) | Role | Tester, Actioner, Admin |
| **status** | VARCHAR(10) | Status | Active / Inactive |
| **needs_pw_reset**| BOOLEAN | Pwd Reset Flag | TRUE for new/reset accounts |
| **created_at** | TIMESTAMPTZ | Registration Date | |
| **updated_at** | TIMESTAMPTZ | Last Modification | |

---

## 4. UI/UX and Security Design Guide

### 4.1 Authentication and Role Management
- **BCrypt Encryption**: All user passwords are hashed and transmitted from the client side.
- **Role-Based Access Control (RBAC)**: Only 'Admin' users can access settings and user management menus.
- **Redirect Protection**: Unauthenticated users are redirected to the login page and restored to their previous page after login.

### 4.2 External Integration (Test Bench)
- **Standalone Mode**: Supports a special mode that removes the sidebar and provides only the defect registration form in full size.
- **Real-time Capture**: Automatically converts the screen state at the moment the widget is clicked into data using `html2canvas`.

---

## 5. 🧠 USER Requirements (Smart Working Principles)
All development for this project must comply with the three core requirements defined by the user:

1.  **Deep Impact Analysis**: Protect existing functions by analyzing global side effects before modification.
2.  **Proactive Problem Response**: Identify potential errors in advance and preemptively apply reinforcement codes.
3.  **'First-Time-Right'**: Avoid repeated corrections and achieve perfect results with a single deployment.

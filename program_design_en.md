# 📋 DefectFlow Design Document (Defect Management Program Design)

**Last Updated: 2026-02-10**  
**Author/Reviewer: Antigravity AI Assistant**

---

## 1. Overview and Purpose
The purpose of this document is to standardize data structures and screen designs to manage the lifecycle of defects and enable developers to efficiently reproduce and resolve them. It focuses on **'Increasing Reproducibility'** and **'Systematizing Action Priorities'** beyond simple recording.

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

## 3. Database Structure (Advanced Schema)

### 3.1 Defect Information Table (defects)

| Column Name | Type | Description | Remarks |
|:---|:---|:---|:---|
| **defect_id** | BIGINT (PK) | Unique Defect Number | Timestamp-based |
| **title** | VARCHAR(200)| Defect Title | Write clearly and concisely |
| **defect_type** | VARCHAR(20) | Defect Type | Functional Error, UI/UX, Performance, etc. |
| **severity** | VARCHAR(10) | **Severity** | Critical, Major, Minor, Simple |
| **priority** | VARCHAR(10) | **Priority** | P1 (Urgent), P2, P3, P4 |
| **status** | VARCHAR(20) | Defect Status | New ~ Closed |
| **env_info** | VARCHAR(500)| **Test Environment** | OS, Browser version, etc. (Auto-collected) |
| **steps_to_repro** | TEXT | **Steps to Reproduce** | Sequential path to defect occurrence |
| **expected_result** | TEXT | **Expected Result** | Normal operation scenario |
| **actual_result** | TEXT | **Actual Result** | Error phenomenon |
| **screenshot** | LONGTEXT | **Screen Capture** | Base64 image data |
| **screen_url** | VARCHAR(500)| Source Screen URL | Actual browser address |
| **menu_name** | VARCHAR(200)| Menu Name | Page Category (Large/Medium) |
| **screen_name** | VARCHAR(200)| Screen Name | Physical screen name |
| **action_comment** | TEXT | Resolution Comment | Cause analysis and action results |
| **creator** | VARCHAR(50) | Creator | Linked to user table |
| **assignee** | VARCHAR(50) | Assignee | Linked to user table |
| **action_start** | DATETIME | Action Start Date | |
| **action_end** | DATETIME | Action Completion Date | |
| **created_at** | DATETIME | Registration Timestamp | |
| **updated_at** | DATETIME | Last Update Timestamp | |

### 3.2 Defect Management Personnel Table (users)

| Column Name | Type | Description | Remarks |
|:---|:---|:---|:---|
| **user_id** | BIGINT (PK) | Management Number | Timestamp-based |
| **role** | VARCHAR(20) | Role | Tester, Developer, Actioner, Admin |
| **department** | VARCHAR(50) | Department | QA Team, Development Team 1, etc. |
| **name** | VARCHAR(50) | Name | Avoid duplicates |
| **email** | VARCHAR(100)| Email | Alert only |
| **status** | VARCHAR(10) | Status | Active, Inactive |
| **created_at** | DATETIME | Creation Date | |
| **updated_at** | DATETIME | Modification Date | |

---

## 4. UI/UX Design Guide

### 4.1 Registration and Edit Screen (Form)
- **Information Grouping**: Ensure readability by dividing basic information, detailed information, and reproduction information into sections.
- **Image Preview**: Allow immediate confirmation of captured images and provide an image viewer (enlarge popup) upon clicking.
- **Assignee Auto-mapping**: Support dropdown selection based on registered `users` data.

### 4.2 List and Dashboard (View)
- **Highlight Key Metrics**: Place total count, in-progress, completed, and critical defect counts on the top dashboard.
- **Ensure Visibility**: Differentiate Badge designs by severity and status to emphasize priority.

---

## 5. Core Compliance Requirements
1.  **Clarify Reproduction Steps**: If `steps_to_repro` is unclear, the defect may be judged as "unable to resolve."
2.  **Data Separation**: Clearly separate and store actual browser address (`screen_url`) and capture image (`screenshot`) data.
3.  **Environment Automation**: Automatically collect Browser UserAgent information to reduce manual input from testers.

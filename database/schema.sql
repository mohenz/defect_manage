-- Defect Management Table Schema
-- Target: SQLite/PostgreSQL/MySQL

CREATE TABLE IF NOT EXISTS defects (
    defect_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    defect_type VARCHAR(20) NOT NULL,
    severity VARCHAR(10) DEFAULT 'Minor',
    priority VARCHAR(10) DEFAULT 'P3',
    status VARCHAR(20) DEFAULT 'New',
    env_info VARCHAR(255),
    steps_to_repro TEXT,
    expected_result TEXT,
    actual_result TEXT,
    screenshot_url VARCHAR(255),
    screen_url VARCHAR(255),
    menu_name VARCHAR(200),
    screen_name VARCHAR(200),
    action_comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    creator VARCHAR(50),
    assignee VARCHAR(50),
    action_start DATETIME,
    action_end DATETIME
);

-- Indices for faster lookup
CREATE INDEX idx_defects_status ON defects(status);
CREATE INDEX idx_defects_priority ON defects(priority);
CREATE INDEX idx_defects_assignee ON defects(assignee);

const StorageService = {
    KEYS: {
        DEFECTS: 'defectflow_defects',
        USERS: 'defectflow_users'
    },

    init() {
        if (!localStorage.getItem(this.KEYS.DEFECTS)) {
            const initialDefects = [
                {
                    "defect_id": 1,
                    "test_type": "단위테스트",
                    "title": "[Security] User login validation bypass",
                    "severity": "Critical",
                    "priority": "P1",
                    "status": "Resolved",
                    "env_info": "Chrome / Windows 11",
                    "steps_to_repro": "1. Go to login page\n2. Click login button",
                    "screen_url": "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?auto=format&fit=crop&q=80&w=800",
                    "menu_name": "Login",
                    "screen_name": "Main",
                    "action_comment": "Login logic has been refactored.",
                    "creator": "홍길동",
                    "assignee": "박지성",
                    "created_at": "2026-02-09T10:00:00.000Z",
                    "updated_at": "2026-02-10T10:20:00.000Z",
                    "action_start": "2026-02-10",
                    "action_end": "2026-02-11"
                },
                {
                    "defect_id": 2,
                    "test_type": "단위테스트",
                    "title": "[UI] Dashboard chart resize issue",
                    "severity": "Major",
                    "priority": "P2",
                    "status": "In Progress",
                    "env_info": "Firefox / macOS",
                    "steps_to_repro": "1. Open dashboard\n2. Resize window\n3. Check charts",
                    "screen_url": "https://images.unsplash.com/photo-1551288049-bbbda536ad37?auto=format&fit=crop&q=80&w=800",
                    "menu_name": "Analytics",
                    "screen_name": "Dashboard",
                    "creator": "이영희",
                    "assignee": "손흥민",
                    "created_at": "2026-02-09T11:30:00.000Z",
                    "updated_at": "2026-02-10T10:20:00.000Z"
                }
            ];
            localStorage.setItem(this.KEYS.DEFECTS, JSON.stringify(initialDefects));
        }

        if (!localStorage.getItem(this.KEYS.USERS)) {
            const initialUsers = [
                { "user_id": 1, "role": "관리자", "department": "IT운영실", "name": "홍길동", "email": "gildong.hong@example.com", "status": "사용", "created_at": new Date().toISOString() },
                { "user_id": 2, "role": "테스터", "department": "QA팀", "name": "이영희", "email": "younghee.lee@example.com", "status": "사용", "created_at": new Date().toISOString() },
                { "user_id": 3, "role": "조치자", "department": "플랫폼개발팀", "name": "박지성", "email": "js.park@example.com", "status": "사용", "created_at": new Date().toISOString() },
                { "user_id": 4, "role": "조치자", "department": "모바일개발팀", "name": "손흥민", "email": "hm.son@example.com", "status": "사용", "created_at": new Date().toISOString() }
            ];
            localStorage.setItem(this.KEYS.USERS, JSON.stringify(initialUsers));
        }
    },

    getDefects() {
        return JSON.parse(localStorage.getItem(this.KEYS.DEFECTS) || '[]');
    },

    saveDefect(payload, id = null) {
        let defects = this.getDefects();
        if (id) {
            const index = defects.findIndex(d => d.defect_id === id);
            if (index !== -1) {
                defects[index] = { ...defects[index], ...payload, updated_at: new Date().toISOString() };
            }
        } else {
            const newDefect = {
                defect_id: Date.now(),
                ...payload,
                status: payload.status || 'New',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            defects.unshift(newDefect);
        }
        localStorage.setItem(this.KEYS.DEFECTS, JSON.stringify(defects));
        return true;
    },

    deleteDefect(id) {
        let defects = this.getDefects();
        defects = defects.filter(d => d.defect_id !== id);
        localStorage.setItem(this.KEYS.DEFECTS, JSON.stringify(defects));
        return true;
    },

    getUsers() {
        return JSON.parse(localStorage.getItem(this.KEYS.USERS) || '[]');
    },

    saveUser(payload, id = null) {
        let users = this.getUsers();
        if (id) {
            const index = users.findIndex(u => u.user_id === id);
            if (index !== -1) {
                users[index] = { ...users[index], ...payload, updated_at: new Date().toISOString() };
            }
        } else {
            const newUser = {
                user_id: Date.now(),
                ...payload,
                status: payload.status || '사용',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            users.push(newUser);
        }
        localStorage.setItem(this.KEYS.USERS, JSON.stringify(users));
        return true;
    },

    deleteUser(id) {
        let users = this.getUsers();
        users = users.filter(u => u.user_id !== id);
        localStorage.setItem(this.KEYS.USERS, JSON.stringify(users));
        return true;
    }
};

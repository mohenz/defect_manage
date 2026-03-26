/**
 * DefectFlow Core Application Logic
 */

const bcrypt = typeof dcodeIO !== 'undefined' ? dcodeIO.bcrypt : null;

window.App = {
    // --- Utils ---
    pct(val, total) {
        return total > 0 ? Math.round(val / total * 100) : 0;
    },

    // --- Common Codes Helpers ---
    getCodesByGroup(group) {
        if (!this.state.commonCodes) return [];
        return this.state.commonCodes.filter(c => c.group_code === group);
    },

    getCodeName(group, value) {
        const codes = this.getCodesByGroup(group);
        const code = codes.find(c => c.code_value === value);
        return code ? code.code_name : value;
    },

    getCodeColor(group, value) {
        const codes = this.getCodesByGroup(group);
        const code = codes.find(c => c.code_value === value);
        return code ? code.color : null;
    },

    getEnabledTestTypes() {
        return this.state.settings?.enabledTestTypes || [];
    },

    isTestTypeEnabled(testType) {
        const normalizedType = testType || '단위테스트';
        const enabledTypes = this.getEnabledTestTypes();
        return enabledTypes.length === 0 || enabledTypes.includes(normalizedType);
    },

    getVisibleTestTypeCodes(selectedValue = '') {
        const enabledTypes = this.getEnabledTestTypes();
        const codes = this.getCodesByGroup('TEST_TYPE');

        if (enabledTypes.length === 0) {
            return codes;
        }

        const filteredCodes = codes.filter(c => enabledTypes.includes(c.code_value));

        if (selectedValue && !filteredCodes.some(c => c.code_value === selectedValue)) {
            const selectedCode = codes.find(c => c.code_value === selectedValue);
            if (selectedCode) {
                return [...filteredCodes, selectedCode];
            }
        }

        return filteredCodes;
    },

    getUserStatusOptions(selectedValue = '') {
        const defaults = [
            { code_value: '사용', code_name: '사용' },
            { code_value: '미사용', code_name: '미사용' }
        ];

        if (selectedValue && !defaults.some(option => option.code_value === selectedValue)) {
            return [...defaults, { code_value: selectedValue, code_name: selectedValue }];
        }

        return defaults;
    },

    isUserActive(status) {
        return status === '사용';
    },

    state: {
        currentView: 'dashboard',
        defects: [],
        allDefectsSummary: [],
        users: [],
        stats: { total: 0, open: 0, resolved: 0, critical: 0 },
        initialRouteHandled: false,
        currentModal: null, // 'register', 'edit', 'action'
        isStandalone: false,
        isLoggedIn: false,
        currentUser: null,
        currentRole: '테스터', // '테스터', '조치자', '관리자'
        listConfig: {
            page: 1,
            pageSize: 20,
            search: {
                severity: '',
                status: '',
                title: '',
                stepsToRepro: '',
                creator: '',
                assignee: '',
                testType: '',
                dateStart: '',
                dateEnd: '',
                identification: ''
            }
        },
        settings: {
            enabledTestTypes: ['선오픈', '통합테스트', '3자테스트(I&C)', '3자테스트(W2)', '단위테스트']
        },
        pendingDefectData: null, // Stores data received via postMessage for cross-domain support
        selectedDefect: null,
        commonCodes: [],
        settingsTab: 'test-types'
    },
    async init() {
        console.log("[App] 1. Initializing...");
        try {
            console.log("[App] 2. StorageService Init..."); StorageService.init();
            this.initializeRuntimeContext();
            this.bindEvents();
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                this.state.currentUser = JSON.parse(savedUser);
                this.state.isLoggedIn = true;
                this.state.currentRole = this.state.currentUser.role;
                document.body.classList.add('logged-in');
            }

            // Load Common Codes
            try {
                console.log("[App] 3. Fetching Common Codes..."); this.state.commonCodes = await StorageService.fetchCommonCodes(); console.log("[App] 4. Common Codes Loaded:", this.state.commonCodes.length);
            } catch (err) {
                console.error("[App] Common codes load failed:", err);
            }

            await this.loadSettings();

            console.log("[App] 5. Starting FetchData..."); await this.fetchData(); console.log("[App] 6. Init Finished.");
        } catch (err) {
            console.error("[App] Init failed:", err);
        }
    },

    initializeRuntimeContext() {
        const params = new URLSearchParams(window.location.search);
        this.state.isStandalone = params.get('mode') === 'standalone';

        if (this.state.isStandalone) {
            document.body.classList.add('standalone-mode');
            const requestedView = window.location.hash.substring(1) || 'register';
            this.state.returnTo = requestedView;

            if (window.opener) {
                window.opener.postMessage({ type: 'DEFECTFLOW_READY' }, '*');
            }
        }
    },

    async loadSettings() {
        const localSettings = localStorage.getItem('app_settings');
        if (localSettings) {
            try {
                this.state.settings = { ...this.state.settings, ...JSON.parse(localSettings) };
            } catch (err) {
                console.error('[App] Failed to parse local app settings:', err);
            }
        }

        try {
            const globalSettings = await StorageService.getAppSettings();
            if (globalSettings) {
                this.state.settings = { ...this.state.settings, ...globalSettings };
                localStorage.setItem('app_settings', JSON.stringify(this.state.settings));
            }
        } catch (err) {
            console.error('[App] Failed to load global app settings:', err);
        }

        if (this.state.listConfig.search.testType && !this.isTestTypeEnabled(this.state.listConfig.search.testType)) {
            this.state.listConfig.search.testType = '';
        }
    },

    async fetchData() { console.log("[App] [fetchData] Starting...");
        console.log("[App] Fetching data...");
        try {
            console.log("[App] [fetchData] 1. Fetching Stats Summary..."); this.state.allDefectsSummary = await StorageService.getDefectsSummaryForStats() || []; console.log("[App] [fetchData] 2. Stats Summary Loaded.");
            const result = await StorageService.getDefects(this.state.listConfig.page, this.state.listConfig.pageSize, {
                ...this.state.listConfig.search,
                enabledTestTypes: this.getEnabledTestTypes()
            });
            this.state.defects = result.data;
            this.state.totalDefectCount = result.totalCount;
            this.state.users = await StorageService.getUsers() || [];
            
            this.getFilteredDefects(); // Updates stats
            console.log("[App] [fetchData] 5. Rendering Screen..."); this.render();
            
            if (!this.state.initialRouteHandled) {
                const hash = window.location.hash.substring(1) || 'dashboard';
                this.navigate(hash);
                this.state.initialRouteHandled = true;
            }
        } catch (err) {
            console.error("[App] FetchData failed:", err);
        }
    },

    bindEvents() {
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.substring(1) || 'dashboard';
            if (this.state.currentView !== hash) {
                this.navigate(hash);
            }
        });

        window.addEventListener('message', (event) => {
            if (!event.data || event.data.type !== 'DEFECTFLOW_DATA') return;

            this.state.pendingDefectData = event.data.data || null;
            console.log("[App] Received defect data via postMessage. Screenshot status:", !!this.state.pendingDefectData?.screenshot);

            if (this.state.isLoggedIn) {
                this.showRegisterModal();
            }
        });

        document.addEventListener('click', (event) => {
            const navItem = event.target.closest('.nav-item');
            if (!navItem) return;

            const view = navItem.dataset.view;
            if (!view) return;

            event.preventDefault();
            this.navigate(view);
        });
    },


    getFilteredDefects() {
        const d = (this.state.allDefectsSummary || []).filter(d => this.isTestTypeEnabled(d.test_type));

        this.state.stats = {
            total: d.length,
            open: d.filter(x => ['Open', 'In Progress', 'Reopened'].includes(x.status)).length,
            resolved: d.filter(x => ['Resolved', 'Staging', 'Closed'].includes(x.status)).length,
            critical: d.filter(x => x.severity === 'Critical').length
        };
    },

    navigate(view) {
        if (!view) view = 'dashboard';

        // Authentication Guard
        // Standalone 모드의 결함 등록(#register)은 로그인 없이 허용
        const isAuthView = ['login', 'signup', 'password-reset'].includes(view);

        if (!this.state.isLoggedIn && !isAuthView) {
            this.state.returnTo = view;
            this.state.currentView = 'login';
            console.log("[App] [fetchData] 5. Rendering Screen..."); this.render();
            return;
        }

        if (view === 'register') {
            // 외부 연동(Test Bench)인 경우 데이터를 유지하고, 일반 메뉴 클릭 시에만 초기화
            if (!this.state.isStandalone) {
                localStorage.removeItem('pending_defect');
            }
            this.showRegisterModal();
            return;
        }

        const operatorViews = ['assignee-status'];
        if (operatorViews.includes(view) && !['조치자', '관리자'].includes(this.state.currentRole)) {
            alert('조치자 또는 관리자 권한이 필요한 메뉴입니다.');
            this.navigate('dashboard');
            return;
        }

        // Admin view check
        const adminViews = ['users', 'settings'];
        if (adminViews.includes(view) && this.state.currentRole !== '관리자') {
            alert('관리자 권한이 필요한 메뉴입니다.');
            this.navigate('dashboard');
            return;
        }

        this.state.currentView = view;
        window.location.hash = view;

        if (this.state.isLoggedIn) {
            document.body.classList.add('logged-in');
        } else {
            document.body.classList.remove('logged-in');
        }

        document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
        const navItem = document.querySelector(`[data-view="${view}"]`);
        if (navItem) navItem.classList.add('active');
        console.log("[App] [fetchData] 5. Rendering Screen..."); this.render();
    },

    render() {
        const root = document.getElementById('app');
        root.innerHTML = '';

        // Sidebar Visibility Check
        this.updateSidebar();

        switch (this.state.currentView) {
            case 'dashboard': this.renderDashboard(root); break;
            case 'list': this.renderList(root); break;
            case 'assignee-status': this.renderAssigneeStatusScreen(root); break;
            case 'users': this.renderUsers(root); break;
            case 'settings': this.renderSettings(root); break;
            case 'login': this.renderLogin(root); break;
            case 'signup': this.renderSignup(root); break;
            case 'password-reset': this.renderPasswordReset(root); break;
        }
    },

    updateSidebar() {
        const loggedIn = this.state.isLoggedIn;
        const user = this.state.currentUser;

        // Operator Menus
        const operatorMenu = document.getElementById('operatorMenus');
        if (operatorMenu) {
            operatorMenu.style.display = (loggedIn && user && ['조치자', '관리자'].includes(user.role)) ? 'block' : 'none';
        }

        // Admin Menus
        const adminMenu = document.getElementById('adminOnlyMenus');
        if (adminMenu) {
            adminMenu.style.display = (loggedIn && user && user.role === '관리자') ? 'block' : 'none';
        }

        // Login/User Section
        const userSection = document.getElementById('userSection');
        const loginPrompt = document.getElementById('loginPrompt');

        if (loggedIn && user) {
            if (userSection) userSection.style.display = 'block';
            if (loginPrompt) loginPrompt.style.display = 'none';

            document.getElementById('userName').textContent = user.name;
            document.getElementById('userRole').textContent = user.role;
            document.getElementById('userAvatar').textContent = user.name.substring(0, 1);
        } else {
            if (userSection) userSection.style.display = 'none';
            if (loginPrompt) loginPrompt.style.display = 'block';
        }

        // Hide Sidebar entirely on Login/Signup/Reset pages or Standalone mode
        const nav = document.querySelector('nav');
        const isAuthPage = ['login', 'signup', 'password-reset'].includes(this.state.currentView);
        const shouldHideNav = isAuthPage || this.state.isStandalone;

        if (nav) nav.style.display = shouldHideNav ? 'none' : 'flex';
        document.getElementById('app').style.marginLeft = shouldHideNav ? '0' : '260px';
    },

    renderLogin(container) {
        container.innerHTML = `
            <div class="login-screen animate-in">
                <div class="login-card">
                    <div class="login-logo">
                        <i class="fas fa-bug"></i> Defect Manage
                    </div>
                    <h2>환영합니다</h2>
                    <p class="subtitle">시스템 접속을 위해 로그인해 주세요.</p>
                    
                    <form id="loginForm" style="margin-top: 2rem;">
                        <div class="form-group">
                            <label>이메일</label>
                            <input type="email" id="loginEmail" required placeholder="example@company.com">
                        </div>
                        <div class="form-group">
                            <label>비밀번호</label>
                            <input type="password" id="loginPassword" required placeholder="비밀번호를 입력하세요">
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 1.5rem; padding: 0.8rem;">로그인</button>
                    </form>
                    
                    <div style="margin-top: 1.5rem; font-size: 0.875rem; text-align: center; display: flex; flex-direction: column; gap: 0.5rem;">
                        <div>계정이 없으신가요? <a href="#" onclick="App.navigate('signup'); return false;" style="color: var(--accent); font-weight: 600;">회원가입</a></div>
                        <div>비밀번호를 잊으셨나요? <a href="#" onclick="App.navigate('password-reset'); return false;" style="color: var(--text-secondary); font-size: 0.8rem;">비밀번호 초기화</a></div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('loginForm').onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            try {
                const user = await StorageService.findUserByEmail(email);
                if (user) {
                    if (!this.isUserActive(user.status)) {
                        alert('비활성화된 계정입니다. 관리자에게 문의하세요.');
                        return;
                    }

                    // Check Password (Client-side)
                    const isMatch = bcrypt.compareSync(password, user.password);
                    if (isMatch) {
                        this.state.isLoggedIn = true;
                        this.state.currentUser = user;
                        this.state.currentRole = user.role;
                        localStorage.setItem('currentUser', JSON.stringify(user));

                        alert(`${user.name}님, 환영합니다!`);
                        const targetView = this.state.returnTo || 'dashboard';
                        this.state.returnTo = null; // Clear it
                        this.navigate(targetView);
                    } else {
                        alert('비밀번호가 일치하지 않습니다.');
                    }
                } else {
                    alert('등록되지 않은 이메일입니다.');
                }
            } catch (err) {
                console.error("Login error:", err);
                alert('로그인 중 오류가 발생했습니다.');
            }
        };
    },

    renderSignup(container) {
        container.innerHTML = `
            <div class="login-screen animate-in">
                <div class="login-card">
                    <div class="login-logo">
                        <i class="fas fa-user-plus"></i> 계정 생성
                    </div>
                    <h2>회원가입</h2>
                    <p class="subtitle">결함 시스템 사용을 위해 계정을 생성합니다.</p>
                    
                    <form id="signupForm" style="margin-top: 2rem;">
                        <div class="form-group">
                            <label>성함 (필수)</label>
                            <input type="text" id="signupName" required placeholder="홍길동">
                        </div>
                        <div class="form-group">
                            <label>이메일 (필수)</label>
                            <input type="email" id="signupEmail" required placeholder="example@company.com">
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label>소속 (필수)</label>
                                <input type="text" id="signupDept" required placeholder="예: QA팀">
                            </div>
                            <div class="form-group">
                                <label>역할 (필수)</label>
                                <select id="signupRole" required>
                                    <option value="테스터">테스터</option>
                                    <option value="조치자">조치자</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>비밀번호 (필수)</label>
                            <input type="password" id="signupPassword" required placeholder="6자 이상 입력">
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 1rem; padding: 0.8rem;">가입 완료</button>
                    </form>
                    
                    <div style="margin-top: 1.5rem; font-size: 0.875rem; text-align: center;">
                        이미 계정이 있으신가요? <a href="#" onclick="App.navigate('login'); return false;" style="color: var(--accent); font-weight: 600;">로그인</a>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('signupForm').onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const department = document.getElementById('signupDept').value;
            const role = document.getElementById('signupRole').value;
            const password = document.getElementById('signupPassword').value;

            if (password.length < 6) {
                alert('비밀번호는 6자 이상이어야 합니다.');
                return;
            }

            try {
                // Check if exists
                const existing = await StorageService.findUserByEmail(email);
                if (existing) {
                    alert('이미 등록된 이메일입니다.');
                    return;
                }

                // Hash Password
                const salt = bcrypt.genSaltSync(10);
                const hashedPassword = bcrypt.hashSync(password, salt);

                const success = await StorageService.saveUser({
                    name,
                    email,
                    department,
                    role,
                    password: hashedPassword,
                    status: '사용',
                    needs_password_reset: false
                });

                if (success) {
                    alert('회원가입이 완료되었습니다. 로그인해 주세요.');
                    this.navigate('login');
                }
            } catch (err) {
                console.error("Signup error:", err);
                alert('가입 중 오류가 발생했습니다.');
            }
        };
    },

    renderPasswordReset(container) {
        container.innerHTML = `
            <div class="login-screen animate-in">
                <div class="login-card">
                    <div class="login-logo">
                        <i class="fas fa-key"></i> 비밀번호 재설정
                    </div>
                    <h2>비밀번호 찾기</h2>
                    <p class="subtitle">등록된 이메일 주소를 입력해 주세요.</p>
                    
                    <form id="resetRequestForm" style="margin-top: 2rem;">
                        <div class="form-group">
                            <label>이메일</label>
                            <input type="email" id="resetEmail" required placeholder="example@company.com">
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 1.5rem; padding: 0.8rem;">다음</button>
                    </form>

                    <div id="resetPasswordStep" style="display: none; margin-top: 2rem;">
                        <hr style="border: 0; border-top: 1px solid var(--border); margin: 2rem 0;">
                        <h3 style="margin-bottom: 1rem;">새 비밀번호 설정</h3>
                        <form id="newPasswordForm">
                            <div class="form-group">
                                <label>새 비밀번호</label>
                                <input type="password" id="newPassword" required placeholder="6자 이상 입력">
                            </div>
                            <div class="form-group">
                                <label>비밀번호 확인</label>
                                <input type="password" id="confirmPassword" required placeholder="비밀번호를 다시 입력하세요">
                            </div>
                            <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 1.5rem; padding: 0.8rem;">비밀번호 변경</button>
                        </form>
                    </div>
                    
                    <div style="margin-top: 1.5rem; font-size: 0.875rem; text-align: center;">
                        생각나셨나요? <a href="#" onclick="App.navigate('login'); return false;" style="color: var(--accent); font-weight: 600;">로그인으로 돌아가기</a>
                    </div>
                </div>
            </div>
        `;

        let targetEmail = '';

        document.getElementById('resetRequestForm').onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('resetEmail').value;

            try {
                const user = await StorageService.findUserByEmail(email);
                if (user) {
                    targetEmail = email;
                    document.getElementById('resetEmail').disabled = true;
                    e.target.querySelector('button').style.display = 'none';
                    document.getElementById('resetPasswordStep').style.display = 'block';
                } else {
                    alert('등록되지 않은 이메일입니다.');
                }
            } catch (err) {
                alert('사용자 확인 중 오류가 발생했습니다.');
            }
        };

        document.getElementById('newPasswordForm').onsubmit = async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (newPassword.length < 6) {
                alert('비밀번호는 6자 이상이어야 합니다.');
                return;
            }

            if (newPassword !== confirmPassword) {
                alert('비밀번호가 일치하지 않습니다.');
                return;
            }

            try {
                const salt = bcrypt.genSaltSync(10);
                const hashedPassword = bcrypt.hashSync(newPassword, salt);

                const success = await StorageService.resetPassword(targetEmail, hashedPassword);
                if (success) {
                    alert('비밀번호가 성공적으로 변경되었습니다. 새로운 비밀번호로 로그인해 주세요.');
                    this.navigate('login');
                } else {
                    alert('비밀번호 변경에 실패했습니다.');
                }
            } catch (err) {
                console.error("Password reset error:", err);
                alert('비밀번호 변경 중 오류가 발생했습니다.');
            }
        };
    },

    handleLogout() {
        if (confirm('로그아웃 하시겠습니까?')) {
            this.state.isLoggedIn = false;
            this.state.currentUser = null;
            this.state.currentRole = '테스터';
            localStorage.removeItem('currentUser');
            // Clear hash and reload for a completely clean state
            window.location.hash = 'login';
            window.location.reload();
        }
    },

    renderUsers(container) {
        container.innerHTML = `
            <header class="animate-in">
                <div>
                    <h1>담당자 관리</h1>
                    <p class="subtitle">결함 등록 및 조치 담당자를 관리합니다.</p>
                </div>
                <button class="btn btn-primary" onclick="App.renderUserForm()"><i class="fas fa-user-plus"></i> 새 담당자 등록</button>
            </header>

            <div class="data-table-container animate-in">
                <table>
                    <thead>
                        <tr>
                            <th>관리번호</th>
                            <th>역할</th>
                            <th>소속</th>
                            <th>이름</th>
                            <th>이메일</th>
                            <th>상태</th>
                            <th>등록일</th>
                            <th>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.state.users.map(u => `
                            <tr>
                                <td>#${u.user_id}</td>
                                <td><span class="badge" style="background: var(--bg-secondary); color: var(--text-main); font-size: 0.75rem;">${u.role}</span></td>
                                <td>${this.sanitize(u.department)}</td>
                                <td><strong>${this.sanitize(u.name)}</strong></td>
                                <td>${this.sanitize(u.email)}</td>
                                <td><span class="badge" style="background: ${this.isUserActive(u.status) ? '#dcfce7' : '#fee2e2'}; color: ${this.isUserActive(u.status) ? '#166534' : '#991b1b'};">${u.status}</span></td>
                                <td>${this.formatDateKST(u.created_at)}</td>
                                <td>
                                    <div style="display:flex; gap:0.5rem;">
                                        <button class="btn" style="padding: 0.4rem; color: var(--accent)" onclick="App.renderUserForm(${u.user_id})"><i class="fas fa-edit"></i></button>
                                        <button class="btn" style="padding: 0.4rem; color: var(--error)" onclick="App.deleteUser(${u.user_id})"><i class="fas fa-trash"></i></button>
                                    </div>
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan="8" style="text-align: center; padding: 2rem;">데이터가 없습니다.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderUserForm(id = null) {
        const user = id ? this.state.users.find(u => u.user_id === id) : {};
        const title = id ? '담당자 정보 수정' : '신규 담당자 등록';

        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h1>${title}</h1>
                <p class="subtitle">담당자 정보를 정확히 입력해 주세요.</p>
            </div>
            <form id="userForm">
                <div class="form-group">
                    <label>역할</label>
                    <select name="role">
                        <option value="테스트" ${user.role === '테스트' ? 'selected' : ''}>테스트 (QA)</option>
                        <option value="테스터" ${user.role === '테스터' ? 'selected' : ''}>테스터</option>
                        <option value="조치자" ${user.role === '조치자' ? 'selected' : ''}>조치자 (Developer)</option>
                        <option value="관리자" ${user.role === '관리자' ? 'selected' : ''}>관리자 (Admin)</option>
                    </select>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div class="form-group">
                        <label>이름 (필수)</label>
                        <input type="text" name="name" value="${this.sanitize(user.name || '')}" required>
                    </div>
                    <div class="form-group">
                        <label>소속</label>
                        <input type="text" name="department" value="${this.sanitize(user.department || '')}">
                    </div>
                </div>
                <div class="form-group">
                    <label>이메일</label>
                    <input type="email" name="email" value="${this.sanitize(user.email || '')}" placeholder="example@company.com">
                </div>
                <div class="form-group">
                    <label>상태</label>
                    <select name="status">
                        ${this.getUserStatusOptions(user.status || '사용').map(option => `<option value="${option.code_value}" ${user.status === option.code_value ? 'selected' : ''}>${option.code_name}</option>`).join('')}
                    </select>
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 2.5rem;">
                    <button type="submit" class="btn btn-primary" style="flex: 1;">${id ? '저장하기' : '등록하기'}</button>
                    <button type="button" class="btn" style="flex: 1; background: var(--bg-secondary);" onclick="App.closeModal()">취소</button>
                </div>
            </form>
        `;

        this.openModal();
        document.getElementById('userForm').onsubmit = (e) => {
            e.preventDefault();
            this.handleUserSubmit(id, new FormData(e.target));
        };
    },

    async handleUserSubmit(id, formData) {
        const payload = Object.fromEntries(formData.entries());
        payload.status = payload.status || '사용';
        if (await StorageService.saveUser(payload, id)) {
            alert(id ? '수정되었습니다.' : '등록되었습니다.');
            this.fetchData();
            this.closeModal();
        }
    },

    renderSettings(container) {
        const types = this.getCodesByGroup('TEST_TYPE').map(c => c.code_value);
        const enabled = this.state.settings.enabledTestTypes;
        const tabs = [
            { id: 'test-types', label: '테스트 구분 설정', icon: 'fa-vial' },
            { id: 'common-codes', label: '공통코드 관리', icon: 'fa-table-list' }
        ];
        const activeTab = this.state.settingsTab || 'test-types';
        const groupedCodes = [...new Set((this.state.commonCodes || []).map(c => c.group_code))];

        container.innerHTML = `
            <header class="animate-in">
                <div>
                    <h1>관리자 화면</h1>
                    <p class="subtitle">운영 현황과 전역 설정, 공통코드를 관리자 기준으로 관리합니다.</p>
                </div>
            </header>

            <div class="form-container animate-in" style="max-width: 100%;">
                <div style="display:flex; gap:0.75rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border); padding-bottom:1rem; flex-wrap:wrap;">
                    ${tabs.map(tab => `
                        <button
                            type="button"
                            class="btn"
                            data-settings-tab="${tab.id}"
                            style="background:${activeTab === tab.id ? 'var(--accent)' : 'var(--bg-secondary)'}; color:${activeTab === tab.id ? 'white' : 'var(--text-primary)'}; border:1px solid var(--border);">
                            <i class="fas ${tab.icon}"></i> ${tab.label}
                        </button>
                    `).join('')}
                </div>

                <div id="settingsTabPanel">
                    ${activeTab === 'test-types' ? `
                        <h2 style="margin-bottom: 1.5rem;"><i class="fas fa-vial"></i> 테스트 구분 설정</h2>
                        <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem;">
                            대시보드, 목록, 등록 화면에서 노출하고 관리할 테스트 단계를 선택하세요.
                        </p>

                        <form id="settingsForm">
                            <div style="display: flex; flex-direction: column; gap: 1rem; background: var(--bg-secondary); padding: 1.5rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                                ${types.map(t => `
                                    <label style="display: flex; align-items: center; gap: 1rem; cursor: pointer; padding: 0.5rem; border-radius: 0.4rem; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                                        <input type="checkbox" name="testTypes" value="${t}" ${enabled.includes(t) ? 'checked' : ''} style="width: 1.2rem; height: 1.2rem; cursor: pointer;">
                                        <span style="font-weight: 500;">${t}</span>
                                    </label>
                                `).join('')}
                            </div>

                            <div style="margin-top: 2rem;">
                                <button type="submit" class="btn btn-primary" style="width: 100%;"><i class="fas fa-save"></i> 설정 저장하기</button>
                            </div>
                        </form>
                    ` : `
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap;">
                            <div>
                                <h2 style="margin-bottom: 0.5rem;"><i class="fas fa-table-list"></i> 공통코드 관리</h2>
                                <p style="color: var(--text-secondary); font-size: 0.875rem;">
                                    테스트 구분, 상태, 심각도, 식별 등 공통 선택값을 전역으로 관리합니다.
                                </p>
                            </div>
                            <button type="button" class="btn btn-primary" onclick="App.renderCommonCodeForm()">
                                <i class="fas fa-plus"></i> 코드 추가
                            </button>
                        </div>

                        <div class="data-table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>그룹코드</th>
                                        <th>코드값</th>
                                        <th>코드명</th>
                                        <th>색상</th>
                                        <th>정렬순서</th>
                                        <th>관리</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${groupedCodes.map(group => `
                                        <tr>
                                            <td colspan="6" style="background: var(--bg-secondary); font-weight: 700;">${group}</td>
                                        </tr>
                                        ${this.getCodesByGroup(group).map(code => `
                                            <tr>
                                                <td>${code.group_code}</td>
                                                <td><strong>${code.code_value}</strong></td>
                                                <td>${this.sanitize(code.code_name)}</td>
                                                <td>
                                                    <div style="display:flex; align-items:center; gap:0.5rem;">
                                                        <span style="display:inline-block; width:16px; height:16px; border-radius:50%; border:1px solid var(--border); background:${code.color || '#ffffff'};"></span>
                                                        <span>${code.color || '-'}</span>
                                                    </div>
                                                </td>
                                                <td>${code.sort_order ?? 0}</td>
                                                <td>
                                                    <div style="display:flex; gap:0.5rem;">
                                                        <button class="btn" style="padding:0.4rem; color: var(--accent)" onclick="App.renderCommonCodeForm('${code.group_code}', '${code.code_value}')"><i class="fas fa-edit"></i></button>
                                                        <button class="btn" style="padding:0.4rem; color: var(--error)" onclick="App.deleteCommonCode('${code.group_code}', '${code.code_value}')"><i class="fas fa-trash"></i></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    `).join('') || '<tr><td colspan="6" style="text-align:center; padding:2rem;">등록된 공통코드가 없습니다.</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
`;

        document.querySelectorAll('[data-settings-tab]').forEach(button => {
            button.onclick = () => {
                this.state.settingsTab = button.dataset.settingsTab;
                this.render();
            };
        });

        const settingsForm = document.getElementById('settingsForm');
        if (settingsForm) {
            settingsForm.onsubmit = (e) => {
                e.preventDefault();
                const checked = Array.from(e.target.querySelectorAll('input[name="testTypes"]:checked')).map(i => i.value);
                if (checked.length === 0) {
                    alert('최소 하나 이상의 테스트 구분을 선택해야 합니다.');
                    return;
                }
                this.updateSettings({ enabledTestTypes: checked });
            };
        }
    },

    renderAssigneeStatusScreen(container) {
        container.innerHTML = `
            <header class="animate-in">
                <div>
                    <h1>결함 조치 현황</h1>
                    <p class="subtitle">조치자별 결함 배정 현황과 상태별 처리 건수를 확인합니다.</p>
                </div>
            </header>

            <div class="form-container animate-in" style="max-width: 100%;">
                ${this.renderAssigneeStatusPanel()}
            </div>
        `;
    },

    renderAssigneeStatusPanel() {
        const defects = (this.state.allDefectsSummary || []).filter(d => this.isTestTypeEnabled(d.test_type));
        const assignees = (this.state.users || [])
            .filter(user => user.role === '조치자' && this.isUserActive(user.status))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        const statusCodes = this.getCodesByGroup('STATUS');
        const completedStatuses = ['Resolved', 'Staging', 'Closed'];
        const buildStatusRow = (label, department, userStatus, assignedDefects, isUnassigned = false) => {
            const counts = {};
            statusCodes.forEach(code => {
                counts[code.code_value] = assignedDefects.filter(defect => defect.status === code.code_value).length;
            });
            const completed = assignedDefects.filter(defect => completedStatuses.includes(defect.status)).length;

            return {
                user: {
                    name: label,
                    department,
                    status: userStatus
                },
                total: assignedDefects.length,
                counts,
                completed,
                completionRate: assignedDefects.length > 0 ? this.pct(completed, assignedDefects.length) : 0,
                isUnassigned
            };
        };
        const rows = assignees.map(user => {
            const assignedDefects = defects.filter(defect => defect.assignee === user.name);
            return buildStatusRow(user.name, user.department || '-', user.status || '-', assignedDefects);
        });
        const unassignedDefects = defects.filter(defect => !defect.assignee);
        if (unassignedDefects.length > 0) {
            rows.push(buildStatusRow('미배정', '-', '미배정', unassignedDefects, true));
        }
        const totals = {
            total: rows.reduce((sum, row) => sum + row.total, 0),
            counts: {}
        };
        statusCodes.forEach(code => {
            totals.counts[code.code_value] = rows.reduce((sum, row) => sum + (row.counts[code.code_value] || 0), 0);
        });
        totals.completed = rows.reduce((sum, row) => sum + row.completed, 0);
        totals.completionRate = totals.total > 0 ? this.pct(totals.completed, totals.total) : 0;

        const totalAssignedDefects = totals.total;
        const activeAssigneeCount = rows.filter(row => row.total > 0).length;
        const unassignedCount = defects.filter(defect => !defect.assignee).length;
        const completedDefects = defects.filter(defect =>
            completedStatuses.includes(defect.status)
        ).length;
        const completionRate = defects.length > 0
            ? Math.round((completedDefects / defects.length) * 100)
            : 0;

        return `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap;">
                <div>
                    <h2 style="margin-bottom: 0.5rem;"><i class="fas fa-user-check"></i> 결함 조치 현황</h2>
                    <p style="color: var(--text-secondary); font-size: 0.875rem;">
                        조치자별 결함 배정 현황과 상태별 처리 건수를 확인합니다.
                    </p>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
                <div class="stat-card">
                    <div class="stat-value">${assignees.length}</div>
                    <div class="stat-label">등록된 조치자</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${activeAssigneeCount}</div>
                    <div class="stat-label">배정된 조치자</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${totalAssignedDefects}</div>
                    <div class="stat-label">표시 결함 수</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${unassignedCount}</div>
                    <div class="stat-label">미배정 결함 수</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" style="display: flex; align-items: baseline; gap: 0.5rem;">
                        <span>${completionRate}%</span>
                        <span style="font-size: 1rem; font-weight: 600; color: var(--text-secondary);">${completedDefects}/${defects.length}</span>
                    </div>
                    <div class="stat-label">조치완료율</div>
                </div>
            </div>

            <div class="data-table-container">
                <table style="min-width: 1200px;">
                    <thead>
                        <tr>
                            <th>조치자</th>
                            <th>소속</th>
                            <th style="text-align:center;">총 건수</th>
                            ${statusCodes.map(code => `
                                <th style="text-align:center; color:${code.color || 'inherit'};">${code.code_name}</th>
                            `).join('')}
                            <th style="text-align:center;">조치완료율</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(row => `
                            <tr>
                                <td><strong>${this.sanitize(row.user.name)}</strong></td>
                                <td>${this.sanitize(row.user.department || '-')}</td>
                                <td style="text-align:center;">
                                    ${row.isUnassigned
                ? `<strong>${row.total}</strong>`
                : row.total > 0
                ? `<button type="button" class="btn" style="padding:0.35rem 0.65rem; background: rgba(37, 99, 235, 0.08); color: var(--accent); border: 1px solid rgba(37, 99, 235, 0.2); justify-content:center;" onclick="App.viewAssigneeDefects('${this.sanitize(row.user.name)}')"><strong>${row.total}</strong></button>`
                : '<strong>0</strong>'}
                                </td>
                                ${statusCodes.map(code => `
                                    <td style="text-align:center;">
                                        ${!row.isUnassigned && code.code_value === 'Resolved' && (row.counts[code.code_value] || 0) > 0
                ? `<button type="button" class="btn" style="padding:0.35rem 0.65rem; background: rgba(5, 150, 105, 0.08); color: var(--success); border: 1px solid rgba(5, 150, 105, 0.2); justify-content:center;" onclick="App.viewAssigneeDefectsByStatus('${this.sanitize(row.user.name)}', 'Resolved')"><strong>${row.counts[code.code_value]}</strong></button>`
                : (row.counts[code.code_value] || 0)}
                                    </td>
                                `).join('')}
                                <td style="text-align:center;">
                                    <strong style="color: var(--success);">${row.completionRate}%</strong>
                                    <div style="font-size:0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">${row.completed}/${row.total}</div>
                                </td>
                            </tr>
                        `).join('') || `<tr><td colspan="${4 + statusCodes.length}" style="text-align:center; padding:2rem;">등록된 조치자가 없습니다.</td></tr>`}
                    </tbody>
                    ${rows.length > 0 ? `
                        <tfoot style="background: rgba(255,255,255,0.05); font-weight: 700; border-top: 2px solid var(--border);">
                            <tr>
                                <td colspan="2" style="padding: 1rem;">합계</td>
                                <td style="text-align:center; padding: 1rem;">${totals.total}</td>
                                ${statusCodes.map(code => `
                                    <td style="text-align:center; padding: 1rem; color:${code.color || 'inherit'};">${totals.counts[code.code_value] || 0}</td>
                                `).join('')}
                                <td style="text-align:center; padding: 1rem;">
                                    <strong style="color: var(--success);">${totals.completionRate}%</strong>
                                    <div style="font-size:0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">${totals.completed}/${totals.total}</div>
                                </td>
                            </tr>
                        </tfoot>
                    ` : ''}
                </table>
            </div>
        `;
    },

    viewAssigneeDefects(assigneeName) {
        this.state.listConfig.search = {
            severity: '',
            status: '',
            title: '',
            stepsToRepro: '',
            creator: '',
            assignee: assigneeName,
            testType: '',
            dateStart: '',
            dateEnd: '',
            identification: ''
        };
        this.state.listConfig.page = 1;
        this.navigate('list');
        this.fetchData();
    },

    viewAssigneeDefectsByStatus(assigneeName, status) {
        this.state.listConfig.search = {
            severity: '',
            status: status,
            title: '',
            stepsToRepro: '',
            creator: '',
            assignee: assigneeName,
            testType: '',
            dateStart: '',
            dateEnd: '',
            identification: ''
        };
        this.state.listConfig.page = 1;
        this.navigate('list');
        this.fetchData();
    },

    renderCommonCodeForm(groupCode = '', codeValue = '') {
        const code = groupCode && codeValue
            ? (this.state.commonCodes || []).find(c => c.group_code === groupCode && c.code_value === codeValue)
            : null;
        const modalBody = document.getElementById('modalBody');

        modalBody.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h1>${code ? '공통코드 수정' : '공통코드 추가'}</h1>
                <p class="subtitle">공통 선택값과 표시 정보를 관리합니다.</p>
            </div>
            <form id="commonCodeForm">
                <input type="hidden" name="original_group_code" value="${this.sanitize(code?.group_code || '')}">
                <input type="hidden" name="original_code_value" value="${this.sanitize(code?.code_value || '')}">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem;">
                    <div class="form-group">
                        <label>그룹코드</label>
                        <input type="text" name="group_code" value="${this.sanitize(code?.group_code || '')}" required placeholder="예: STATUS">
                    </div>
                    <div class="form-group">
                        <label>코드값</label>
                        <input type="text" name="code_value" value="${this.sanitize(code?.code_value || '')}" required placeholder="예: Open">
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:1.5rem;">
                    <div class="form-group">
                        <label>코드명</label>
                        <input type="text" name="code_name" value="${this.sanitize(code?.code_name || '')}" required placeholder="예: 진행중">
                    </div>
                    <div class="form-group">
                        <label>색상</label>
                        <input type="color" name="color" value="${code?.color || '#64748b'}">
                    </div>
                    <div class="form-group">
                        <label>정렬순서</label>
                        <input type="number" name="sort_order" value="${code?.sort_order ?? 0}" min="0" step="1">
                    </div>
                </div>
                <div style="display:flex; gap:1rem; margin-top:2rem;">
                    <button type="submit" class="btn btn-primary" style="flex:1;">${code ? '저장하기' : '등록하기'}</button>
                    <button type="button" class="btn" style="flex:1; background: var(--bg-secondary);" onclick="App.closeModal()">취소</button>
                </div>
            </form>
        `;

        this.openModal();
        document.getElementById('commonCodeForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const payload = {
                group_code: String(formData.get('group_code') || '').trim().toUpperCase(),
                code_value: String(formData.get('code_value') || '').trim(),
                code_name: String(formData.get('code_name') || '').trim(),
                color: String(formData.get('color') || '').trim(),
                sort_order: String(formData.get('sort_order') || '0').trim()
            };
            const originalKey = formData.get('original_group_code') && formData.get('original_code_value')
                ? {
                    group_code: String(formData.get('original_group_code')),
                    code_value: String(formData.get('original_code_value'))
                }
                : null;

            if (!payload.group_code || !payload.code_value || !payload.code_name) {
                alert('그룹코드, 코드값, 코드명은 필수입니다.');
                return;
            }

            if (await StorageService.saveCommonCode(payload, originalKey)) {
                this.state.commonCodes = await StorageService.fetchCommonCodes();
                this.closeModal();
                this.render();
                alert(code ? '공통코드가 수정되었습니다.' : '공통코드가 등록되었습니다.');
            } else {
                alert('공통코드 저장에 실패했습니다.');
            }
        };
    },

    async deleteCommonCode(groupCode, codeValue) {
        if (!confirm(`[${groupCode}] ${codeValue} 코드를 삭제하시겠습니까?`)) return;

        if (await StorageService.deleteCommonCode(groupCode, codeValue)) {
            this.state.commonCodes = await StorageService.fetchCommonCodes();
            this.render();
            alert('공통코드가 삭제되었습니다.');
        } else {
            alert('공통코드 삭제에 실패했습니다.');
        }
    },

    async updateSettings(newSettings) {
        this.state.settings = { ...this.state.settings, ...newSettings };

        // 1. Sync to LocalStorage (Immediate UI feedback fallback)
        localStorage.setItem('app_settings', JSON.stringify(this.state.settings));

        // 2. Sync to Global DB (Supabase)
        try {
            const success = await StorageService.saveAppSettings(this.state.settings);
            if (!success) {
                console.warn("[App] Could not save settings to DB. Persistent only in local browser session.");
            }
        } catch (err) {
            console.error("[App] Error saving settings to Supabase:", err);
        }

        // Refresh calculations and UI
        await this.fetchData();
        alert('설정이 전역적으로 저장되었습니다.');
    },

    async deleteUser(id) {
        if (!confirm('해당 담당자를 삭제하시겠습니까?')) return;
        if (await StorageService.deleteUser(id)) {
            this.fetchData();
        }
    },

    /**
     * Helper: Format UTC/ISO date string to Korean Standard Time (KST) display
     */
    /**
     * Helper: Format UTC/ISO date string to Korean Standard Time (KST) display
     */
    formatDateKST(isoString, includeTime = true) {
        if (!isoString) return '-';
        try {
            // DB 설정이 Asia/Seoul이므로 넘어오는 시각을 그대로 파싱합니다.
            const date = new Date(isoString);
            // 만약 유효하지 않은 날짜인 경우 원본 반환
            if (isNaN(date.getTime())) return isoString;

            const options = {
                timeZone: 'Asia/Seoul',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            };
            if (includeTime) {
                options.hour = '2-digit';
                options.minute = '2-digit';
                options.second = '2-digit';
                options.hour12 = false;
            }
            return date.toLocaleString('ko-KR', options);
        } catch (e) {
            console.error("[formatDateKST Error]", e, isoString);
            return isoString;
        }
    },

    /**
     * Helper: Get YYYY-MM-DD string in Korean Standard Time (KST)
     */
    getKSTDateString(isoString) {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            const offset = 9 * 60; // KST is UTC+9
            const kstDate = new Date(date.getTime() + (offset * 60 * 1000));
            return kstDate.toISOString().split('T')[0];
        } catch (e) {
            return '';
        }
    },

    renderDashboard(container) {
        const stats = this.state.stats;
        // All necessary summary data is now in state.allDefectsSummary
        const defects = this.state.allDefectsSummary.filter(d => this.isTestTypeEnabled(d.test_type));

        // 1. 등록자별/심각도별 통계 계산
        const creatorStats = {};
        const grandTotal = { total: 0 };
        this.getCodesByGroup('SEVERITY').forEach(c => grandTotal[c.code_value] = 0);

        defects.forEach(d => {
            const creator = d.creator || '미지정';
            if (!creatorStats[creator]) {
                creatorStats[creator] = { total: 0 };
                this.getCodesByGroup('SEVERITY').forEach(c => creatorStats[creator][c.code_value] = 0);
            }
            creatorStats[creator].total++;
            grandTotal.total++;
            if (creatorStats[creator][d.severity] !== undefined) {
                creatorStats[creator][d.severity]++;
                grandTotal[d.severity]++;
            }
        });
        const sortedCreators = Object.entries(creatorStats).sort((a, b) => b[1].total - a[1].total);

        // 2. 테스트 구분별 통계 계산 (NEW)
        const testTypeStats = {};
        const testTypeGrandTotal = { total: 0 };
        this.getCodesByGroup('SEVERITY').forEach(c => testTypeGrandTotal[c.code_value] = 0);

        defects.forEach(d => {
            const type = d.test_type || '단위테스트';
            if (!testTypeStats[type]) {
                testTypeStats[type] = { total: 0 };
                this.getCodesByGroup('SEVERITY').forEach(c => testTypeStats[type][c.code_value] = 0);
            }
            testTypeStats[type].total++;
            testTypeGrandTotal.total++;
            if (testTypeStats[type][d.severity] !== undefined) {
                testTypeStats[type][d.severity]++;
                testTypeGrandTotal[d.severity]++;
            }
        });
        const sortedTestTypes = Object.entries(testTypeStats).sort((a, b) => b[1].total - a[1].total);

        // 3. 결함 조치 현황 계산 (테스트 구분별)
        const statusStats = {};
        const statusGrandTotal = { total: 0 };
        this.getCodesByGroup('STATUS').forEach(c => statusGrandTotal[c.code_value] = 0);

        defects.forEach(d => {
            const type = d.test_type || '단위테스트';
            if (!statusStats[type]) {
                statusStats[type] = { total: 0 };
                this.getCodesByGroup('STATUS').forEach(c => statusStats[type][c.code_value] = 0);
            }
            statusStats[type].total++;
            statusGrandTotal.total++;
            if (statusStats[type][d.status] !== undefined) {
                statusStats[type][d.status]++;
                statusGrandTotal[d.status]++;
            }
        });
        const sortedStatusTypes = Object.entries(statusStats).sort((a, b) => b[1].total - a[1].total);

        // 비중(%) 계산 헬퍼
        

        container.innerHTML = `
            <header class="animate-in">
                <div>
                    <h1>대시보드</h1>
                    <p class="subtitle">실시간 결함 현황 및 통계</p>
                </div>
            </header>
            
            <div class="stats-grid animate-in">
                <div class="stat-card">
                    <div class="stat-label">전체 결함</div>
                    <div class="stat-value" style="color: var(--accent)">${stats.total}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">진행 중</div>
                    <div class="stat-value" style="color: var(--warning); display: flex; align-items: baseline; gap: 0.5rem;">
                        <span>${stats.open}</span>
                        <span style="font-size: 1rem; font-weight: 500; opacity: 0.75;">(${this.pct(stats.open, stats.total)}%)</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">조치 완료</div>
                    <div class="stat-value" style="color: var(--success); display: flex; align-items: baseline; gap: 0.5rem;">
                        <span>${stats.resolved}</span>
                        <span style="font-size: 1rem; font-weight: 500; opacity: 0.75;">(${this.pct(stats.resolved, stats.total)}%)</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">크리티컬</div>
                    <div class="stat-value" style="color: var(--error); display: flex; align-items: baseline; gap: 0.5rem;">
                        <span>${stats.critical}</span>
                        <span style="font-size: 1rem; font-weight: 500; opacity: 0.75;">(${this.pct(stats.critical, stats.total)}%)</span>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                <div class="form-container animate-in" style="max-width: 100%;">
                    <h2 style="margin-bottom: 1.5rem;">결함 상태별 비중</h2>
                    <div style="height: 100px;">
                        <canvas id="statusChart"></canvas>
                    </div>
                </div>
                <div class="form-container animate-in" style="max-width: 100%;">
                    <h2 style="margin-bottom: 1.5rem;">심각도별 비중</h2>
                    <div style="height: 100px;">
                        <canvas id="severityChart"></canvas>
                    </div>
                </div>
            </div>

            <div class="form-container animate-in" style="max-width: 100%; margin-bottom: 2rem;">
                <h2 style="margin-bottom: 1.5rem;"><i class="fas fa-chart-bar"></i> 결함 조치 현황 (테스트 구분별)</h2>
                <div class="data-table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>테스트 구분</th>
                                <th style="text-align: center;">전체 건수</th>
                                ${this.getCodesByGroup('STATUS').map(c => `
                                    <th style="text-align: center; color: ${c.color || 'inherit'};">${c.code_name} (${c.code_value})</th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedStatusTypes.map(([type, s]) => `
                                <tr>
                                    <td><strong>${this.getCodeName('TEST_TYPE', type)}</strong></td>
                                    <td style="text-align: center;"><strong>${s.total}</strong></td>
                                    ${this.getCodesByGroup('STATUS').map(c => `
                                        <td style="text-align: center;">${s[c.code_value]}${s.total > 0 ? ` <span style="color:var(--text-secondary);font-size:0.8rem;">(${this.pct(s[c.code_value], s.total)}%)</span>` : ''}</td>
                                    `).join('')}
                                </tr>
                            `).join('') || '<tr><td colspan="10" style="text-align: center; padding: 2rem;">데이터가 없습니다.</td></tr>'}
                        </tbody>
                        ${sortedStatusTypes.length > 0 ? `
                        <tfoot style="background: rgba(255,255,255,0.05); font-weight: 700; border-top: 2px solid var(--border);">
                            <tr>
                                <td style="padding: 1rem;">합계 (Total)</td>
                                <td style="text-align: center; padding: 1rem;">${statusGrandTotal.total}</td>
                                ${this.getCodesByGroup('STATUS').map(c => `
                                    <td style="text-align: center; padding: 1rem; color: ${c.color || 'inherit'};">
                                        ${statusGrandTotal[c.code_value]}${statusGrandTotal.total > 0 ? ` <span style="font-size:0.8rem;opacity:0.8;">(${this.pct(statusGrandTotal[c.code_value], statusGrandTotal.total)}%)</span>` : ''}
                                    </td>
                                `).join('')}
                            </tr>
                        </tfoot>
                        ` : ''}
                    </table>
                </div>
                </div>
            </div>

            <div class="form-container animate-in" style="max-width: 100%; margin-bottom: 2rem;">
                <h2 style="margin-bottom: 1.5rem;"><i class="fas fa-microscope"></i> 테스트 구분별 결함 현황 (심각도별)</h2>
                <div class="data-table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>테스트 구분</th>
                                <th style="text-align: center;">전체 건수</th>
                                ${this.getCodesByGroup('SEVERITY').map(c => `
                                    <th style="text-align: center; color: ${c.color || 'inherit'};">${c.code_name}</th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedTestTypes.map(([type, s]) => `
                                <tr>
                                    <td><strong>${this.getCodeName('TEST_TYPE', type)}</strong></td>
                                    <td style="text-align: center;"><strong>${s.total}</strong></td>
                                    ${this.getCodesByGroup('SEVERITY').map(c => `
                                    <td style="text-align: center;">${s[c.code_value]}${s.total > 0 ? ` <span style="color:var(--text-secondary);font-size:0.8rem;">(${this.pct(s[c.code_value], s.total)}%)</span>` : ''}</td>
                                `).join('')}
                                </tr>
                            `).join('') || '<tr><td colspan="6" style="text-align: center; padding: 2rem;">데이터가 없습니다.</td></tr>'}
                        </tbody>
                        ${sortedTestTypes.length > 0 ? `
                        <tfoot style="background: rgba(255,255,255,0.05); font-weight: 700; border-top: 2px solid var(--border);">
                            <tr>
                                <td style="padding: 1rem;">합계 (Total)</td>
                                <td style="text-align: center; padding: 1rem;">${testTypeGrandTotal.total}</td>
                                <td style="text-align: center; padding: 1rem; color: var(--error);">${testTypeGrandTotal.Critical}${testTypeGrandTotal.total > 0 ? ' <span style="font-size:0.8rem;opacity:0.8;">(' + this.pct(testTypeGrandTotal.Critical, testTypeGrandTotal.total) + '%)</span>' : ''}</td>
                                <td style="text-align: center; padding: 1rem; color: var(--warning);">${testTypeGrandTotal.Major}${testTypeGrandTotal.total > 0 ? ' <span style="font-size:0.8rem;opacity:0.8;">(' + this.pct(testTypeGrandTotal.Major, testTypeGrandTotal.total) + '%)</span>' : ''}</td>
                                <td style="text-align: center; padding: 1rem; color: var(--accent);">${testTypeGrandTotal.Minor}${testTypeGrandTotal.total > 0 ? ' <span style="font-size:0.8rem;opacity:0.8;">(' + this.pct(testTypeGrandTotal.Minor, testTypeGrandTotal.total) + '%)</span>' : ''}</td>
                                <td style="text-align: center; padding: 1rem; color: var(--success);">${testTypeGrandTotal.Simple}${testTypeGrandTotal.total > 0 ? ' <span style="font-size:0.8rem;opacity:0.8;">(' + this.pct(testTypeGrandTotal.Simple, testTypeGrandTotal.total) + '%)</span>' : ''}</td>
                            </tr>
                        </tfoot>
                        ` : ''}
                    </table>
                </div>
            </div>

            <div class="form-container animate-in" style="max-width: 100%;">
                <h2 style="margin-bottom: 1.5rem;">최근 등록된 결함</h2>
                <div class="data-table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>결함명</th>
                                <th>심각도</th>
                                <th>상태</th>
                                <th>등록자</th>
                                <th>등록일</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${defects
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 10)
                .map(d => `
                                <tr>
                                    <td><strong class="clickable-link" onclick="App.editDefect(${d.defect_id})">[${this.getCodeName('TEST_TYPE', d.test_type).substring(0, 2)}] ${this.sanitize(d.title)}</strong></td>
                                    <td><span class="badge" style="background-color: ${this.getCodeColor('SEVERITY', d.severity) || '#64748b'}; color: white;">${this.getCodeName('SEVERITY', d.severity)}</span></td>
                                    <td><span class="badge" style="background-color: ${this.getCodeColor('STATUS', d.status) || '#64748b'}; color: white;">${this.getCodeName('STATUS', d.status)}</span></td>
                                    <td>${this.sanitize(d.creator)}</td>
                                    <td>${this.formatDateKST(d.created_at)}</td>
                                </tr>
                            `).join('') || '<tr><td colspan="5" style="text-align: center; padding: 2rem;">데이터가 없습니다.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="form-container animate-in" style="max-width: 100%; margin-top: 2rem;">
                <h2 style="margin-bottom: 1.5rem;"><i class="fas fa-users-viewfinder"></i> 등록자별 결함 통계 (심각도별)</h2>
                <div class="data-table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>등록자</th>
                                <th style="text-align: center;">전체 건수</th>
                                ${this.getCodesByGroup('SEVERITY').map(c => `
                                    <th style="text-align: center; color: ${c.color || 'inherit'};">${c.code_name}</th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedCreators.map(([name, s]) => `
                                <tr>
                                    <td><strong>${this.sanitize(name)}</strong></td>
                                    <td style="text-align: center;"><strong>${s.total}</strong></td>
                                    <td style="text-align: center;">${s.Critical}</td>
                                    <td style="text-align: center;">${s.Major}</td>
                                    <td style="text-align: center;">${s.Minor}</td>
                                    <td style="text-align: center;">${s.Simple}</td>
                                </tr>
                            `).join('') || '<tr><td colspan="6" style="text-align: center; padding: 2rem;">집계된 데이터가 없습니다.</td></tr>'}
                        </tbody>
                        ${sortedCreators.length > 0 ? `
                        <tfoot style="background: rgba(255,255,255,0.05); font-weight: 700; border-top: 2px solid var(--border);">
                            <tr>
                                <td style="padding: 1rem;">합계 (Total)</td>
                                <td style="text-align: center; padding: 1rem;">${grandTotal.total}</td>
                                <td style="text-align: center; padding: 1rem; color: var(--error);">${grandTotal.Critical}</td>
                                <td style="text-align: center; padding: 1rem; color: var(--warning);">${grandTotal.Major}</td>
                                <td style="text-align: center; padding: 1rem; color: var(--accent);">${grandTotal.Minor}</td>
                                <td style="text-align: center; padding: 1rem; color: var(--success);">${grandTotal.Simple}</td>
                            </tr>
                        </tfoot>
                        ` : ''}
                    </table>
                </div>
            </div>
`;

        // Chart.js Initialization (Weighted Stacked Bar)
        const statusCounts = {
            'Open': 0, 'In Progress': 0, 'Resolved': 0, 'Staging': 0, 'Closed': 0, 'Reopened': 0
        };
        const statusMap = {
            'Open': '접수', 'In Progress': '조치 중', 'Resolved': '조치 완료', 'Staging': '스테이징 배포', 'Closed': '종료', 'Reopened': '재오픈'
        };
        let totalDefectsCount = 0;
        defects.forEach(d => {
            if (statusCounts[d.status] !== undefined) {
                statusCounts[d.status]++;
                totalDefectsCount++;
            }
        });

        const ctx = document.getElementById('statusChart');
        if (ctx) {
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['전체'],
                    datasets: Object.keys(statusCounts).map((status, index) => {
                        const count = statusCounts[status];
                        const percentage = totalDefectsCount > 0 ? (count / totalDefectsCount * 100).toFixed(1) : 0;
                        const colors = [
                            '#fbbf24', '#f59e0b', '#10b981', '#6b7280', '#ef4444'
                        ];

                        return {
                            label: statusMap[status] || status,
                            data: [percentage], // Weight as percentage
                            backgroundColor: colors[index] + 'a0',
                            borderColor: colors[index],
                            borderWidth: 1,
                            count: count // Store raw count for tooltip
                        };
                    })
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#cbd5e1',
                                font: { size: 11 }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const raw = context.raw; // percentage
                                    const count = context.dataset.count;
                                    return `${context.dataset.label}: ${raw}% (${count}건)`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            stacked: true,
                            display: false, // Hide X axis
                            max: 100
                        },
                        y: {
                            stacked: true,
                            display: false // Hide Y axis
                        }
                    }
                }
            });
        }

        // Severity Chart
        const severityCounts = { 'Critical': 0, 'Major': 0, 'Minor': 0, 'Simple': 0 };
        defects.forEach(d => {
            if (severityCounts[d.severity] !== undefined) severityCounts[d.severity]++;
            else severityCounts['Minor']++; // Default fallback
        });

        const ctxSeverity = document.getElementById('severityChart');
        if (ctxSeverity) {
            new Chart(ctxSeverity, {
                type: 'bar',
                data: {
                    labels: ['전체'],
                    datasets: Object.keys(severityCounts).map((sev, index) => {
                        const count = severityCounts[sev];
                        const percentage = totalDefectsCount > 0 ? (count / totalDefectsCount * 100).toFixed(1) : 0;
                        const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];

                        return {
                            label: sev,
                            data: [percentage],
                            backgroundColor: colors[index] + 'a0',
                            borderColor: colors[index],
                            borderWidth: 1,
                            count: count
                        };
                    })
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#cbd5e1', font: { size: 11 } } },
                        tooltip: {
                            callbacks: {
                                label: (context) => `${context.dataset.label}: ${context.raw}% (${context.dataset.count}건)`
                            }
                        }
                    },
                    scales: {
                        x: { stacked: true, display: false, max: 100 },
                        y: { stacked: true, display: false }
                    }
                }
            });
        }
    },

    renderList(container) {
        const config = this.state.listConfig;
        const search = config.search;

        // pagedData: Now already fetched from server
        const pagedData = this.state.defects;
        const totalItems = this.state.totalDefectCount;
        const totalPages = Math.ceil(totalItems / config.pageSize);

        container.innerHTML = `
            <header class="animate-in">
                <div>
                    <h1>결함 관리 목록</h1>
                    <p class="subtitle">시스템 내 모든 결함 데이터를 상세하게 조회합니다.</p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn" style="background: #166534; color: white;" onclick="App.downloadExcel()"><i class="fas fa-file-excel"></i> 엑셀 다운로드</button>
                    <button class="btn btn-primary" onclick="App.navigate('register')"><i class="fas fa-plus"></i> 새 결함 등록</button>
                </div>
            </header>

            <!-- Search Filters -->
            <div class="form-container animate-in" style="max-width: 100%; margin-bottom: 1.5rem; padding: 1.5rem;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; align-items: end;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">테스트 구분</label>
                        <select id="searchTestType">
                            <option value="">전체</option>
                            ${this.getVisibleTestTypeCodes(search.testType).map(c => `
                                <option value="${c.code_value}" ${search.testType === c.code_value ? 'selected' : ''}>${c.code_name}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">심각도</label>
                        <select id="searchSeverity">
                            <option value="">전체</option>
                            ${this.getCodesByGroup('SEVERITY').map(c => `
                                <option value="${c.code_value}" ${search.severity === c.code_value ? 'selected' : ''}>${c.code_name}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">상태</label>
                        <select id="searchStatus">
                            <option value="">전체</option>
                            ${this.getCodesByGroup('STATUS').map(c => `
                                <option value="${c.code_value}" ${search.status === c.code_value ? 'selected' : ''}>${c.code_name}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">결함식별</label>
                        <select id="searchIdentification">
                            <option value="">전체</option>
                            ${this.getCodesByGroup('IDENTIFICATION').map(c => `
                                <option value="${c.code_value}" ${search.identification === c.code_value ? 'selected' : ''}>${c.code_name}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">결함 제목</label>
                        <input type="text" id="searchTitle" value="${search.title}" onkeydown="if(event.key==='Enter') App.handleSearch()" placeholder="제목 키워드 검색 (Enter)">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">재현단계</label>
                        <input type="text" id="searchStepsToRepro" value="${search.stepsToRepro}" onkeydown="if(event.key==='Enter') App.handleSearch()" placeholder="재현단계 키워드 검색 (Enter)">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">등록자</label>
                        <input type="text" id="searchCreator" value="${search.creator}" onkeydown="if(event.key==='Enter') App.handleSearch()" placeholder="이름 검색 (Enter)">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">담당자</label>
                        <input type="text" id="searchAssignee" value="${search.assignee}" onkeydown="if(event.key==='Enter') App.handleSearch()" placeholder="이름 검색 (Enter)">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">등록기간 (시작)</label>
                        <input type="date" id="searchDateStart" value="${search.dateStart}">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">등록기간 (종료)</label>
                        <input type="date" id="searchDateEnd" value="${search.dateEnd}">
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: flex-end; grid-column: span 2;">
                        <button class="btn btn-primary" onclick="App.handleSearch()" style="flex: 1; justify-content: center; height: 42px; font-size: 0.875rem; white-space: nowrap;"><i class="fas fa-search"></i> 조회</button>
                        <button class="btn" onclick="App.resetFilters()" style="flex: 1; height: 42px; font-size: 0.875rem; white-space: nowrap; background: var(--bg-secondary); border: 1px solid var(--border); justify-content: center;"><i class="fas fa-rotate-left"></i> 초기화</button>
                    </div>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div style="font-size: 0.875rem; color: var(--text-secondary);">
                    총 <strong>${totalItems}</strong>건 (${config.page} / ${totalPages || 1} 페이지)
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <label style="margin:0; font-size: 0.8125rem;">출력 개수:</label>
                    <select id="pageSizeSelect" onchange="App.handlePageSizeChange()" style="width: 80px; padding: 0.3rem;">
                        <option value="20" ${config.pageSize == 20 ? 'selected' : ''}>20</option>
                        <option value="50" ${config.pageSize == 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${config.pageSize == 100 ? 'selected' : ''}>100</option>
                        ${this.state.currentRole === '관리자' ? `<option value="${totalItems}" ${config.pageSize >= totalItems && totalItems > 100 ? 'selected' : ''}>All</option>` : ''}
                    </select>
                </div>
            </div>

            <div class="data-table-container animate-in">
                <table style="min-width: 1400px;">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>구분</th>
                            <th>결함명</th>
                            <th>식별</th>
                            <th>심각도</th>
                            <th>우선순위</th>
                            <th>상태</th>
                            <th>메뉴/화면명</th>
                            <th>등록자</th>
                            <th>담당자</th>
                            <th>등록일</th>
                            <th>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pagedData.map(d => `
                            <tr>
                                <td>#${d.defect_id}</td>
                                <td>${this.getCodeName('TEST_TYPE', d.test_type)}</td>
                                <td style="max-width:250px; white-space:normal;">
                                    <strong class="clickable-link" onclick="App.editDefect(${d.defect_id})">[${this.getCodeName('TEST_TYPE', d.test_type).substring(0, 2)}] ${this.sanitize(d.title)}</strong>
                                </td>
                                <td><span class="badge" style="background-color: ${this.getCodeColor('IDENTIFICATION', d.defect_identification) || 'var(--bg-secondary)'}; color: white;">${this.getCodeName('IDENTIFICATION', d.defect_identification)}</span></td>
                                <td><span class="badge" style="background-color: ${this.getCodeColor('SEVERITY', d.severity) || '#64748b'}; color: white;">${this.getCodeName('SEVERITY', d.severity)}</span></td>
                                <td>${this.getCodeName('PRIORITY', d.priority)}</td>
                                <td><span class="badge" style="background-color: ${this.getCodeColor('STATUS', d.status) || '#64748b'}; color: white;">${this.getCodeName('STATUS', d.status)}</span></td>
                                <td>${this.sanitize(d.menu_name || '-')}/${this.sanitize(d.screen_name || '-')}</td>
                                <td>${this.sanitize(d.creator || '-')}</td>
                                <td>${this.sanitize(d.assignee || '-')}</td>
                                <td>${this.formatDateKST(d.created_at)}</td>
                                <td>
                                    <div style="display:flex; gap:0.5rem;">
                                        ${['조치자', '관리자'].includes(this.state.currentRole) ? `
                                            <button class="btn" style="padding: 0.4rem; color: var(--info)" title="조치 결과 입력" onclick="App.actionDefect(${d.defect_id})"><i class="fas fa-tools"></i> 조치</button>
                                        ` : ''}
                                        <button class="btn" style="padding: 0.4rem; color: var(--accent)" onclick="App.editDefect(${d.defect_id})"><i class="fas fa-edit"></i></button>
                                        ${this.state.currentRole === '관리자' ? `
                                            <button class="btn" style="padding: 0.4rem; color: var(--error)" onclick="App.deleteDefect(${d.defect_id})"><i class="fas fa-trash"></i></button>
                                        ` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan="13" style="text-align: center; padding: 2rem;">데이터가 없습니다.</td></tr>'}
                    </tbody>
                </table>
            </div>

            <!-- Pagination Controls -->
            ${totalPages > 1 ? `
            <div style="margin-top: 1.5rem; display: flex; justify-content: center; gap: 0.5rem;">
                <button class="btn" ${config.page === 1 ? 'disabled' : ''} onclick="App.changePage(${config.page - 1})" style="padding: 0.4rem 0.8rem;">이전</button>
                ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
                    <button class="btn" style="padding: 0.4rem 0.8rem; background: ${p === config.page ? 'var(--accent)' : 'var(--bg-main)'}; color: ${p === config.page ? 'white' : 'var(--text-primary)'}; border: 1px solid var(--border);" onclick="App.changePage(${p})">${p}</button>
                `).join('')}
                <button class="btn" ${config.page === totalPages ? 'disabled' : ''} onclick="App.changePage(${config.page + 1})" style="padding: 0.4rem 0.8rem;">다음</button>
            </div>
            ` : ''}
        `;
    },

    // 조회 버튼 클릭 또는 텍스트 입력 Enter 시 실행
    handleSearch() {
        this.state.listConfig.search = {
            severity: document.getElementById('searchSeverity').value,
            status: document.getElementById('searchStatus').value,
            title: document.getElementById('searchTitle').value,
            stepsToRepro: document.getElementById('searchStepsToRepro').value,
            creator: document.getElementById('searchCreator').value,
            assignee: document.getElementById('searchAssignee').value,
            testType: document.getElementById('searchTestType').value,
            dateStart: document.getElementById('searchDateStart').value,
            dateEnd: document.getElementById('searchDateEnd').value,
            identification: document.getElementById('searchIdentification').value
        };
        this.state.listConfig.page = 1;
        this.fetchData();
    },

    resetFilters() {
        this.state.listConfig.search = {
            severity: '',
            status: '',
            title: '',
            stepsToRepro: '',
            creator: '',
            assignee: '',
            testType: '',
            dateStart: '',
            dateEnd: '',
            identification: ''
        };
        this.state.listConfig.page = 1;
        this.fetchData(); // 초기화 후 즉시 전체 재조회
    },

    handlePageSizeChange() {
        this.state.listConfig.pageSize = parseInt(document.getElementById('pageSizeSelect').value);
        this.state.listConfig.page = 1;
        this.fetchData(); // Trigger server-side fetch
    },

    changePage(p) {
        this.state.listConfig.page = p;
        this.fetchData(); // Trigger server-side fetch
    },

    async downloadExcel() {
        // 로딩 표시
        const btn = document.querySelector('button[onclick="App.downloadExcel()"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 다운로드 중...'; }

        try {
            // 현재 검색 필터를 적용해 전체 항목 조회 (페이징 없음, 이미지 컬럼 제외)
            const filters = {
                ...(this.state.listConfig.search || {}),
                enabledTestTypes: this.getEnabledTestTypes()
            };
            const allDefects = await StorageService.getAllDefectsForExport(filters);

            if (allDefects.length === 0) {
                alert('다운로드할 데이터가 없습니다.');
                return;
            }

            const headers = [
                'ID', '구분', '제목', '결함식별', '심각도', '우선순위', '상태',
                '메뉴명', '화면명', '재현단계', '환경정보', '등록자', '담당자',
                '등록일', '수정일', '조치내용', '조치시작일', '조치종료일'
            ];
            const csvRows = [headers.join(',')];

            allDefects.forEach(d => {
                const row = [
                    d.defect_id,
                    d.test_type || '단위테스트',
                    `"${(d.title || '').replace(/"/g, '""')}"`,
                    d.defect_identification || '-',
                    d.severity,
                    d.priority,
                    d.status,
                    `"${(d.menu_name || '').replace(/"/g, '""')}"`,
                    `"${(d.screen_name || '').replace(/"/g, '""')}"`,
                    `"${(d.steps_to_repro || '').replace(/"/g, '""')}"`,
                    `"${(d.env_info || '').replace(/"/g, '""')}"`,
                    d.creator,
                    d.assignee || '',
                    this.formatDateKST(d.created_at),
                    d.updated_at ? this.formatDateKST(d.updated_at) : '',
                    `"${(d.action_comment || '').replace(/"/g, '""')}"`,
                    d.action_start ? this.formatDateKST(d.action_start, false) : '',
                    d.action_end ? this.formatDateKST(d.action_end, false) : ''
                ];
                csvRows.push(row.join(','));
            });

            const csvContent = "\ufeff" + csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            const kstDate = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace(/\./, '');
            link.setAttribute('href', url);
            link.setAttribute('download', `defects_export_${kstDate}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('[App] Excel export failed:', err);
            alert('엑셀 다운로드 중 오류가 발생했습니다.');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-file-excel"></i> 엑셀 다운로드'; }
        }
    },

    truncate(str, len) {
        if (!str) return '-';
        return str.length > len ? str.substring(0, len) + '...' : str;
    },

    renderForm(container, id = null, itemOverride = null) {
        const isAdmin = this.getEffectiveRole() === '관리자';
        const isNewDefect = !id;
        const canEditCreator = isNewDefect || isAdmin;
        const canAssign = isNewDefect || this.canEditAssignee();
        let item = itemOverride || (id ? this.getSelectedDefect(id) : {}) || {};

        // Handle pending data (Priority: postMessage > localStorage)
        if (!id) {
            const pendingFromMessage = this.state.pendingDefectData;
            const pendingFromLocal = localStorage.getItem('pending_defect');

            let data = null;
            if (pendingFromMessage) {
                data = pendingFromMessage;
                console.log("[App] Using data from postMessage (Cross-Domain)");
            } else if (pendingFromLocal) {
                try {
                    data = JSON.parse(pendingFromLocal);
                    console.log("[App] Using data from localStorage (Same-Domain)");
                } catch (e) {
                    console.error("[App] Failed to parse pending_defect:", e);
                    localStorage.removeItem('pending_defect');
                }
            }

            if (data) {
                item = {
                    ...item,
                    title: data.title,
                    menu_name: data.menu_name,
                    screen_name: data.screen_name,
                    screen_url: data.screen_url,
                    screenshot: data.screenshot,
                    env_info: data.env_info,
                    test_type: data.test_type
                };
                console.log("[App] Pending defect data consumed. Screenshot status:", !!data.screenshot);
            }
        }

        const title = id ? '결함 정보 관리' : '신규 결함 등록';

        container.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h1>${title}</h1>
                <p class="subtitle">결함을 상세하게 기록해 주세요.</p>
            </div>

            <div class="${id ? '' : 'form-container animate-in'}">
                <form id="defectForm">
                    <div class="form-group">
                        <label>테스트 구분</label>
                        <select name="test_type" required>
                                ${this.getVisibleTestTypeCodes(item.test_type).map(c => `<option value="${c.code_value}" ${item.test_type === c.code_value ? 'selected' : ''}>${c.code_name}</option>`).join('')}
                            </select>
                    </div>

                    <div class="form-group">
                        <label>결함 제목 (필수)</label>
                        <input type="text" name="title" value="${this.sanitize(item.title || '')}" required placeholder="간결하고 명확한 제목을 입력하세요">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="form-group">
                            <label>심각도</label>
                            <select name="severity" ${(!id || this.state.currentRole === '관리자' || (this.state.currentUser && item.creator === this.state.currentUser.name)) ? '' : 'disabled'}>
                                ${this.getCodesByGroup('SEVERITY').map(c => `<option value="${c.code_value}" ${item.severity === c.code_value ? 'selected' : ''}>${c.code_name}</option>`).join('')}
                            </select>
                            ${(id && this.state.currentRole !== '관리자' && (this.state.currentUser && item.creator !== this.state.currentUser.name)) ? '<p style="font-size: 0.75rem; color: var(--error); margin-top: 0.25rem;">* 심각도는 작성자 또는 관리자만 수정 가능합니다.</p>' : ''}
                        </div>
                        <div class="form-group">
                            <label>우선순위</label>
                            <select name="priority">
                                ${this.getCodesByGroup('PRIORITY').map(c => `<option value="${c.code_value}" ${item.priority === c.code_value ? 'selected' : ''}>${c.code_name}</option>`).join('')}
                            </select>
                        </div>
                    </div>


                    <div class="form-group">
                        <label>재현 단계 (Steps to Reproduce)</label>
                        <textarea name="steps_to_repro" rows="4" placeholder="1. 로그인 페이지 접속&#10;2. 아이디 입력...">${this.sanitize(item.steps_to_repro || '')}</textarea>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="form-group">
                            <label>등록자 (테스터) (필수) ${canEditCreator ? '<i class="fas fa-crown" style="color:#fbbf24; font-size:0.8rem;"></i>' : ''}</label>
                            <select name="creator" required ${canEditCreator ? '' : 'disabled'}>
                                <option value="">선택하세요</option>
                                ${this.state.users.filter(u => this.isUserActive(u.status)).map(u => `
                                    <option value="${this.sanitize(u.name)}" ${(item.creator || (this.state.currentUser ? this.state.currentUser.name : '')) === u.name ? 'selected' : ''}>${this.sanitize(u.name)} (${u.department})</option>
                                `).join('')}
                            </select>
                            ${!canEditCreator ? `<input type="hidden" name="creator" value="${this.sanitize(item.creator || (this.state.currentUser ? this.state.currentUser.name : ''))}">` : ''}
                        </div>
                        <div class="form-group">
                            <label>담당자 (조치자) ${canAssign ? '<i class="fas fa-edit" style="color:var(--accent); font-size:0.8rem;"></i>' : ''}</label>
                            <select name="assignee" ${canAssign ? '' : 'disabled'}>
                                <option value="">선택 안함</option>
                                ${this.state.users.filter(u => this.isUserActive(u.status) && u.role === '조치자').map(u => `
                                    <option value="${this.sanitize(u.name)}" ${item.assignee === u.name ? 'selected' : ''}>${this.sanitize(u.name)} (${u.department})</option>
                                `).join('')}
                            </select>
                            ${isNewDefect
                                ? '<p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">* 신규 등록 시 담당자(조치자)를 선택할 수 있습니다.</p>'
                                : (canAssign
                                    ? '<p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">* 관리자와 조치자는 결함정보관리 화면에서 담당자 정보를 수정할 수 있습니다.</p>'
                                    : '<p style="font-size: 0.75rem; color: var(--error); margin-top: 0.25rem;">* 담당자 정보는 관리자 또는 조치자만 수정 가능합니다.</p>')
                            }
                            ${!canAssign ? `<input type="hidden" name="assignee" value="${this.sanitize(item.assignee || '')}">` : ''}
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="form-group">
                            <label>메뉴명</label>
                            <input type="text" name="menu_name" value="${this.sanitize(item.menu_name || '')}" placeholder="예: 메인화면, 상품상세">
                        </div>
                        <div class="form-group">
                            <label>화면명</label>
                            <input type="text" name="screen_name" value="${this.sanitize(item.screen_name || '')}" placeholder="예: SCR_001, 장바구니">
                        </div>
                    </div>

                    <div class="form-group">
                        <label>이미지 첨부</label>
                        <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
                            <button type="button" class="btn" style="background: var(--bg-secondary); border: 1px dashed var(--border);" onclick="document.getElementById('imageUpload').click()">
                                <i class="fas fa-upload"></i> 이미지 직접 업로드
                            </button>
                            <span id="fileNameDisplay" style="font-size: 0.8125rem; color: var(--text-muted);">선택된 파일 없음</span>
                            <input type="file" id="imageUpload" accept="image/*" style="display: none;" onchange="
                                const file = this.files[0];
                                if(file) {
                                    document.getElementById('fileNameDisplay').textContent = file.name;
                                    App.handleImageUpload(this);
                                }
                            ">
                        </div>
                    </div>

                    <!-- Hidden fields for capture data -->
                    <input type="hidden" name="screen_url" value="${this.sanitize(item.screen_url || '')}">
                    <input type="hidden" name="screenshot" value="${item.screenshot || ''}">

                    <div id="imagePreviewWrapper" style="margin-bottom: 2rem; border: 1px solid var(--border); border-radius: 0.75rem; overflow: hidden; ${(item.screenshot || item.screen_url) ? '' : 'display: none;'}">
                        <div style="background: var(--bg-secondary); padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); font-size: 0.8125rem; font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
                            <span><i class="fas fa-eye"></i> 이미지 미리보기</span>
                            <a href="javascript:void(0)" 
                               style="color: var(--accent); text-decoration: none;"
                               onclick="App.viewExternal(document.getElementsByName('screenshot')[0].value || '${this.sanitize(item.screen_url || '')}');">
                               <i class="fas fa-search-plus"></i> 클릭하여 확대 보기
                            </a>
                        </div>
                        <div id="imagePreviewArea" style="width: 100%; height: 350px; background: #f8fafc; display: flex; align-items: center; justify-content: center;">
                            ${(item.screenshot || (item.screen_url && item.screen_url.match(/\.(jpeg|jpg|gif|png|webp|svg)/i)))
                ? `<img src="${item.screenshot || item.screen_url}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`
                : (item.screen_url ? `<iframe src="${this.sanitize(item.screen_url)}" style="width: 100%; height: 100%; border: none; background: #fff;"></iframe>` : '')
            }
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="form-group">
                            <label>변경할 상태</label>
                            <select name="status">
                                ${this.getCodesByGroup('STATUS').map(c => `<option value="${c.code_value}" ${item.status === c.code_value ? 'selected' : ''}>${c.code_name} (${c.code_value})</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>결함식별 (조치자/관리자 전용)</label>
                            <select name="defect_identification" ${(['조치자', '관리자'].includes(this.state.currentRole)) ? '' : 'disabled'}>
                                <option value="">선택하세요</option>
                                ${this.getCodesByGroup('IDENTIFICATION').map(c => `<option value="${c.code_value}" ${item.defect_identification === c.code_value ? 'selected' : ''}>${c.code_name}</option>`).join('')}
                            </select>
                            ${(!['조치자', '관리자'].includes(this.state.currentRole)) ? '<p style="font-size: 0.75rem; color: var(--error); margin-top: 0.25rem;">* 조치자 또는 관리자만 수정 가능합니다.</p>' : ''}
                        </div>
                    </div>

                    ${id ? `
                    <div style="margin: 2rem 0; padding-top: 1.5rem; border-top: 2px dashed var(--border);">
                        <h3 style="margin-bottom: 1.5rem; color: var(--info); font-size: 1rem;"><i class="fas fa-tools"></i> 결함 조치 결과 (Action Results)</h3>
                        
                        <div class="form-group">
                            <label>결함 조치 내용</label>
                            <textarea name="action_comment" rows="4" placeholder="원인 분석 및 조치 내용을 상세히 기록하세요">${this.sanitize(item.action_comment || '')}</textarea>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label>조치 시작일</label>
                                <input type="date" name="action_start" value="${this.getKSTDateString(item.action_start)}">
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label>조치 완료일</label>
                                <input type="date" name="action_end" value="${this.getKSTDateString(item.action_end)}">
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
                        <button type="button" class="btn" style="background: rgba(255,255,255,0.05)" onclick="App.closeModal()">취소</button>
                        <button type="submit" class="btn btn-primary">${id ? '수정 완료' : '결함 등록'}</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('defectForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit(id);
        });
    },

    renderActionForm(container, id, itemOverride = null) {
        const item = itemOverride || this.getSelectedDefect(id) || {};
        container.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h1>결함 조치 결과 입력</h1>
                <p class="subtitle">#${id} - ${this.sanitize(item.title)}</p>
            </div>

            <form id="actionForm">
                <div class="form-group">
                    <label>담당자 (조치자) (필수) ${['관리자', '조치자'].includes(this.state.currentRole) ? '<i class="fas fa-edit" style="color:var(--accent); font-size:0.8rem;"></i>' : ''}</label>
                    <select name="assignee" required ${['관리자', '조치자'].includes(this.state.currentRole) ? '' : 'disabled'}>
                        <option value="">선택하세요</option>
                        ${this.state.users.filter(u => this.isUserActive(u.status) && u.role === '조치자').map(u => `
                            <option value="${this.sanitize(u.name)}" ${(item.assignee || (this.state.currentUser ? this.state.currentUser.name : '')) === u.name ? 'selected' : ''}>${this.sanitize(u.name)} (${u.department})</option>
                        `).join('')}
                    </select>
                    ${!['관리자', '조치자'].includes(this.state.currentRole) ? `<input type="hidden" name="assignee" value="${this.sanitize(item.assignee || (this.state.currentUser ? this.state.currentUser.name : ''))}">` : ''}
                </div>

                <div class="form-group">
                    <label>결함 조치 내용</label>
                    <textarea name="action_comment" rows="6" placeholder="원인 분석 및 조치 내용을 상세히 기록하세요">${this.sanitize(item.action_comment || '')}</textarea>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="form-group">
                        <label>조치 시작일</label>
                        <input type="date" name="action_start" value="${App.getKSTDateString(item.action_start)}">
                    </div>
                    <div class="form-group">
                        <label>조치 완료일</label>
                        <input type="date" name="action_end" value="${App.getKSTDateString(item.action_end)}">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div class="form-group">
                        <label>변경할 상태</label>
                        <select name="status">
                                ${this.getCodesByGroup('STATUS').map(c => `<option value="${c.code_value}" ${item.status === c.code_value ? 'selected' : ''}>${c.code_name} (${c.code_value})</option>`).join('')}
                            </select>
                    </div>
                    <div class="form-group">
                        <label>결함식별 (필수)</label>
                        <select name="defect_identification" ${(['조치자', '관리자'].includes(this.state.currentRole)) ? '' : 'disabled'}>
                                <option value="">선택하세요</option>
                                ${this.getCodesByGroup('IDENTIFICATION').map(c => `<option value="${c.code_value}" ${item.defect_identification === c.code_value ? 'selected' : ''}>${c.code_name}</option>`).join('')}
                            </select>
                    </div>
                </div>

                <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
                    <button type="button" class="btn" style="background: rgba(255,255,255,0.05)" onclick="App.closeModal()">취소</button>
                    <button type="submit" class="btn btn-primary" style="background: var(--info)">조치 결과 저장</button>
                </div>
            </form>
        `;

        document.getElementById('actionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = this.buildDefectPayload(e.target, id);

            if (await StorageService.saveDefect(payload, id)) {
                alert('조치 결과가 저장되었습니다.');
                // 2. Load Common Codes (Added for Phase 3-1)
            try {
                console.log("[App] 3. Fetching Common Codes..."); this.state.commonCodes = await StorageService.fetchCommonCodes(); console.log("[App] 4. Common Codes Loaded:", this.state.commonCodes.length);
                console.log("[App] Common codes loaded:", this.state.commonCodes.length);
            } catch (err) {
                console.error("[App] Failed to load common codes:", err);
                this.state.commonCodes = [];
            }

            console.log("[App] 5. Starting FetchData..."); await this.fetchData(); console.log("[App] 6. Init Finished.");
                this.closeModal();
            }
        });
    },

    async handleFormSubmit(id) {
        const form = document.getElementById('defectForm');
        const submitButton = form.querySelector('button[type="submit"]');
        const payload = this.buildDefectPayload(form, id);

        // Security: String validation
        if (!payload.title || payload.title.length < 5) {
            alert('제목을 5자 이상 입력해주세요.');
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = id ? '저장 중...' : '등록 중...';
        }

        if (await StorageService.saveDefect(payload, id)) {
            localStorage.removeItem('pending_defect');
            alert(id ? '수정되었습니다.' : '등록되었습니다.');
            // 2. Load Common Codes (Added for Phase 3-1)
            try {
                console.log("[App] 3. Fetching Common Codes..."); this.state.commonCodes = await StorageService.fetchCommonCodes(); console.log("[App] 4. Common Codes Loaded:", this.state.commonCodes.length);
                console.log("[App] Common codes loaded:", this.state.commonCodes.length);
            } catch (err) {
                console.error("[App] Failed to load common codes:", err);
                this.state.commonCodes = [];
            }

            console.log("[App] 5. Starting FetchData..."); await this.fetchData(); console.log("[App] 6. Init Finished.");
            this.closeModal();
            if (!id) this.navigate('list');
            return;
        }

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = id ? '수정 완료' : '결함 등록';
        }

        alert(id ? '수정에 실패했습니다. 잠시 후 다시 시도해 주세요.' : '등록에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    },

    showRegisterModal() {
        this.state.currentModal = 'register';
        const modalBody = document.getElementById('modalBody');
        this.renderForm(modalBody, null);
        this.openModal();
    },

    async editDefect(id) {
        this.state.currentModal = 'edit';
        this.state.editingId = id;
        const modalBody = document.getElementById('modalBody');
        try {
            this.state.selectedDefect = await StorageService.getDefectById(id);
        } catch (err) {
            console.error("[App] Failed to load defect detail for edit:", err);
            this.state.selectedDefect = this.getSelectedDefect(id);
        }
        this.renderForm(modalBody, id, this.state.selectedDefect);
        this.openModal();
    },

    async actionDefect(id) {
        this.state.currentModal = 'action';
        this.state.editingId = id;
        const modalBody = document.getElementById('modalBody');
        try {
            this.state.selectedDefect = await StorageService.getDefectById(id);
        } catch (err) {
            console.error("[App] Failed to load defect detail for action:", err);
            this.state.selectedDefect = this.getSelectedDefect(id);
        }
        this.renderActionForm(modalBody, id, this.state.selectedDefect);
        this.openModal();
    },

    openModal() {
        document.getElementById('modalOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    closeModal() {
        if (this.state.isStandalone) {
            window.close();
            return;
        }
        this.state.currentModal = null;
        this.state.selectedDefect = null;
        document.getElementById('modalOverlay').classList.remove('active');
        document.getElementById('modalContent').classList.remove('maximize');
        document.getElementById('maximizeBtn').className = 'fas fa-expand-alt modal-control-btn';
        document.body.style.overflow = '';
    },

    toggleMaximize() {
        const content = document.getElementById('modalContent');
        const btn = document.getElementById('maximizeBtn');
        const isMaximized = content.classList.toggle('maximize');

        if (isMaximized) {
            btn.className = 'fas fa-compress-alt modal-control-btn';
            btn.title = '창 모드로 보기';
        } else {
            btn.className = 'fas fa-expand-alt modal-control-btn';
            btn.title = '전체 화면';
        }
    },

    viewExternal(url) {
        if (!url) return;
        const width = 1200;
        const height = 900;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        const viewer = window.open('', '_blank', `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
        if (!viewer) {
            alert('팝업 차단을 해제해주세요.');
            return;
        }

        const isImage = url.startsWith('data:image') || url.match(/\.(jpeg|jpg|gif|png|webp|svg)/i);

        viewer.document.write(`
            <html>
            <head>
                <title>DefectFlow - Image Viewer</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <style>
                    body { margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; background: #0f172a; color: white; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
                    .header { background: #1e293b; padding: 0.75rem 2rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 10; }
                    .btn { background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.4rem; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }
                    .btn-close { background: #ef4444; }
                    .content { flex: 1; display: flex; align-items: center; justify-content: center; overflow: auto; background: #000; padding: 20px; }
                    iframe { width: 100%; height: 100%; border: none; background: white; }
                    img { max-width: 95%; max-height: 95%; object-fit: contain; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); border-radius: 0.5rem; cursor: zoom-in; transition: all 0.2s; }
                    img.enlarged { max-width: none; max-height: none; cursor: zoom-out; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <i class="fas fa-image" style="color:#3b82f6"></i>
                        <span style="font-weight:700">${isImage ? '관련 이미지 확대 보기' : '관련 페이지 보기'}</span>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <button class="btn" onclick="window.print()"><i class="fas fa-print"></i> 인쇄</button>
                        <button class="btn btn-close" onclick="window.close()"><i class="fas fa-times"></i> 닫기</button>
                    </div>
                </div>
                <div class="content">
                    ${isImage
                ? `<img src="${url}" onclick="this.classList.toggle('enlarged')">`
                : `<iframe src="${url}"></iframe>`}
                </div>
            </body>
            </html>
        `);
        viewer.document.close();
    },

    async deleteDefect(id) {
        if (this.state.currentRole !== '관리자') {
            alert('삭제 권한이 없습니다. 관리자에게 문의하세요.');
            return;
        }
        if (!confirm('정말 삭제하시겠습니까? 데이터는 목록에서 보이지 않게 처리됩니다.')) return;
        if (await StorageService.deleteDefect(id)) {
            alert('삭제 처리되었습니다.');
            this.fetchData();
        }
    },

    /**
     * SECURITY: Input Sanitization (XSS Prevention)
     */
    saveImage(dataUrl, filename) {
        if (!dataUrl || !dataUrl.startsWith('data:')) return;
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename || `defect_screenshot_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    buildDefectPayload(form, id = null) {
        const formData = new FormData(form);
        const currentUserName = this.state.currentUser?.name || null;
        const existing = id ? this.getSelectedDefect(id) || {} : {};

        const value = (key, fallback = '') => {
            const raw = formData.get(key);
            if (raw === null || raw === undefined) return fallback;
            return typeof raw === 'string' ? raw.trim() : raw;
        };

        return {
            test_type: value('test_type', existing.test_type || '단위테스트'),
            title: value('title', existing.title || ''),
            severity: value('severity', existing.severity || 'Minor'),
            priority: value('priority', existing.priority || 'P3'),
            steps_to_repro: value('steps_to_repro', existing.steps_to_repro || ''),
            creator: value('creator', existing.creator || currentUserName || ''),
            assignee: value('assignee', existing.assignee || ''),
            menu_name: value('menu_name', existing.menu_name || ''),
            screen_name: value('screen_name', existing.screen_name || ''),
            screen_url: value('screen_url', existing.screen_url || ''),
            screenshot: value('screenshot', existing.screenshot || ''),
            status: value('status', existing.status || 'Open'),
            defect_identification: value('defect_identification', existing.defect_identification || ''),
            action_comment: value('action_comment', existing.action_comment || ''),
            action_start: value('action_start', existing.action_start || '') || null,
            action_end: value('action_end', existing.action_end || '') || null,
            env_info: value('env_info', existing.env_info || ''),
            updated_by: currentUserName
        };
    },

    calculateStats() {
        this.getFilteredDefects();
    },

    getSelectedDefect(id) {
        return (this.state.defects || []).find(d => String(d.defect_id) === String(id))
            || (this.state.allDefectsSummary || []).find(d => String(d.defect_id) === String(id))
            || null;
    },

    getEffectiveRole() {
        return this.state.currentRole || this.state.currentUser?.role || '테스터';
    },

    canEditAssignee() {
        const role = this.getEffectiveRole();
        return role === '관리자' || role === '조치자';
    },

    sanitize(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function (m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[m];
        });
    }
};

window.addEventListener('DOMContentLoaded', () => App.init());

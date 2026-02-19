/**
 * DefectFlow Core Application Logic
 */

const bcrypt = typeof dcodeIO !== 'undefined' ? dcodeIO.bcrypt : null;

const App = {
    state: {
        currentView: 'dashboard',
        defects: [],
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
                creator: '',
                assignee: '',
                testType: '',
                dateStart: '',
                dateEnd: ''
            }
        },
        settings: {
            enabledTestTypes: ['선오픈', '통합테스트', '단위테스트']
        }
    },

    getFilteredDefects() {
        const types = this.state.settings.enabledTestTypes;
        return this.state.defects.filter(d => types.includes(d.test_type || '단위테스트'));
    },

    handleImageUpload(input) {
        const file = input.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('이미지 파일만 업로드 가능합니다.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Data = e.target.result;

            // Hidden input 업데이트
            const screenshotInput = document.getElementsByName('screenshot')[0];
            if (screenshotInput) {
                screenshotInput.value = base64Data;
            }

            // 미리보기 영역 업데이트 또는 생성
            const previewContainer = document.getElementById('imagePreviewArea');
            if (previewContainer) {
                previewContainer.innerHTML = `<img src="${base64Data}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
                document.getElementById('imagePreviewWrapper').style.display = 'block';
            } else {
                alert('이미지가 선택되었습니다. 등록 시 함께 저장됩니다.');
            }
        };
        reader.readAsDataURL(file);
    },

    async init() {
        console.log("[App] Initializing...");

        // Global Error Logging
        window.onerror = function (message, source, lineno, colno, error) {
            console.error("[Global Error]", { message, source, lineno, colno, error });
        };
        window.onunhandledrejection = function (event) {
            console.error("[Unhandled Rejection]", event.reason);
        };

        try {
            StorageService.init();

            // 1. Session Check
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                this.state.currentUser = JSON.parse(savedUser);
                this.state.isLoggedIn = true;
                this.state.currentRole = this.state.currentUser.role;
            }

            // Load Settings
            const savedSettings = localStorage.getItem('app_settings');
            if (savedSettings) {
                this.state.settings = { ...this.state.settings, ...JSON.parse(savedSettings) };
            }

            this.bindEvents();

            // Check for Standalone Mode (Popup)
            const params = new URLSearchParams(window.location.search);
            this.state.isStandalone = params.get('mode') === 'standalone';

            if (this.state.isStandalone) {
                document.body.classList.add('standalone-mode');
            }

            await this.fetchData();

            // Handle Initial Routing
            if (this.state.isLoggedIn) {
                const hash = window.location.hash.substring(1);
                this.navigate(hash || 'dashboard');
            } else {
                // Save intended hash for post-login redirect
                const hash = window.location.hash.substring(1);
                if (hash && hash !== 'login' && hash !== 'signup') {
                    this.state.returnTo = hash;
                }
                this.navigate('login');
            }

            console.log("[App] Initialization complete");
        } catch (err) {
            console.error("[App] Init failed:", err);
        }
    },

    bindEvents() {
        document.querySelectorAll('.nav-item').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.getAttribute('data-view');
                this.navigate(view);
            });
        });
    },

    async fetchData() {
        console.log("[App] Fetching data from Supabase...");
        try {
            this.state.defects = await StorageService.getDefects();
            this.state.users = await StorageService.getUsers();
            console.log(`[App] Data loaded. Defects: ${this.state.defects.length}, Users: ${this.state.users.length}`);

            this.calculateStats();
            this.render();

            // Handle initial routing after data is ready (if not already handled)
            if (!this.state.initialRouteHandled) {
                const hash = window.location.hash.substring(1);
                if (hash === 'register') {
                    this.showRegisterModal();
                } else if (['dashboard', 'list', 'users'].includes(hash)) {
                    this.navigate(hash);
                }
                this.state.initialRouteHandled = true;
            }

            // Re-render modal if open to populate data (like users list)
            if (this.state.currentModal === 'register') {
                this.showRegisterModal();
            } else if (this.state.currentModal === 'edit') {
                this.editDefect(this.state.editingId);
            }
        } catch (err) {
            console.error("[App] FetchData failed:", err);
        }
    },

    calculateStats() {
        const d = this.getFilteredDefects();
        this.state.stats = {
            total: d.length,
            open: d.filter(x => ['New', 'Open', 'In Progress', 'Reopened'].includes(x.status)).length,
            resolved: d.filter(x => x.status === 'Resolved' || x.status === 'Closed').length,
            critical: d.filter(x => x.severity === 'Critical').length
        };
    },

    navigate(view) {
        if (!view) view = 'dashboard';

        // Authentication Guard
        if (!this.state.isLoggedIn && view !== 'login' && view !== 'signup') {
            this.state.currentView = 'login';
            this.render();
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

        // Admin view check
        const adminViews = ['users', 'settings'];
        if (adminViews.includes(view) && this.state.currentRole !== '관리자') {
            alert('관리자 권한이 필요한 메뉴입니다.');
            this.navigate('dashboard');
            return;
        }

        this.state.currentView = view;
        window.location.hash = view;

        document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
        const navItem = document.querySelector(`[data-view="${view}"]`);
        if (navItem) navItem.classList.add('active');
        this.render();
    },

    render() {
        const root = document.getElementById('app');
        root.innerHTML = '';

        // Sidebar Visibility Check
        this.updateSidebar();

        switch (this.state.currentView) {
            case 'dashboard': this.renderDashboard(root); break;
            case 'list': this.renderList(root); break;
            case 'users': this.renderUsers(root); break;
            case 'settings': this.renderSettings(root); break;
            case 'login': this.renderLogin(root); break;
            case 'signup': this.renderSignup(root); break;
        }
    },

    updateSidebar() {
        const loggedIn = this.state.isLoggedIn;
        const user = this.state.currentUser;

        // Admin Menus
        const adminMenu = document.getElementById('adminOnlyMenus');
        if (adminMenu) {
            adminMenu.style.display = (loggedIn && user.role === '관리자') ? 'block' : 'none';
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

        // Hide Sidebar entirely on Login/Signup pages
        const nav = document.querySelector('nav');
        const isAuthPage = ['login', 'signup'].includes(this.state.currentView);
        if (nav) nav.style.display = isAuthPage ? 'none' : 'flex';
        document.getElementById('app').style.marginLeft = isAuthPage ? '0' : '260px';
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
                    
                    <div style="margin-top: 1.5rem; font-size: 0.875rem; text-align: center;">
                        계정이 없으신가요? <a href="#" onclick="App.navigate('signup')" style="color: var(--accent); font-weight: 600;">회원가입</a>
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
                    if (user.status === '사용중지') {
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
                        이미 계정이 있으신가요? <a href="#" onclick="App.navigate('login')" style="color: var(--accent); font-weight: 600;">로그인</a>
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

    handleLogout() {
        if (confirm('로그아웃 하시겠습니까?')) {
            this.state.isLoggedIn = false;
            this.state.currentUser = null;
            this.state.currentRole = '테스터';
            localStorage.removeItem('currentUser');
            this.navigate('login');
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
                                <td><span class="badge" style="background: ${u.status === '사용' ? '#dcfce7' : '#fee2e2'}; color: ${u.status === '사용' ? '#166534' : '#991b1b'};">${u.status}</span></td>
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
                        <option value="사용" ${user.status === '사용' ? 'selected' : ''}>사용</option>
                        <option value="사용중지" ${user.status === '사용중지' ? 'selected' : ''}>사용중지</option>
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
        if (await StorageService.saveUser(payload, id)) {
            alert(id ? '수정되었습니다.' : '등록되었습니다.');
            this.fetchData();
            this.closeModal();
        }
    },

    renderSettings(container) {
        const types = ['선오픈', '통합테스트', '단위테스트'];
        const enabled = this.state.settings.enabledTestTypes;

        container.innerHTML = `
    < header class="animate-in" >
        <div>
            <h1>환경 설정</h1>
            <p class="subtitle">애플리케이션 운영에 필요한 전역 설정을 관리합니다.</p>
        </div>
            </header >

    <div class="form-container animate-in" style="max-width: 600px;">
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
    </div>
`;

        document.getElementById('settingsForm').onsubmit = (e) => {
            e.preventDefault();
            const checked = Array.from(e.target.querySelectorAll('input[name="testTypes"]:checked')).map(i => i.value);
            if (checked.length === 0) {
                alert('최소 하나 이상의 테스트 구분을 선택해야 합니다.');
                return;
            }
            this.updateSettings({ enabledTestTypes: checked });
        };
    },

    updateSettings(newSettings) {
        this.state.settings = { ...this.state.settings, ...newSettings };
        localStorage.setItem('app_settings', JSON.stringify(this.state.settings));

        // Refresh data and re-render
        this.calculateStats();
        alert('설정이 저장되었습니다.');
        this.render();
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
        const defects = this.getFilteredDefects();
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
                    <div class="stat-value" style="color: var(--warning)">${stats.open}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">조치 완료</div>
                    <div class="stat-value" style="color: var(--success)">${stats.resolved}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">크리티컬</div>
                    <div class="stat-value" style="color: var(--error)">${stats.critical}</div>
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
                .slice(0, 20)
                .map(d => `
                                <tr>
                                    <td><strong class="clickable-link" onclick="App.editDefect(${d.defect_id})">[${(d.test_type || '단위테스트').substring(0, 2)}] ${this.sanitize(d.title)}</strong></td>
                                    <td><span class="badge badge-${d.severity.toLowerCase()}">${d.severity}</span></td>
                                    <td>${d.status}</td>
                                    <td>${this.sanitize(d.creator)}</td>
                                    <td>${this.formatDateKST(d.created_at)}</td>
                                </tr>
                            `).join('') || '<tr><td colspan="5" style="text-align: center; padding: 2rem;">데이터가 없습니다.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
`;

        // Chart.js Initialization (Weighted Stacked Bar)
        const statusCounts = {
            'New': 0, 'Open': 0, 'In Progress': 0, 'Resolved': 0, 'Verified': 0, 'Closed': 0, 'Reopened': 0
        };
        const statusMap = {
            'New': '신규', 'Open': '접수', 'In Progress': '조치 중', 'Resolved': '조치 완료', 'Verified': '검증 완료', 'Closed': '종료', 'Reopened': '재오픈'
        };
        let totalDefects = 0;
        defects.forEach(d => {
            if (statusCounts[d.status] !== undefined) {
                statusCounts[d.status]++;
                totalDefects++;
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
                        const percentage = totalDefects > 0 ? (count / totalDefects * 100).toFixed(1) : 0;
                        const colors = [
                            '#3b82f6', '#fbbf24', '#f59e0b', '#10b981', '#8b5cf6', '#6b7280', '#ef4444'
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
                        const percentage = totalDefects > 0 ? (count / totalDefects * 100).toFixed(1) : 0;
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
        const defects = this.getFilteredDefects();

        // Filtering logic
        let filtered = defects.filter(d => {
            const matchesSeverity = !search.severity || d.severity === search.severity;
            const matchesStatus = !search.status || d.status === search.status;
            const matchesCreator = !search.creator || d.creator.includes(search.creator);
            const matchesAssignee = !search.assignee || (d.assignee && d.assignee.includes(search.assignee));
            const matchesTestType = !search.testType || (d.test_type || '단위테스트') === search.testType;

            let matchesDate = true;
            if (search.dateStart || search.dateEnd) {
                const date = new Date(d.created_at);
                if (search.dateStart) {
                    const startDate = new Date(search.dateStart);
                    startDate.setHours(0, 0, 0, 0); // Start of day KST
                    if (date < startDate) matchesDate = false;
                }
                if (search.dateEnd) {
                    const endDate = new Date(search.dateEnd);
                    endDate.setHours(23, 59, 59, 999); // End of day KST
                    if (date > endDate) matchesDate = false;
                }
            }
            return matchesSeverity && matchesStatus && matchesCreator && matchesAssignee && matchesTestType && matchesDate;
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Pagination logic
        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / config.pageSize);
        const startIndex = (config.page - 1) * config.pageSize;
        const pagedData = filtered.slice(startIndex, startIndex + config.pageSize);

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
                        <select id="searchTestType" onchange="App.handleSearchChange()">
                            <option value="">전체</option>
                            ${this.state.settings.enabledTestTypes.map(t => `
                                <option value="${t}" ${search.testType === t ? 'selected' : ''}>${t}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">심각도</label>
                        <select id="searchSeverity" onchange="App.handleSearchChange()">
                            <option value="">전체</option>
                            <option value="Critical" ${search.severity === 'Critical' ? 'selected' : ''}>Critical</option>
                            <option value="Major" ${search.severity === 'Major' ? 'selected' : ''}>Major</option>
                            <option value="Minor" ${search.severity === 'Minor' ? 'selected' : ''}>Minor</option>
                            <option value="Simple" ${search.severity === 'Simple' ? 'selected' : ''}>Simple</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">상태</label>
                        <select id="searchStatus" onchange="App.handleSearchChange()">
                            <option value="">전체</option>
                            <option value="New" ${search.status === 'New' ? 'selected' : ''}>New</option>
                            <option value="Open" ${search.status === 'Open' ? 'selected' : ''}>Open</option>
                            <option value="In Progress" ${search.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Resolved" ${search.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                            <option value="Verified" ${search.status === 'Verified' ? 'selected' : ''}>Verified</option>
                            <option value="Closed" ${search.status === 'Closed' ? 'selected' : ''}>Closed</option>
                            <option value="Reopened" ${search.status === 'Reopened' ? 'selected' : ''}>Reopened</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">등록자</label>
                        <input type="text" id="searchCreator" value="${search.creator}" oninput="App.handleSearchChange()" placeholder="이름 검색">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">담당자</label>
                        <input type="text" id="searchAssignee" value="${search.assignee}" oninput="App.handleSearchChange()" placeholder="이름 검색">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">등록기간 (시작)</label>
                        <input type="date" id="searchDateStart" value="${search.dateStart}" onchange="App.handleSearchChange()">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">등록기간 (종료)</label>
                        <input type="date" id="searchDateEnd" value="${search.dateEnd}" onchange="App.handleSearchChange()">
                    </div>
                    <button class="btn" onclick="App.resetFilters()" style="background: var(--bg-secondary); border: 1px solid var(--border);">초기화</button>
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
                    </select>
                </div>
            </div>

            <div class="data-table-container animate-in">
                <table style="min-width: 1400px;">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>결함명</th>
                            <th>심각도</th>
                            <th>우선순위</th>
                            <th>상태</th>
                            <th>메뉴/화면명</th>
                            <th>등록자</th>
                            <th>담당자</th>
                            <th>등록일</th>
                            <th>수정일</th>
                            <th>조치 시작/종료</th>
                            <th>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pagedData.map(d => `
                            <tr>
                                <td>#${d.defect_id}</td>
                                <td style="max-width:300px; white-space:normal;">
                                    <strong class="clickable-link" onclick="App.editDefect(${d.defect_id})">[${(d.test_type || '단위테스트').substring(0, 2)}] ${this.sanitize(d.title)}</strong>
                                </td>
                                <td><span class="badge badge-${d.severity.toLowerCase()}">${d.severity}</span></td>
                                <td>${d.priority}</td>
                                <td>${d.status}</td>
                                <td>${this.sanitize(d.menu_name || '-')}/${this.sanitize(d.screen_name || '-')}</td>
                                <td>${this.sanitize(d.creator || '-')}</td>
                                <td>${this.sanitize(d.assignee || '-')}</td>
                                <td>${this.formatDateKST(d.created_at)}</td>
                                <td>${(d.updated_at && d.updated_at !== d.created_at) ? this.formatDateKST(d.updated_at) : '-'}</td>
                                <td>${this.formatDateKST(d.action_start, false)}<br>${this.formatDateKST(d.action_end, false)}</td>
                                <td>
                                    <div style="display:flex; gap:0.5rem;">
                                        <button class="btn" style="padding: 0.4rem; color: var(--info)" title="조치 결과 입력" onclick="App.actionDefect(${d.defect_id})"><i class="fas fa-tools"></i> 조치</button>
                                        <button class="btn" style="padding: 0.4rem; color: var(--accent)" onclick="App.editDefect(${d.defect_id})"><i class="fas fa-edit"></i></button>
                                        <button class="btn" style="padding: 0.4rem; color: var(--error)" onclick="App.deleteDefect(${d.defect_id})"><i class="fas fa-trash"></i></button>
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

    handleSearchChange() {
        this.state.listConfig.search = {
            severity: document.getElementById('searchSeverity').value,
            status: document.getElementById('searchStatus').value,
            creator: document.getElementById('searchCreator').value,
            assignee: document.getElementById('searchAssignee').value,
            testType: document.getElementById('searchTestType').value,
            dateStart: document.getElementById('searchDateStart').value,
            dateEnd: document.getElementById('searchDateEnd').value
        };
        this.state.listConfig.page = 1; // Reset to first page on search
        this.render();
    },

    resetFilters() {
        this.state.listConfig.search = {
            severity: '',
            status: '',
            creator: '',
            assignee: '',
            testType: '',
            dateStart: '',
            dateEnd: ''
        };
        this.state.listConfig.page = 1;
        this.render();
    },

    handlePageSizeChange() {
        this.state.listConfig.pageSize = parseInt(document.getElementById('pageSizeSelect').value);
        this.state.listConfig.page = 1;
        this.render();
    },

    changePage(p) {
        this.state.listConfig.page = p;
        this.render();
    },

    downloadExcel() {
        const defects = this.state.defects;
        if (defects.length === 0) {
            alert('다운로드할 데이터가 없습니다.');
            return;
        }

        const headers = ['ID', '구분', '제목', '심각도', '우선순위', '상태', '메뉴명', '화면명', '등록자', '담당자', '등록일', '수정일'];
        const csvRows = [headers.join(',')];

        defects.forEach(d => {
            const row = [
                d.defect_id,
                d.test_type || '단위테스트',
                `"${(d.title || '').replace(/"/g, '""')}"`,
                d.severity,
                d.priority,
                d.status,
                `"${(d.menu_name || '').replace(/"/g, '""')}"`,
                `"${(d.screen_name || '').replace(/"/g, '""')}"`,
                d.creator,
                d.assignee || '',
                this.formatDateKST(d.created_at),
                d.updated_at ? this.formatDateKST(d.updated_at) : ''
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = "\ufeff" + csvRows.join('\n'); // Add BOM for Excel UTF-8 support
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
    },

    truncate(str, len) {
        if (!str) return '-';
        return str.length > len ? str.substring(0, len) + '...' : str;
    },

    renderForm(container, id = null) {
        let item = id ? this.state.defects.find(x => x.defect_id === id) : {};

        // Handle pending data from Test Bench (for new defects)
        if (!id) {
            const pending = localStorage.getItem('pending_defect');
            if (pending) {
                try {
                    const data = JSON.parse(pending);
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
                    console.log("[App] Pending defect data consumed from localStorage");
                } catch (e) {
                    console.error("[App] Failed to parse pending_defect:", e);
                    localStorage.removeItem('pending_defect');
                }
            }
        }

        const title = id ? '결함 정보 관리' : '신규 결함 등록';

        container.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h1>${title}</h1>
                <p class="subtitle">보안 강화된 입력 폼을 통해 결함을 상세 기록하세요.</p>
            </div>

            <div class="${id ? '' : 'form-container animate-in'}">
                <form id="defectForm">
                    <div class="form-group">
                        <label>테스트 구분</label>
                        <select name="test_type">
                            ${this.state.settings.enabledTestTypes.map(t => `
                                <option value="${t}" ${item.test_type === t ? 'selected' : ((!item.test_type && t === '단위테스트') ? 'selected' : '')}>${t}</option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>결함 제목 (필수)</label>
                        <input type="text" name="title" value="${this.sanitize(item.title || '')}" required placeholder="간결하고 명확한 제목을 입력하세요">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="form-group">
                            <label>심각도 ${this.state.currentRole !== '관리자' ? '<span style="color: var(--error); font-size: 0.7rem;">(관리자 외 수정 불가)</span>' : ''}</label>
                                <select name="severity" ${this.state.currentRole !== '관리자' ? 'disabled' : ''}>
                                    <option value="Critical" ${item.severity === 'Critical' ? 'selected' : ''}>Critical</option>
                                    <option value="Major" ${item.severity === 'Major' ? 'selected' : ''}>Major</option>
                                    <option value="Minor" ${item.severity === 'Minor' ? 'selected' : (item.severity ? '' : 'selected')}>Minor</option>
                                    <option value="Simple" ${item.severity === 'Simple' ? 'selected' : ''}>Simple</option>
                                </select>
                                ${this.state.currentRole !== '관리자' ? `<input type="hidden" name="severity" value="${item.severity || 'Minor'}">` : ''}
                        </div>
                        <div class="form-group">
                            <label>우선순위 ${this.state.currentRole !== '관리자' ? '<span style="color: var(--error); font-size: 0.7rem;">(관리자 외 수정 불가)</span>' : ''}</label>
                            <select name="priority" ${this.state.currentRole !== '관리자' ? 'disabled' : ''}>
                                <option value="P1" ${item.priority === 'P1' ? 'selected' : ''}>P1 (Urgent)</option>
                                <option value="P2" ${item.priority === 'P2' ? 'selected' : ''}>P2 (High)</option>
                                <option value="P3" ${item.priority === 'P3' ? 'selected' : 'selected'}>P3 (Normal)</option>
                                <option value="P4" ${item.priority === 'P4' ? 'selected' : ''}>P4 (Low)</option>
                            </select>
                            ${this.state.currentRole !== '관리자' ? `<input type="hidden" name="priority" value="${item.priority || 'P3'}">` : ''}
                        </div>
                    </div>

                    <div class="form-group">
                        <label>재현 단계 (Steps to Reproduce)</label>
                        <textarea name="steps_to_repro" rows="4" placeholder="1. 로그인 페이지 접속&#10;2. 아이디 입력...">${this.sanitize(item.steps_to_repro || '')}</textarea>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="form-group">
                            <label>등록자 (테스터) (필수)</label>
                            <select name="creator" required>
                                <option value="">선택하세요</option>
                                ${this.state.users.filter(u => u.status === '사용').map(u => `
                                    <option value="${this.sanitize(u.name)}" ${(item.creator || this.state.currentUser.name) === u.name ? 'selected' : ''}>${this.sanitize(u.name)} (${u.department})</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>담당자 (조치자)</label>
                            <select name="assignee">
                                <option value="">선택 안함</option>
                                ${this.state.users.filter(u => u.status === '사용' && u.role === '조치자').map(u => `
                                    <option value="${this.sanitize(u.name)}" ${item.assignee === u.name ? 'selected' : ''}>${this.sanitize(u.name)} (${u.department})</option>
                                `).join('')}
                            </select>
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

                    <div class="form-group">
                        <label>변경할 상태</label>
                        <select name="status">
                            <option value="New" ${item.status === 'New' ? 'selected' : ''}>New (신규)</option>
                            <option value="Open" ${item.status === 'Open' ? 'selected' : ''}>Open (접수)</option>
                            <option value="In Progress" ${item.status === 'In Progress' ? 'selected' : ''}>In Progress (조치 중)</option>
                            <option value="Resolved" ${item.status === 'Resolved' ? 'selected' : ''}>Resolved (조치 완료)</option>
                            <option value="Verified" ${item.status === 'Verified' ? 'selected' : ''}>Verified (검증 완료)</option>
                            <option value="Closed" ${item.status === 'Closed' ? 'selected' : ''}>Closed (종료)</option>
                            <option value="Reopened" ${item.status === 'Reopened' ? 'selected' : ''}>Reopened (재오픈)</option>
                        </select>
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

    renderActionForm(container, id) {
        const item = this.state.defects.find(x => x.defect_id === id) || {};
        container.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h1>결함 조치 결과 입력</h1>
                <p class="subtitle">#${id} - ${this.sanitize(item.title)}</p>
            </div>

            <form id="actionForm">
                <div class="form-group">
                    <label>조치자 (Assignee)</label>
                    <input type="text" name="assignee" value="${this.sanitize(item.assignee || this.state.currentUser.name)}" required placeholder="조치 담당자 이름을 입력하세요">
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

                <div class="form-group">
                    <label>변경할 상태</label>
                    <select name="status">
                        <option value="In Progress" ${item.status === 'In Progress' ? 'selected' : ''}>In Progress (조치 중)</option>
                        <option value="Resolved" ${item.status === 'Resolved' ? 'selected' : ''}>Resolved (조치 완료)</option>
                        <option value="Closed" ${item.status === 'Closed' ? 'selected' : ''}>Closed (종료)</option>
                    </select>
                </div>

                <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
                    <button type="button" class="btn" style="background: rgba(255,255,255,0.05)" onclick="App.closeModal()">취소</button>
                    <button type="submit" class="btn btn-primary" style="background: var(--info)">조치 결과 저장</button>
                </div>
            </form>
        `;

        document.getElementById('actionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const payload = Object.fromEntries(formData.entries());

            if (await StorageService.saveDefect(payload, id)) {
                alert('조치 결과가 저장되었습니다.');
                this.fetchData();
                this.closeModal();
            }
        });
    },

    async handleFormSubmit(id) {
        const form = document.getElementById('defectForm');
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        // Security: String validation
        if (!payload.title || payload.title.length < 5) {
            alert('제목을 5자 이상 입력해주세요.');
            return;
        }

        if (await StorageService.saveDefect(payload, id)) {
            localStorage.removeItem('pending_defect');
            alert(id ? '수정되었습니다.' : '등록되었습니다.');
            this.fetchData();
            this.closeModal();
            if (!id) this.navigate('list');
        }
    },

    showRegisterModal() {
        this.state.currentModal = 'register';
        const modalBody = document.getElementById('modalBody');
        this.renderForm(modalBody, null);
        this.openModal();
    },

    editDefect(id) {
        this.state.currentModal = 'edit';
        this.state.editingId = id;
        const modalBody = document.getElementById('modalBody');
        this.renderForm(modalBody, id);
        this.openModal();
    },

    actionDefect(id) {
        this.state.currentModal = 'action';
        this.state.editingId = id;
        const modalBody = document.getElementById('modalBody');
        this.renderActionForm(modalBody, id);
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
        if (!confirm('정말 삭제하시겠습니까?')) return;
        if (await StorageService.deleteDefect(id)) {
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

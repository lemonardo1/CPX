class CPXApp {
    constructor() {
        this.timer = null;
        this.timeLeft = 12 * 60; // 12분
        this.isRunning = false;
        this.currentCase = null;
        this.checklists = {};
        this.sessions = [];
        // 제목 변경/표기 차이에 대응하기 위한 별칭 매핑
        this.titleAliases = {
            '배뇨 이상 (배뇨통)': '배뇨 이상',
            '소변량 증가(다뇨증)': '소변량 변화(다뇨증/핍뇨)'
        };
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderCommonChecklist();
        this.renderCaseSelect();
        this.updateTimerDisplay();
        this.handleUrlParams();
    }

    async loadData() {
        try {
            // 증례 데이터 로드
            const casesResponse = await fetch('data/cases.json');
            if (!casesResponse.ok) {
                throw new Error(`HTTP error! status: ${casesResponse.status}`);
            }
            this.cases = await casesResponse.json();
            console.log('증례 데이터 로드 완료:', this.cases);
            
            // 체크리스트 데이터 로드
            const checklistsResponse = await fetch('data/checklists.json');
            if (!checklistsResponse.ok) {
                throw new Error(`HTTP error! status: ${checklistsResponse.status}`);
            }
            this.checklistData = await checklistsResponse.json();
            console.log('체크리스트 데이터 로드 완료:', this.checklistData);
            this.buildChecklistIndexes();
            
            // 세션 데이터 로드
            const sessionsResponse = await fetch('data/sessions.json');
            if (!sessionsResponse.ok) {
                throw new Error(`HTTP error! status: ${sessionsResponse.status}`);
            }
            this.sessions = await sessionsResponse.json();
            console.log('세션 데이터 로드 완료:', this.sessions);
        } catch (error) {
            console.error('데이터 로드 실패:', error);
            // 기본값 설정
            this.cases = { cases: [] };
            this.checklistData = {};
            this.sessions = [];
        }
    }

    setupEventListeners() {
        // 타이머 컨트롤
        document.getElementById('startBtn').addEventListener('click', () => this.startTimer());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pauseTimer());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetTimer());
        document.getElementById('evaluateBtn').addEventListener('click', () => this.evaluateNotes());
        document.getElementById('finishBtn').addEventListener('click', () => this.showScoreModal());

        // 증례 선택
        document.getElementById('caseSelect').addEventListener('change', (e) => this.selectCase(e.target.value));

        // 체크리스트 전체 토글 버튼들
        const checkAllBtn = document.getElementById('checkAllBtn');
        const uncheckAllBtn = document.getElementById('uncheckAllBtn');
        const checkAllCaseBtn = document.getElementById('checkAllCaseBtn');
        const uncheckAllCaseBtn = document.getElementById('uncheckAllCaseBtn');

        if (checkAllBtn) checkAllBtn.addEventListener('click', () => this.setCommonChecklist(true));
        if (uncheckAllBtn) uncheckAllBtn.addEventListener('click', () => this.setCommonChecklist(false));
        if (checkAllCaseBtn) checkAllCaseBtn.addEventListener('click', () => this.setCaseChecklists(true));
        if (uncheckAllCaseBtn) uncheckAllCaseBtn.addEventListener('click', () => this.setCaseChecklists(false));

        // 관리 버튼 클릭 이벤트 (사이드바)
        document.getElementById('adminBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.goToAdmin();
        });

        // 점수 입력 모달 이벤트
        this.setupScoreModalEvents();

        // 키보드 단축키
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.isRunning) {
                    this.pauseTimer();
                } else {
                    this.startTimer();
                }
            } else if (e.key === 'r' || e.key === 'R') {
                this.resetTimer();
            }
        });
    }

    async evaluateNotes() {
        if (!this.currentCase) {
            alert('증례를 먼저 선택하세요.');
            return;
        }

        const notes = document.getElementById('sessionNotes').value.trim();
        if (!notes) {
            alert('시험 기록에 텍스트를 입력하세요.');
            return;
        }

        const evaluateBtn = document.getElementById('evaluateBtn');
        const btnTextEl = evaluateBtn.querySelector('.btn-text');
        const originalText = btnTextEl ? btnTextEl.textContent : evaluateBtn.textContent;

        try {
            // 로딩 상태 시작
            evaluateBtn.classList.add('is-loading');
            evaluateBtn.setAttribute('aria-busy', 'true');
            evaluateBtn.disabled = true;
            if (btnTextEl) btnTextEl.textContent = '평가 중...';

            const res = await fetch('/api/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    caseId: this.currentCase.id,
                    caseTitle: this.currentCase.title,
                    notes
                })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            // data format: { common: string[], interview: string[], pe: string[], ddx?: string[], plan?: string[] }
            this.applyEvaluatedChecks(data);
            alert('평가 결과가 반영되었습니다.');
        } catch (err) {
            console.error('평가 실패:', err);
            alert('평가 중 오류가 발생했습니다. 서버 로그를 확인해주세요.');
        } finally {
            // 로딩 상태 종료
            evaluateBtn.classList.remove('is-loading');
            evaluateBtn.removeAttribute('aria-busy');
            evaluateBtn.disabled = false;
            if (btnTextEl) btnTextEl.textContent = originalText;
        }
    }

    applyEvaluatedChecks(result) {
        // 공통 체크리스트
        if (result.common && Array.isArray(result.common)) {
            result.common.forEach(label => {
                const checkbox = document.querySelector(`#commonChecklist input[data-label="${label}"]`);
                const item = checkbox?.closest('.checklist-item');
                if (checkbox && item) {
                    checkbox.checked = true;
                    item.classList.add('checked');
                    this.updateChecklist('common', label, true);
                }
            });
        }

        // 문진
        if (result.interview && Array.isArray(result.interview)) {
            result.interview.forEach(label => {
                const checkbox = Array.from(document.querySelectorAll('#interviewChecklist input[type="checkbox"]'))
                    .find(input => input.getAttribute('data-label') === label);
                const item = checkbox?.closest('.interview-item');
                if (checkbox && item) {
                    checkbox.checked = true;
                    item.classList.add('checked');
                    this.updateChecklist('interview', label, true);
                }
            });
        }

        // P/E
        if (result.pe && Array.isArray(result.pe)) {
            result.pe.forEach(label => {
                const checkbox = Array.from(document.querySelectorAll('#peChecklist input[type="checkbox"]'))
                    .find(input => input.getAttribute('data-label') === label);
                const item = checkbox?.closest('.checklist-item');
                if (checkbox && item) {
                    checkbox.checked = true;
                    item.classList.add('checked');
                    this.updateChecklist('pe', label, true);
                }
            });
        }
    }

    renderCommonChecklist() {
        const commonLabels = ['O', 'L', 'D', 'Co', 'Ex', 'C', 'A', 'F', 'E', '외', '과', '약', '사', '가', '여'];
        const container = document.getElementById('commonChecklist');
        
        container.innerHTML = '';
        commonLabels.forEach(label => {
            const item = document.createElement('div');
            item.className = 'checklist-item';
            item.innerHTML = `
                <input type="checkbox" id="common_${label}" data-label="${label}">
                <span>${label}</span>
            `;
            
            item.addEventListener('click', () => {
                const checkbox = item.querySelector('input');
                checkbox.checked = !checkbox.checked;
                item.classList.toggle('checked', checkbox.checked);
                this.updateChecklist('common', label, checkbox.checked);
            });
            
            container.appendChild(item);
        });
    }

    renderCaseSelect() {
        const select = document.getElementById('caseSelect');
        
        // 데이터가 로드되지 않았을 경우 처리
        if (!this.cases || !this.cases.cases) {
            console.error('증례 데이터가 로드되지 않았습니다.');
            select.innerHTML = '<option value="">데이터 로드 중...</option>';
            return;
        }
        
        const categories = [...new Set(this.cases.cases.map(c => c.category))];
        
        select.innerHTML = '<option value="">증례를 선택하세요</option>';
        
        categories.forEach(category => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = category;
            
            const categoryCases = this.cases.cases.filter(c => c.category === category);
            categoryCases.forEach(caseItem => {
                const option = document.createElement('option');
                option.value = caseItem.id;
                option.textContent = `${caseItem.id}. ${caseItem.title}`;
                optgroup.appendChild(option);
            });
            
            select.appendChild(optgroup);
        });
        
        console.log('증례 선택 옵션이 생성되었습니다:', this.cases.cases.length, '개');
    }

    selectCase(caseId) {
        if (!caseId) {
            this.currentCase = null;
            this.hideCaseSections();
            return;
        }

        this.currentCase = this.cases.cases.find(c => c.id == caseId);
        
        // 체크리스트 상태 초기화
        this.clearAllChecklists();
        
        // 새로운 증례의 체크리스트 렌더링
        this.renderCaseChecklist();
        this.showCaseSections();
    }

    renderCaseChecklist() {
        if (!this.currentCase) return;

        const caseTitle = this.currentCase.title;
        const resolvedKey = this.findChecklistKeyForTitle(caseTitle);
        const caseData = resolvedKey ? this.checklistData[resolvedKey] : null;
        
        if (!caseData) {
            this.showNoChecklistMessage();
            return;
        }

        // 문진 체크리스트
        this.renderInterviewChecklist(caseData.문진 || []);
        
        // P/E 체크리스트
        this.renderPEChecklist(caseData.PE || []);
        
        // 감별진단
        this.renderDDx(caseData.감별진단 || []);
        
        // Plan
        this.renderPlan(caseData.Plan || []);
    }

    // 제목 매칭 유틸리티
    buildChecklistIndexes() {
        this._checklistKeys = Object.keys(this.checklistData || {});
        this._checklistKeysNoParen = this._checklistKeys.map(k => this.stripParentheses(k).trim());
        this._checklistKeysNormalized = this._checklistKeys.map(k => this.normalize(this.stripParentheses(k)));
    }

    stripParentheses(text) {
        if (!text) return '';
        return text.replace(/\s*[\(\[\{（［｛].*?[\)\]\}）］｝]\s*/g, '');
    }

    normalize(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .replace(/[^\p{Letter}\p{Number}]/gu, '');
    }

    findChecklistKeyForTitle(title) {
        if (!this.checklistData) return null;

        // 정확 일치
        if (this.checklistData[title]) return title;

        // 별칭 매핑
        const alias = this.titleAliases[title];
        if (alias && this.checklistData[alias]) return alias;

        // 괄호 제거 후 정확 일치
        const titleNoParen = this.stripParentheses(title).trim();
        const idxNoParen = this._checklistKeys.findIndex(k => this.stripParentheses(k).trim() === titleNoParen);
        if (idxNoParen !== -1) return this._checklistKeys[idxNoParen];

        // 정규화 후 정확 일치
        const normalized = this.normalize(titleNoParen);
        const idxNorm = this._checklistKeysNormalized.findIndex(k => k === normalized);
        if (idxNorm !== -1) return this._checklistKeys[idxNorm];

        // 포함 관계 후보 (가장 긴 키 우선)
        const candidates = [];
        this._checklistKeys.forEach((key, i) => {
            const keyNorm = this._checklistKeysNormalized[i];
            if (keyNorm.includes(normalized) || normalized.includes(keyNorm)) {
                candidates.push(key);
            }
        });
        if (candidates.length > 0) {
            candidates.sort((a, b) => b.length - a.length);
            return candidates[0];
        }

        console.warn('[체크리스트 키 매칭 실패]', title);
        return null;
    }

    showNoChecklistMessage() {
        // 문진 체크리스트 영역에 메시지 표시
        const interviewContainer = document.getElementById('interviewChecklist');
        interviewContainer.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 20px; font-style: italic;">이 증례에 대한 체크리스트가 아직 준비되지 않았습니다.</div>';
        
        // P/E 체크리스트 영역 비우기
        const peContainer = document.getElementById('peChecklist');
        peContainer.innerHTML = '';
        
        // 감별진단 영역 비우기
        const ddxContainer = document.getElementById('ddxList');
        ddxContainer.innerHTML = '';
        
        // Plan 영역 비우기
        const planContainer = document.getElementById('planList');
        planContainer.innerHTML = '';
        
        // 섹션은 표시하되 내용이 없다는 것을 알려줌
        this.showCaseSections();
    }

    renderInterviewChecklist(items) {
        const container = document.getElementById('interviewChecklist');
        container.innerHTML = '';
        
        if (!items || items.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 10px; font-style: italic;">문진 체크리스트가 없습니다.</div>';
            return;
        }
        
        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'interview-item';
            div.innerHTML = `
                <input type="checkbox" id="interview_${index}" data-label="${item}">
                <span>${item}</span>
            `;
            
            div.addEventListener('click', () => {
                const checkbox = div.querySelector('input');
                checkbox.checked = !checkbox.checked;
                div.classList.toggle('checked', checkbox.checked);
                this.updateChecklist('interview', item, checkbox.checked);
            });
            
            container.appendChild(div);
        });
    }

    renderPEChecklist(items) {
        const container = document.getElementById('peChecklist');
        container.innerHTML = '';
        
        if (!items || items.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 10px; font-style: italic;">P/E 체크리스트가 없습니다.</div>';
            return;
        }
        
        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'checklist-item';
            div.innerHTML = `
                <input type="checkbox" id="pe_${index}" data-label="${item}">
                <span>${item}</span>
            `;
            
            div.addEventListener('click', () => {
                const checkbox = div.querySelector('input');
                checkbox.checked = !checkbox.checked;
                div.classList.toggle('checked', checkbox.checked);
                this.updateChecklist('pe', item, checkbox.checked);
            });
            
            container.appendChild(div);
        });
    }

    renderDDx(items) {
        const container = document.getElementById('ddxList');
        container.innerHTML = '';
        
        if (!items || items.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 10px; font-style: italic;">감별진단이 없습니다.</div>';
            return;
        }
        
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'ddx-item';
            div.textContent = item;
            container.appendChild(div);
        });
    }

    renderPlan(items) {
        const container = document.getElementById('planList');
        container.innerHTML = '';
        
        if (!items || items.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 10px; font-style: italic;">Plan이 없습니다.</div>';
            return;
        }
        
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'plan-item';
            div.textContent = item;
            container.appendChild(div);
        });
    }

    showCaseSections() {
        document.getElementById('caseChecklistSection').style.display = 'block';
        document.getElementById('ddxPlanSection').style.display = 'block';
    }

    hideCaseSections() {
        document.getElementById('caseChecklistSection').style.display = 'none';
        document.getElementById('ddxPlanSection').style.display = 'none';
    }

    updateChecklist(type, label, checked) {
        if (!this.checklists[type]) {
            this.checklists[type] = {};
        }
        this.checklists[type][label] = checked;
    }

    startTimer() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            if (this.timeLeft <= 0) {
                this.completeTimer();
            }
        }, 1000);
        
        this.updateButtonStates();
    }

    pauseTimer() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        clearInterval(this.timer);
        this.updateButtonStates();
    }

    resetTimer() {
        this.isRunning = false;
        clearInterval(this.timer);
        this.timeLeft = 12 * 60;
        this.updateTimerDisplay();
        this.updateButtonStates();
        this.clearAllChecklists();
        
        // 시험 기록 텍스트 영역 초기화
        document.getElementById('sessionNotes').value = '';
    }

    completeTimer() {
        this.isRunning = false;
        clearInterval(this.timer);
        this.updateButtonStates();
        
        const timerElement = document.getElementById('timer');
        timerElement.classList.add('completed');
        timerElement.textContent = '완료!';
        
        // 완료 알림
        this.playBeep();
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        document.getElementById('timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updateButtonStates() {
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        
        startBtn.disabled = this.isRunning;
        pauseBtn.disabled = !this.isRunning;
    }

    clearAllChecklists() {
        // 공통 체크리스트 초기화
        document.querySelectorAll('#commonChecklist input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        document.querySelectorAll('#commonChecklist .checklist-item').forEach(item => {
            item.classList.remove('checked');
        });
        
        // 증례별 체크리스트 초기화
        document.querySelectorAll('#interviewChecklist input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        document.querySelectorAll('#interviewChecklist .interview-item').forEach(item => {
            item.classList.remove('checked');
        });
        
        document.querySelectorAll('#peChecklist input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        document.querySelectorAll('#peChecklist .checklist-item').forEach(item => {
            item.classList.remove('checked');
        });
        
        // 체크리스트 상태 초기화
        this.checklists = {};
    }

    setCommonChecklist(checked) {
        document.querySelectorAll('#commonChecklist input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = checked;
            const item = checkbox.closest('.checklist-item');
            if (item) item.classList.toggle('checked', checked);
            const label = checkbox.getAttribute('data-label');
            this.updateChecklist('common', label, checked);
        });
    }

    setCaseChecklists(checked) {
        // 문진
        document.querySelectorAll('#interviewChecklist input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = checked;
            const item = checkbox.closest('.interview-item');
            if (item) item.classList.toggle('checked', checked);
            const label = checkbox.getAttribute('data-label');
            this.updateChecklist('interview', label, checked);
        });

        // P/E
        document.querySelectorAll('#peChecklist input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = checked;
            const item = checkbox.closest('.checklist-item');
            if (item) item.classList.toggle('checked', checked);
            const label = checkbox.getAttribute('data-label');
            this.updateChecklist('pe', label, checked);
        });
    }

    setupScoreModalEvents() {
        const scoreInput = document.getElementById('scoreInput');
        const scoreSlider = document.getElementById('scoreSlider');
        const scoreDisplay = document.getElementById('scoreDisplay');
        const saveScoreBtn = document.getElementById('saveScoreBtn');
        const cancelScoreBtn = document.getElementById('cancelScoreBtn');

        // 슬라이더와 입력 필드 동기화
        scoreSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            scoreInput.value = value;
            scoreDisplay.textContent = `${value}점`;
        });

        scoreInput.addEventListener('input', (e) => {
            let value = parseInt(e.target.value);
            if (isNaN(value) || value < 0) value = 0;
            if (value > 100) value = 100;
            
            scoreInput.value = value;
            scoreSlider.value = value;
            scoreDisplay.textContent = `${value}점`;
        });

        // 저장 버튼
        saveScoreBtn.addEventListener('click', () => {
            const score = parseInt(scoreInput.value) || 0;
            this.finishSession(score);
        });

        // 취소 버튼
        cancelScoreBtn.addEventListener('click', () => {
            this.hideScoreModal();
        });

        // 모달 외부 클릭 시 닫기
        document.getElementById('scoreModal').addEventListener('click', (e) => {
            if (e.target.id === 'scoreModal') {
                this.hideScoreModal();
            }
        });

        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('scoreModal').style.display !== 'none') {
                this.hideScoreModal();
            }
        });
    }

    showScoreModal() {
        if (this.isRunning) {
            this.pauseTimer();
        }
        
        // 자동 기본 점수 계산 (체크된 수/전체 수 * 100)
        const { checked, total } = this.getChecklistCounts();
        const autoScore = total > 0 ? Math.round((checked / total) * 100) : 0;

        // 모달 초기화 및 기본값 설정
        document.getElementById('scoreInput').value = autoScore;
        document.getElementById('scoreSlider').value = autoScore;
        document.getElementById('scoreDisplay').textContent = `${autoScore}점`;
        
        // 모달 표시
        document.getElementById('scoreModal').style.display = 'flex';
        
        // 입력 필드에 포커스
        setTimeout(() => {
            document.getElementById('scoreInput').focus();
        }, 100);
    }

    hideScoreModal() {
        document.getElementById('scoreModal').style.display = 'none';
    }

    async finishSession(score = null) {
        // 시험 기록 가져오기
        const sessionNotes = document.getElementById('sessionNotes').value.trim();
        
        const session = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            caseId: this.currentCase?.id,
            caseTitle: this.currentCase?.title,
            timeUsed: 12 * 60 - this.timeLeft,
            checklists: this.checklists,
            notes: sessionNotes || null,
            score: score
        };
        
        this.sessions.push(session);
        
        // 서버에 저장
        try {
            await fetch('/api/sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(session)
            });
        } catch (error) {
            console.error('세션 저장 실패:', error);
        }
        
        this.hideScoreModal();
        alert(`세션이 저장되었습니다!${score !== null ? ` (점수: ${score}점)` : ''}`);
        this.resetTimer();
    }

    getChecklistCounts() {
        const commonBoxes = Array.from(document.querySelectorAll('#commonChecklist input[type="checkbox"]'));
        const interviewBoxes = Array.from(document.querySelectorAll('#interviewChecklist input[type="checkbox"]'));
        const peBoxes = Array.from(document.querySelectorAll('#peChecklist input[type="checkbox"]'));

        const all = [...commonBoxes, ...interviewBoxes, ...peBoxes];
        const total = all.length;
        const checked = all.filter(cb => cb.checked).length;

        return { checked, total };
    }

    handleUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const caseId = urlParams.get('caseId');
        
        if (caseId) {
            // URL에서 증례 ID를 받았으면 해당 증례를 선택
            const caseSelect = document.getElementById('caseSelect');
            caseSelect.value = caseId;
            this.selectCase(caseId);
        }
    }

    goToAdmin() {
        // 현재 선택된 증례가 있으면 URL 파라미터로 전달
        if (this.currentCase) {
            const url = `admin.html?caseId=${this.currentCase.id}`;
            window.location.href = url;
        } else {
            // 증례가 선택되지 않았으면 일반 관리 페이지로 이동
            window.location.href = 'admin.html';
        }
    }

    playBeep() {
        // 간단한 비프음 생성
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    new CPXApp();
});

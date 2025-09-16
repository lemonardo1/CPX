class CPXApp {
    constructor() {
        this.timer = null;
        this.timeLeft = 12 * 60; // 12분
        this.isRunning = false;
        this.currentCase = null;
        this.checklists = {};
        this.sessions = [];
        
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
        document.getElementById('finishBtn').addEventListener('click', () => this.finishSession());

        // 증례 선택
        document.getElementById('caseSelect').addEventListener('change', (e) => this.selectCase(e.target.value));

        // 관리 버튼 클릭 이벤트 (사이드바)
        document.getElementById('adminBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.goToAdmin();
        });

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
        this.renderCaseChecklist();
        this.showCaseSections();
    }

    renderCaseChecklist() {
        if (!this.currentCase) return;

        const caseTitle = this.currentCase.title;
        const caseData = this.checklistData[caseTitle];
        
        if (!caseData) {
            this.hideCaseSections();
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

    renderInterviewChecklist(items) {
        const container = document.getElementById('interviewChecklist');
        container.innerHTML = '';
        
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
        
        this.checklists = {};
    }

    async finishSession() {
        if (this.isRunning) {
            this.pauseTimer();
        }
        
        const session = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            caseId: this.currentCase?.id,
            caseTitle: this.currentCase?.title,
            timeUsed: 12 * 60 - this.timeLeft,
            checklists: this.checklists
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
        
        alert('세션이 저장되었습니다!');
        this.resetTimer();
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

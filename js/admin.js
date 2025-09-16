class AdminApp {
    constructor() {
        this.cases = [];
        this.checklistData = {};
        this.selectedCase = null;
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderCases();
        this.handleUrlParams();
    }

    async loadData() {
        try {
            // 증례 데이터 로드
            const casesResponse = await fetch('data/cases.json');
            const casesData = await casesResponse.json();
            this.cases = casesData.cases;
            
            // 체크리스트 데이터 로드
            const checklistsResponse = await fetch('data/checklists.json');
            this.checklistData = await checklistsResponse.json();
        } catch (error) {
            console.error('데이터 로드 실패:', error);
        }
    }

    setupEventListeners() {
        // 탭 버튼 이벤트
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // 사이드바 버튼 이벤트 (시험 페이지로 이동 시 증례 ID 전달)
        document.querySelector('a[href="index.html"]').addEventListener('click', (e) => {
            e.preventDefault();
            this.goToExam();
        });
    }

    handleUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const caseId = urlParams.get('caseId');
        
        if (caseId) {
            // URL에서 증례 ID를 받았으면 해당 증례를 찾아서 선택
            const caseItem = this.cases.find(c => c.id == caseId);
            if (caseItem) {
                // 체크리스트 관리 탭으로 전환
                this.switchTab('checklists');
                // 해당 증례 선택
                this.selectCase(caseItem);
            }
        }
    }

    switchTab(tabName) {
        // 모든 탭 버튼 비활성화
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 모든 탭 콘텐츠 숨기기
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // 선택된 탭 활성화
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    renderCases() {
        const container = document.getElementById('caseList');
        container.innerHTML = '';
        
        this.cases.forEach(caseItem => {
            const card = document.createElement('div');
            card.className = 'case-card';
            card.dataset.caseId = caseItem.id;
            card.innerHTML = `
                <div class="case-title">${caseItem.id}. ${caseItem.title}</div>
                <div class="case-category">${caseItem.category}</div>
            `;
            
            card.addEventListener('click', () => {
                this.selectCase(caseItem);
            });
            
            container.appendChild(card);
        });
    }

    selectCase(caseItem) {
        // 모든 카드 선택 해제
        document.querySelectorAll('.case-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // 선택된 카드 활성화
        document.querySelector(`[data-case-id="${caseItem.id}"]`).classList.add('selected');
        
        this.selectedCase = caseItem;
        this.renderChecklistEditor();
    }

    renderChecklistEditor() {
        if (!this.selectedCase) return;
        
        document.getElementById('selectedCaseTitle').textContent = 
            `${this.selectedCase.id}. ${this.selectedCase.title}`;
        
        const caseTitle = this.selectedCase.title;
        const caseData = this.checklistData[caseTitle] || {
            문진: [],
            PE: [],
            감별진단: [],
            Plan: []
        };
        
        // 각 섹션 렌더링
        this.renderItemList('interviewList', caseData.문진 || [], 'interview');
        this.renderItemList('peList', caseData.PE || [], 'pe');
        this.renderItemList('ddxList', caseData.감별진단 || [], 'ddx');
        this.renderItemList('planList', caseData.Plan || [], 'plan');
        
        document.getElementById('checklistEditor').style.display = 'block';
    }

    renderItemList(containerId, items, type) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'item-input';
            div.innerHTML = `
                <input type="text" value="${item}" data-index="${index}" data-type="${type}">
                <button onclick="removeItem('${type}', ${index})">삭제</button>
            `;
            container.appendChild(div);
        });
    }

    addItem(type, newItem) {
        if (!newItem.trim()) return;
        
        const caseTitle = this.selectedCase.title;
        if (!this.checklistData[caseTitle]) {
            this.checklistData[caseTitle] = {
                문진: [],
                PE: [],
                감별진단: [],
                Plan: []
            };
        }
        
        const typeMap = {
            'interview': '문진',
            'pe': 'PE',
            'ddx': '감별진단',
            'plan': 'Plan'
        };
        
        const koreanType = typeMap[type];
        this.checklistData[caseTitle][koreanType].push(newItem.trim());
        
        this.renderChecklistEditor();
    }

    removeItem(type, index) {
        const caseTitle = this.selectedCase.title;
        const typeMap = {
            'interview': '문진',
            'pe': 'PE',
            'ddx': '감별진단',
            'plan': 'Plan'
        };
        
        const koreanType = typeMap[type];
        this.checklistData[caseTitle][koreanType].splice(index, 1);
        
        this.renderChecklistEditor();
    }

    updateItem(type, index, newValue) {
        const caseTitle = this.selectedCase.title;
        const typeMap = {
            'interview': '문진',
            'pe': 'PE',
            'ddx': '감별진단',
            'plan': 'Plan'
        };
        
        const koreanType = typeMap[type];
        this.checklistData[caseTitle][koreanType][index] = newValue;
    }

    goToExam() {
        // 현재 선택된 증례가 있으면 URL 파라미터로 전달
        if (this.selectedCase) {
            const url = `index.html?caseId=${this.selectedCase.id}`;
            window.location.href = url;
        } else {
            // 증례가 선택되지 않았으면 일반 시험 페이지로 이동
            window.location.href = 'index.html';
        }
    }

    async saveChecklist() {
        try {
            const response = await fetch('/api/checklists', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.checklistData)
            });
            
            if (response.ok) {
                alert('체크리스트가 저장되었습니다!');
            } else {
                throw new Error('저장 실패');
            }
        } catch (error) {
            console.error('저장 실패:', error);
            alert('저장에 실패했습니다.');
        }
    }
}

// 전역 함수들 (HTML에서 호출)
let adminApp;

function addInterviewItem() {
    const input = document.getElementById('newInterviewItem');
    adminApp.addItem('interview', input.value);
    input.value = '';
}

function addPEItem() {
    const input = document.getElementById('newPEItem');
    adminApp.addItem('pe', input.value);
    input.value = '';
}

function addDDxItem() {
    const input = document.getElementById('newDDxItem');
    adminApp.addItem('ddx', input.value);
    input.value = '';
}

function addPlanItem() {
    const input = document.getElementById('newPlanItem');
    adminApp.addItem('plan', input.value);
    input.value = '';
}

function removeItem(type, index) {
    adminApp.removeItem(type, index);
}

function saveChecklist() {
    adminApp.saveChecklist();
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    adminApp = new AdminApp();
});

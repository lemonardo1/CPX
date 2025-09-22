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

        // 엔터 키 이벤트 리스너 추가
        this.setupEnterKeyListeners();
    }

    setupEnterKeyListeners() {
        // 각 입력 필드에 엔터 키 이벤트 리스너 추가
        const inputMappings = [
            { id: 'newInterviewItem', type: 'interview' },
            { id: 'newPEItem', type: 'pe' },
            { id: 'newDDxItem', type: 'ddx' },
            { id: 'newPlanItem', type: 'plan' }
        ];

        inputMappings.forEach(({ id, type }) => {
            const input = document.getElementById(id);
            if (input && !input.hasAttribute('data-enter-listener')) {
                input.setAttribute('data-enter-listener', 'true');
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.addItem(type, input.value);
                        input.value = '';
                    }
                });
            }
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
        
        // 체크리스트 관리 탭으로 자동 전환
        this.switchTab('checklists');
        
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
        
        // 새 항목 입력 필드에 엔터 키 이벤트 다시 설정
        this.setupEnterKeyListeners();
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
            
            // 입력 필드에 이벤트 리스너 추가
            const input = div.querySelector('input');
            input.addEventListener('blur', () => {
                this.updateItem(type, index, input.value);
            });
            
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.updateItem(type, index, input.value);
                    input.blur(); // 포커스 해제
                }
            });
            
            container.appendChild(div);
            
            // 항목 사이에 + 버튼 추가 (마지막 항목 제외)
            if (index < items.length - 1) {
                this.addInsertButton(container, type, index + 1);
            }
        });
    }

    addInsertButton(container, type, insertIndex) {
        const insertDiv = document.createElement('div');
        insertDiv.className = 'insert-button';
        insertDiv.innerHTML = '+';
        
        // 실제 항목 높이를 기반으로 위치 계산
        const itemHeight = 40; // item-input의 실제 높이
        insertDiv.style.top = `${insertIndex * itemHeight}px`;
        
        insertDiv.onclick = (e) => {
            e.stopPropagation();
            this.showInsertInput(container, type, insertIndex);
        };
        container.appendChild(insertDiv);
    }

    showInsertInput(container, type, insertIndex) {
        // 기존 입력 필드 제거
        const existingInput = container.querySelector('.insert-input');
        if (existingInput) {
            existingInput.remove();
        }

        const inputDiv = document.createElement('div');
        inputDiv.className = 'insert-input';
        
        // 실제 항목 높이를 기반으로 위치 계산
        const itemHeight = 40; // item-input의 실제 높이
        inputDiv.style.top = `${insertIndex * itemHeight}px`;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '새 항목 입력';
        input.style.width = '100%';
        input.style.border = 'none';
        input.style.outline = 'none';
        input.style.fontSize = '12px';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '5px';
        buttonContainer.style.marginTop = '5px';
        
        const addBtn = document.createElement('button');
        addBtn.textContent = '추가';
        addBtn.style.padding = '4px 8px';
        addBtn.style.fontSize = '10px';
        addBtn.style.background = '#28a745';
        addBtn.style.color = 'white';
        addBtn.style.border = 'none';
        addBtn.style.borderRadius = '3px';
        addBtn.style.cursor = 'pointer';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '취소';
        cancelBtn.style.padding = '4px 8px';
        cancelBtn.style.fontSize = '10px';
        cancelBtn.style.background = '#6c757d';
        cancelBtn.style.color = 'white';
        cancelBtn.style.border = 'none';
        cancelBtn.style.borderRadius = '3px';
        cancelBtn.style.cursor = 'pointer';
        
        addBtn.onclick = () => {
            if (input.value.trim()) {
                this.insertItem(type, insertIndex, input.value.trim());
                inputDiv.remove();
                this.renderChecklistEditor(); // 전체 다시 렌더링
            }
        };
        
        cancelBtn.onclick = () => {
            inputDiv.remove();
        };
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addBtn.click();
            } else if (e.key === 'Escape') {
                cancelBtn.click();
            }
        });
        
        buttonContainer.appendChild(addBtn);
        buttonContainer.appendChild(cancelBtn);
        inputDiv.appendChild(input);
        inputDiv.appendChild(buttonContainer);
        container.appendChild(inputDiv);
        
        // 입력 필드에 포커스
        input.focus();
    }

    insertItem(type, index, newItem) {
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
        this.checklistData[caseTitle][koreanType].splice(index, 0, newItem);
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
    if (input && input.value.trim()) {
        adminApp.addItem('interview', input.value);
        input.value = '';
    }
}

function addPEItem() {
    const input = document.getElementById('newPEItem');
    if (input && input.value.trim()) {
        adminApp.addItem('pe', input.value);
        input.value = '';
    }
}

function addDDxItem() {
    const input = document.getElementById('newDDxItem');
    if (input && input.value.trim()) {
        adminApp.addItem('ddx', input.value);
        input.value = '';
    }
}

function addPlanItem() {
    const input = document.getElementById('newPlanItem');
    if (input && input.value.trim()) {
        adminApp.addItem('plan', input.value);
        input.value = '';
    }
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

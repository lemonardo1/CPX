class StatsApp {
    constructor() {
        this.sessions = [];
        this.cases = [];
        this.charts = {};
        this.checklistData = {};
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.renderStats();
        this.renderCharts();
        this.setupDeleteModal();
        this.setupStatsTabs();
    }

    async loadData() {
        try {
            // 세션 데이터 로드
            const sessionsResponse = await fetch('/api/sessions');
            this.sessions = await sessionsResponse.json();
            
            // 증례 데이터 로드
            const casesResponse = await fetch('data/cases.json');
            const casesData = await casesResponse.json();
            this.cases = casesData.cases;

            // 체크리스트 마스터 데이터 로드
            const checklistRes = await fetch('data/checklists.json');
            this.checklistData = await checklistRes.json();
        } catch (error) {
            console.error('데이터 로드 실패:', error);
            // 오프라인 모드에서는 빈 배열로 초기화
            this.sessions = [];
            this.checklistData = {};
        }
    }

    renderStats() {
        this.renderBasicStats();
        this.renderCaseStats();
        this.renderChecklistStats();
        this.renderFrequentItems();
        this.renderCaseFrequentItems();
        this.renderRecentSessions();
        this.renderScoreStats();
        this.renderSessionNotes();
    }

    renderBasicStats() {
        const totalSessions = this.sessions.length;
        const uniqueCases = new Set(this.sessions.map(s => s.caseId)).size;
        const avgTime = this.sessions.length > 0 
            ? Math.round(this.sessions.reduce((sum, s) => sum + s.timeUsed, 0) / this.sessions.length / 60)
            : 0;
        const completedSessions = this.sessions.filter(s => s.timeUsed >= 12 * 60 * 0.8).length;
        const completionRate = this.sessions.length > 0 
            ? Math.round((completedSessions / this.sessions.length) * 100)
            : 0;

        document.getElementById('totalSessions').textContent = totalSessions;
        document.getElementById('uniqueCases').textContent = uniqueCases;
        document.getElementById('avgTime').textContent = `${avgTime}분`;
        document.getElementById('completionRate').textContent = `${completionRate}%`;
    }

    renderCaseStats() {
        const caseCounts = {};
        this.sessions.forEach(session => {
            if (session.caseId) {
                caseCounts[session.caseId] = (caseCounts[session.caseId] || 0) + 1;
            }
        });

        const container = document.getElementById('caseStats');
        container.innerHTML = '';

        // 연습 횟수 순으로 정렬
        const sortedCases = Object.entries(caseCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10); // 상위 10개만 표시

        sortedCases.forEach(([caseId, count]) => {
            const caseItem = this.cases.find(c => c.id == caseId);
            if (caseItem) {
                const div = document.createElement('div');
                div.className = 'case-stat-item';
                div.innerHTML = `
                    <div class="case-stat-title">${caseItem.title}</div>
                    <div class="case-stat-count">${count}회</div>
                `;
                container.appendChild(div);
            }
        });
    }

    renderChecklistStats() {
        const checklistCounts = {
            'O': 0, 'L': 0, 'D': 0, 'Co': 0, 'Ex': 0, 'C': 0, 'A': 0, 'F': 0, 'E': 0,
            '외': 0, '과': 0, '약': 0, '사': 0, '가': 0, '여': 0
        };

        this.sessions.forEach(session => {
            if (session.checklists && session.checklists.common) {
                Object.entries(session.checklists.common).forEach(([key, checked]) => {
                    if (checked && checklistCounts.hasOwnProperty(key)) {
                        checklistCounts[key]++;
                    }
                });
            }
        });

        const container = document.getElementById('checklistStats');
        container.innerHTML = '';

        Object.entries(checklistCounts).forEach(([label, count]) => {
            const div = document.createElement('div');
            div.className = 'checklist-stat-item-compact';
            div.innerHTML = `
                <div class="checklist-stat-label-compact">${label}</div>
                <div class="checklist-stat-value-compact">${count}</div>
            `;
            container.appendChild(div);
        });
    }

    renderFrequentItems() {
        const allChecklistItems = {};
        
        // 세션별로, 해당 증례의 문진 체크리스트를 기준으로 총 기회/미체크 계산
        this.sessions.forEach(session => {
            const caseTitle = this.getCaseTitle(session);
            if (!caseTitle) return;
            const interviewItems = this.getInterviewItems(caseTitle);
            if (!interviewItems || interviewItems.length === 0) return;

            const checkedMap = (session.checklists && session.checklists.interview) ? session.checklists.interview : {};

            interviewItems.forEach(item => {
                if (!allChecklistItems[item]) {
                    allChecklistItems[item] = { total: 0, missed: 0 };
                }
                allChecklistItems[item].total++;
                const isChecked = checkedMap && checkedMap[item] === true;
                if (!isChecked) {
                    allChecklistItems[item].missed++;
                }
            });
        });

        // 자주 빠진 항목: missed 내림차순, 동률이면 total 내림차순
        const frequentMissed = Object.entries(allChecklistItems)
            .filter(([, data]) => data.missed > 0)
            .sort(([,a], [,b]) => (b.missed - a.missed) || (b.total - a.total))
            .slice(0, 10);

        const container = document.getElementById('frequentItems');
        if (!container) return;
        
        container.innerHTML = '';

        if (frequentMissed.length === 0) {
            container.innerHTML = '<div class="frequent-items-empty">아직 빠진 항목이 없습니다.</div>';
            return;
        }

        frequentMissed.forEach(([item, data]) => {
            const div = document.createElement('div');
            div.className = 'frequent-item';
            div.innerHTML = `
                <div class="frequent-item-name">${item}</div>
                <div class="frequent-item-count">${data.missed}회</div>
            `;
            container.appendChild(div);
        });
    }

    renderCaseFrequentItems() {
        const caseMissedData = {};
        
        // 증례별로 미체크 항목 누적 (증례 문진 마스터 기준)
        this.sessions.forEach(session => {
            const caseId = session.caseId;
            const caseTitle = this.getCaseTitle(session);
            if (!caseId || !caseTitle) return;

            const interviewItems = this.getInterviewItems(caseTitle);
            if (!interviewItems || interviewItems.length === 0) return;

            if (!caseMissedData[caseId]) {
                caseMissedData[caseId] = {};
            }

            const checkedMap = (session.checklists && session.checklists.interview) ? session.checklists.interview : {};
            interviewItems.forEach(item => {
                if (!caseMissedData[caseId][item]) {
                    caseMissedData[caseId][item] = 0;
                }
                const isChecked = checkedMap && checkedMap[item] === true;
                if (!isChecked) {
                    caseMissedData[caseId][item]++;
                }
            });
        });

        const container = document.getElementById('caseFrequentItems');
        if (!container) return;
        
        container.innerHTML = '';

        // 증례별로 정렬하여 표시 (미체크가 하나라도 있는 경우)
        const sortedCases = Object.entries(caseMissedData)
            .filter(([caseId, items]) => Object.values(items).some(count => count > 0))
            .sort(([a], [b]) => a - b);

        if (sortedCases.length === 0) {
            container.innerHTML = '<div class="frequent-items-empty">아직 빠진 항목이 없습니다.</div>';
            return;
        }

        sortedCases.forEach(([caseId, items]) => {
            const caseItem = this.cases.find(c => c.id == caseId);
            if (!caseItem) return;

            // 미체크 횟수 순으로 정렬
            const sortedItems = Object.entries(items)
                .filter(([, count]) => count > 0)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5);

            if (sortedItems.length === 0) return;

            const section = document.createElement('div');
            section.className = 'case-frequent-section';
            section.innerHTML = `
                <div class="case-frequent-title">${caseItem.id}. ${caseItem.title}</div>
                <div class="case-frequent-list"></div>
            `;

            const list = section.querySelector('.case-frequent-list');
            sortedItems.forEach(([item, count]) => {
                const div = document.createElement('div');
                div.className = 'case-frequent-item';
                div.innerHTML = `
                    <div class="case-frequent-item-name">${item}</div>
                    <div class="case-frequent-item-count">${count}회</div>
                `;
                list.appendChild(div);
            });

            container.appendChild(section);
        });
    }

    // 헬퍼: 세션에서 증례 제목을 안정적으로 얻기
    getCaseTitle(session) {
        if (session.caseTitle) return session.caseTitle;
        const caseItem = this.cases.find(c => c.id == session.caseId);
        return caseItem ? caseItem.title : null;
    }

    // 헬퍼: 증례 제목으로 문진 항목 얻기
    getInterviewItems(caseTitle) {
        if (!caseTitle || !this.checklistData) return [];

        // alias 우선 매핑
        const aliasMap = {
            '객혈': '토혈',
            '배뇨 이상 (배뇨통)': '배뇨 이상'
        };

        const resolvedKey = this.findChecklistKey(caseTitle, aliasMap);
        if (!resolvedKey) return [];
        const caseData = this.checklistData[resolvedKey];
        const items = caseData && Array.isArray(caseData['문진']) ? caseData['문진'] : [];
        return items || [];
    }

    // 헬퍼: 체크리스트 키 찾기 (정확, alias, 유사/부분 일치 순)
    findChecklistKey(title, aliasMap = {}) {
        if (!title) return null;
        const keys = Object.keys(this.checklistData || {});
        if (keys.length === 0) return null;

        // 1) 정확 일치
        if (this.checklistData[title]) return title;

        // 2) alias
        const alias = aliasMap[title];
        if (alias && this.checklistData[alias]) return alias;

        // 3) 정규화 후 일치/부분일치
        const norm = s => (s || '')
            .toLowerCase()
            .replace(/\([^)]*\)/g, '') // 괄호 내용 제거
            .replace(/\s+/g, '')
            .replace(/[\[\]\-_/·.,]/g, '');

        const nt = norm(title);
        let bestKey = null;
        let bestScore = 0;
        keys.forEach(k => {
            const nk = norm(k);
            if (!nk || !nt) return;
            let score = 0;
            if (nk === nt) score = 1.0;
            else if (nt.includes(nk) || nk.includes(nt)) score = Math.min(nk.length, nt.length) / Math.max(nk.length, nt.length);
            if (score > bestScore) {
                bestScore = score;
                bestKey = k;
            }
        });

        // 임계값 (0.6) 이상일 때만 채택
        return bestScore >= 0.6 ? bestKey : null;
    }

    setupStatsTabs() {
        // 통계 탭 버튼 이벤트
        document.querySelectorAll('.stats-tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchStatsTab(e.target.dataset.tab);
            });
        });
    }

    switchStatsTab(tabName) {
        // 모든 탭 버튼 비활성화
        document.querySelectorAll('.stats-tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 모든 탭 콘텐츠 숨기기
        document.querySelectorAll('.stats-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // 선택된 탭 활성화
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    renderRecentSessions() {
        const container = document.getElementById('recentSessions');
        container.innerHTML = '';

        const recentSessions = this.sessions
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 20);

        if (recentSessions.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 20px;">아직 연습 기록이 없습니다.</div>';
            return;
        }

        recentSessions.forEach(session => {
            const caseItem = this.cases.find(c => c.id == session.caseId);
            const div = document.createElement('div');
            div.className = 'session-item';
            
            const scoreText = session.score !== null && session.score !== undefined ? 
                `<span style="color: #28a745; font-weight: 600;">${session.score}점</span>` : 
                '<span style="color: #6c757d;">점수 없음</span>';
            
            div.innerHTML = `
                <div class="session-info">
                    <div class="session-case">${caseItem ? caseItem.title : '알 수 없음'}</div>
                    <div class="session-time">${new Date(session.timestamp).toLocaleString()}</div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                    <div class="session-duration">${Math.round(session.timeUsed / 60)}분</div>
                    <div style="font-size: 0.8rem;">${scoreText}</div>
                </div>
                <button class="session-delete-btn" onclick="showDeleteModal(${session.id})" title="세션 삭제">×</button>
            `;
            container.appendChild(div);
        });
    }

    renderScoreStats() {
        const container = document.getElementById('scoreStats');
        container.innerHTML = '';

        // 점수가 있는 세션만 필터링
        const sessionsWithScore = this.sessions.filter(session => session.score !== null && session.score !== undefined);
        
        if (sessionsWithScore.length === 0) {
            container.innerHTML = '<div class="session-note-empty">아직 점수 기록이 없습니다.</div>';
            return;
        }

        const scores = sessionsWithScore.map(s => s.score);
        const avgScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);
        
        // 점수 분포 계산 (10점 단위)
        const distribution = {};
        for (let i = 0; i <= 100; i += 10) {
            const range = `${i}-${i + 9}`;
            distribution[range] = scores.filter(score => score >= i && score < i + 10).length;
        }
        // 100점은 별도 처리
        distribution['90-100'] = scores.filter(score => score >= 90).length;

        // 기본 통계 표시
        const statsHtml = `
            <div class="score-stat-item">
                <div class="score-stat-label">평균 점수</div>
                <div class="score-stat-value">${avgScore}점</div>
            </div>
            <div class="score-stat-item">
                <div class="score-stat-label">최고 점수</div>
                <div class="score-stat-value">${maxScore}점</div>
            </div>
            <div class="score-stat-item">
                <div class="score-stat-label">최저 점수</div>
                <div class="score-stat-value">${minScore}점</div>
            </div>
            <div class="score-stat-item">
                <div class="score-stat-label">총 시험 수</div>
                <div class="score-stat-value">${sessionsWithScore.length}회</div>
            </div>
        `;

        // 점수 분포 표시
        const maxCount = Math.max(...Object.values(distribution));
        const distributionHtml = Object.entries(distribution)
            .filter(([range, count]) => count > 0)
            .map(([range, count]) => {
                const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return `
                    <div class="score-bar">
                        <div class="score-range">${range}</div>
                        <div class="score-bar-fill">
                            <div class="score-bar-progress" style="width: ${percentage}%"></div>
                        </div>
                        <div class="score-count">${count}</div>
                    </div>
                `;
            }).join('');

        container.innerHTML = statsHtml + `
            <div class="score-distribution">
                <h4 style="font-size: 0.9rem; margin-bottom: 10px; color: #495057;">점수 분포</h4>
                ${distributionHtml}
            </div>
        `;
    }

    renderSessionNotes() {
        const container = document.getElementById('sessionNotesList');
        container.innerHTML = '';

        // 시험 기록이 있는 세션만 필터링
        const sessionsWithNotes = this.sessions
            .filter(session => session.notes && session.notes.trim())
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (sessionsWithNotes.length === 0) {
            container.innerHTML = '<div class="session-note-empty">아직 시험 기록이 없습니다.</div>';
            return;
        }

        sessionsWithNotes.forEach(session => {
            const caseItem = this.cases.find(c => c.id == session.caseId);
            const div = document.createElement('div');
            div.className = 'session-note-item';
            
            // 기록 내용이 긴 경우 접기/펼치기 기능
            const isLongNote = session.notes.length > 200;
            const displayContent = isLongNote ? session.notes.substring(0, 200) + '...' : session.notes;
            
            div.innerHTML = `
                <div class="session-note-header">
                    <div class="session-note-title">${caseItem ? caseItem.title : '알 수 없음'}</div>
                    <div class="session-note-time">${new Date(session.timestamp).toLocaleString()}</div>
                </div>
                <div class="session-note-content ${isLongNote ? '' : 'expanded'}" data-full-content="${session.notes.replace(/"/g, '&quot;')}">
                    ${displayContent}
                </div>
                ${isLongNote ? '<button class="session-note-toggle" onclick="toggleNote(this)">더 보기</button>' : ''}
            `;
            
            container.appendChild(div);
        });
    }

    renderCharts() {
        this.renderTimeChart();
    }

    renderTimeChart() {
        const ctx = document.getElementById('timeChart').getContext('2d');
        
        // 시간대별 연습 횟수 계산
        const hourlyData = new Array(24).fill(0);
        this.sessions.forEach(session => {
            const hour = new Date(session.timestamp).getHours();
            hourlyData[hour]++;
        });

        this.charts.timeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Array.from({length: 24}, (_, i) => `${i}시`),
                datasets: [{
                    label: '연습 횟수',
                    data: hourlyData,
                    backgroundColor: 'rgba(52, 152, 219, 0.6)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    exportToCSV() {
        const csvContent = this.generateCSV();
        this.downloadFile(csvContent, 'cpx_sessions.csv', 'text/csv');
    }

    exportToJSON() {
        const jsonContent = JSON.stringify(this.sessions, null, 2);
        this.downloadFile(jsonContent, 'cpx_sessions.json', 'application/json');
    }

    generateCSV() {
        const headers = ['날짜', '시간', '증례ID', '증례명', '소요시간(분)', '완료여부', '점수', '시험기록'];
        const rows = this.sessions.map(session => {
            const caseItem = this.cases.find(c => c.id == session.caseId);
            const date = new Date(session.timestamp);
            const isCompleted = session.timeUsed >= 12 * 60 * 0.8;
            
            return [
                date.toLocaleDateString(),
                date.toLocaleTimeString(),
                session.caseId || '',
                caseItem ? caseItem.title : '',
                Math.round(session.timeUsed / 60),
                isCompleted ? '완료' : '미완료',
                session.score !== null && session.score !== undefined ? session.score : '',
                session.notes ? session.notes.replace(/"/g, '""') : ''
            ];
        });

        return [headers, ...rows].map(row => 
            row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }


    setupDeleteModal() {
        const deleteModal = document.getElementById('deleteModal');
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

        // 취소 버튼
        cancelDeleteBtn.addEventListener('click', () => {
            this.hideDeleteModal();
        });

        // 확인 버튼
        confirmDeleteBtn.addEventListener('click', () => {
            this.deleteSession();
        });

        // 모달 외부 클릭 시 닫기
        deleteModal.addEventListener('click', (e) => {
            if (e.target.id === 'deleteModal') {
                this.hideDeleteModal();
            }
        });

        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && deleteModal.style.display !== 'none') {
                this.hideDeleteModal();
            }
        });
    }

    showDeleteModal(sessionId) {
        console.log('삭제 모달 표시 요청, 세션 ID:', sessionId);
        
        const session = this.sessions.find(s => s.id == sessionId);
        if (!session) {
            console.error('세션을 찾을 수 없습니다:', sessionId);
            alert('삭제할 세션을 찾을 수 없습니다.');
            return;
        }

        const caseItem = this.cases.find(c => c.id == session.caseId);
        const scoreText = session.score !== null && session.score !== undefined ? 
            `${session.score}점` : '점수 없음';

        const previewHtml = `
            <div class="session-preview-title">${caseItem ? caseItem.title : '알 수 없음'}</div>
            <div class="session-preview-details">
                <div>날짜: ${new Date(session.timestamp).toLocaleString()}</div>
                <div>소요시간: ${Math.round(session.timeUsed / 60)}분</div>
                <div>점수: ${scoreText}</div>
                ${session.notes ? `<div>기록: ${session.notes.substring(0, 50)}${session.notes.length > 50 ? '...' : ''}</div>` : ''}
            </div>
        `;

        document.getElementById('sessionPreview').innerHTML = previewHtml;
        document.getElementById('deleteModal').style.display = 'flex';
        
        // 삭제할 세션 ID 저장 (숫자로 변환)
        this.sessionToDelete = parseInt(sessionId);
        console.log('삭제할 세션 ID 저장:', this.sessionToDelete);
    }

    hideDeleteModal() {
        document.getElementById('deleteModal').style.display = 'none';
        this.sessionToDelete = null;
    }

    async deleteSession() {
        if (!this.sessionToDelete) {
            console.error('삭제할 세션 ID가 없습니다.');
            return;
        }

        try {
            console.log('삭제할 세션 ID:', this.sessionToDelete);
            
            // 서버에서 세션 삭제
            const response = await fetch(`/api/sessions/${this.sessionToDelete}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log('삭제 응답 상태:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('삭제 성공:', result);
                
                // 로컬 데이터에서도 제거 (타입 변환하여 비교)
                this.sessions = this.sessions.filter(s => s.id != this.sessionToDelete);
                
                // 통계 다시 렌더링
                this.renderStats();
                this.renderCharts();
                
                this.hideDeleteModal();
                alert('세션이 삭제되었습니다.');
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('삭제 실패 응답:', response.status, errorData);
                throw new Error(`삭제 실패: ${response.status} - ${errorData.message || '알 수 없는 오류'}`);
            }
        } catch (error) {
            console.error('세션 삭제 실패:', error);
            alert(`세션 삭제에 실패했습니다: ${error.message}`);
        }
    }
}

// 전역 함수들 (HTML에서 호출)
let statsApp;

function exportToCSV() {
    statsApp.exportToCSV();
}

function exportToJSON() {
    statsApp.exportToJSON();
}

function toggleNote(button) {
    const contentDiv = button.previousElementSibling;
    const isExpanded = contentDiv.classList.contains('expanded');
    
    if (isExpanded) {
        // 접기
        const fullContent = contentDiv.getAttribute('data-full-content');
        const shortContent = fullContent.substring(0, 200) + '...';
        contentDiv.textContent = shortContent;
        contentDiv.classList.remove('expanded');
        button.textContent = '더 보기';
    } else {
        // 펼치기
        const fullContent = contentDiv.getAttribute('data-full-content');
        contentDiv.textContent = fullContent;
        contentDiv.classList.add('expanded');
        button.textContent = '접기';
    }
}

function showDeleteModal(sessionId) {
    statsApp.showDeleteModal(sessionId);
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    statsApp = new StatsApp();
});

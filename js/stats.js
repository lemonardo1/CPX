class StatsApp {
    constructor() {
        this.sessions = [];
        this.cases = [];
        this.charts = {};
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.renderStats();
        this.renderCharts();
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
        } catch (error) {
            console.error('데이터 로드 실패:', error);
            // 오프라인 모드에서는 빈 배열로 초기화
            this.sessions = [];
        }
    }

    renderStats() {
        this.renderBasicStats();
        this.renderCaseStats();
        this.renderChecklistStats();
        this.renderRecentSessions();
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
            div.className = 'checklist-stat-item';
            div.innerHTML = `
                <div class="checklist-stat-label">${label}</div>
                <div class="checklist-stat-value">${count}</div>
            `;
            container.appendChild(div);
        });
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
            div.innerHTML = `
                <div class="session-info">
                    <div class="session-case">${caseItem ? caseItem.title : '알 수 없음'}</div>
                    <div class="session-time">${new Date(session.timestamp).toLocaleString()}</div>
                </div>
                <div class="session-duration">${Math.round(session.timeUsed / 60)}분</div>
            `;
            container.appendChild(div);
        });
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
        const headers = ['날짜', '시간', '증례ID', '증례명', '소요시간(분)', '완료여부', '시험기록'];
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

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    statsApp = new StatsApp();
});

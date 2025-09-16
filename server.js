const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 데이터 파일 경로
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const CHECKLISTS_FILE = path.join(DATA_DIR, 'checklists.json');

// 데이터 로드 함수
async function loadData(filename) {
    try {
        const data = await fs.readFile(filename, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`데이터 로드 실패 (${filename}):`, error);
        return [];
    }
}

// 데이터 저장 함수
async function saveData(filename, data) {
    try {
        await fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`데이터 저장 실패 (${filename}):`, error);
        return false;
    }
}

// API 라우트

// 세션 저장
app.post('/api/sessions', async (req, res) => {
    try {
        const session = req.body;
        const sessions = await loadData(SESSIONS_FILE);
        
        // 새 세션 추가
        sessions.push(session);
        
        // 파일에 저장
        const success = await saveData(SESSIONS_FILE, sessions);
        
        if (success) {
            res.json({ success: true, message: '세션이 저장되었습니다.' });
        } else {
            res.status(500).json({ success: false, message: '저장에 실패했습니다.' });
        }
    } catch (error) {
        console.error('세션 저장 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 세션 조회
app.get('/api/sessions', async (req, res) => {
    try {
        const sessions = await loadData(SESSIONS_FILE);
        res.json(sessions);
    } catch (error) {
        console.error('세션 조회 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 체크리스트 저장
app.post('/api/checklists', async (req, res) => {
    try {
        const checklists = req.body;
        const success = await saveData(CHECKLISTS_FILE, checklists);
        
        if (success) {
            res.json({ success: true, message: '체크리스트가 저장되었습니다.' });
        } else {
            res.status(500).json({ success: false, message: '저장에 실패했습니다.' });
        }
    } catch (error) {
        console.error('체크리스트 저장 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 체크리스트 조회
app.get('/api/checklists', async (req, res) => {
    try {
        const checklists = await loadData(CHECKLISTS_FILE);
        res.json(checklists);
    } catch (error) {
        console.error('체크리스트 조회 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 통계 데이터 조회
app.get('/api/stats', async (req, res) => {
    try {
        const sessions = await loadData(SESSIONS_FILE);
        
        // 기본 통계 계산
        const totalSessions = sessions.length;
        const uniqueCases = new Set(sessions.map(s => s.caseId)).size;
        const avgTime = sessions.length > 0 
            ? Math.round(sessions.reduce((sum, s) => sum + s.timeUsed, 0) / sessions.length / 60)
            : 0;
        const completedSessions = sessions.filter(s => s.timeUsed >= 12 * 60 * 0.8).length;
        const completionRate = sessions.length > 0 
            ? Math.round((completedSessions / sessions.length) * 100)
            : 0;

        // 시간대별 통계
        const hourlyData = new Array(24).fill(0);
        sessions.forEach(session => {
            const hour = new Date(session.timestamp).getHours();
            hourlyData[hour]++;
        });

        // 증례별 통계
        const caseCounts = {};
        sessions.forEach(session => {
            if (session.caseId) {
                caseCounts[session.caseId] = (caseCounts[session.caseId] || 0) + 1;
            }
        });

        // 체크리스트 통계
        const checklistCounts = {
            'O': 0, 'L': 0, 'D': 0, 'Co': 0, 'Ex': 0, 'C': 0, 'A': 0, 'F': 0, 'E': 0,
            '외': 0, '과': 0, '약': 0, '사': 0, '가': 0, '여': 0
        };

        sessions.forEach(session => {
            if (session.checklists && session.checklists.common) {
                Object.entries(session.checklists.common).forEach(([key, checked]) => {
                    if (checked && checklistCounts.hasOwnProperty(key)) {
                        checklistCounts[key]++;
                    }
                });
            }
        });

        const stats = {
            basic: {
                totalSessions,
                uniqueCases,
                avgTime,
                completionRate
            },
            hourly: hourlyData,
            caseCounts,
            checklistCounts,
            recentSessions: sessions
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 20)
        };

        res.json(stats);
    } catch (error) {
        console.error('통계 조회 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 정적 파일 서빙
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/stats', (req, res) => {
    res.sendFile(path.join(__dirname, 'stats.html'));
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`CPX 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    console.log(`시험: http://localhost:${PORT}`);
    console.log(`관리: http://localhost:${PORT}/admin`);
    console.log(`통계: http://localhost:${PORT}/stats`);
});

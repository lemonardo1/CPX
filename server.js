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
// CSP 헤더 설정: eval 금지, 필요한 소스만 허용
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', [
        "default-src 'self' blob:",
        "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'self'",
        "base-uri 'self'"
    ].join('; '));
    next();
});
app.use(express.static(__dirname));

// 데이터 파일 경로
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const CHECKLISTS_FILE = path.join(DATA_DIR, 'checklists.json');
const CASES_FILE = path.join(DATA_DIR, 'cases.json');

// OpenAI 설정
const { OpenAI } = require('openai');
require('dotenv').config();
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

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

// 세션 삭제
app.delete('/api/sessions/:id', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.id);
        const sessions = await loadData(SESSIONS_FILE);
        
        // 해당 ID의 세션 찾기
        const sessionIndex = sessions.findIndex(s => s.id === sessionId);
        
        if (sessionIndex === -1) {
            return res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다.' });
        }
        
        // 세션 삭제
        sessions.splice(sessionIndex, 1);
        
        // 파일에 저장
        const success = await saveData(SESSIONS_FILE, sessions);
        
        if (success) {
            res.json({ success: true, message: '세션이 삭제되었습니다.' });
        } else {
            res.status(500).json({ success: false, message: '삭제에 실패했습니다.' });
        }
    } catch (error) {
        console.error('세션 삭제 오류:', error);
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

// 노트 평가 -> 체크리스트 자동 체크 항목 반환
app.post('/api/evaluate', async (req, res) => {
    try {
        if (!openai) {
            return res.status(500).json({ success: false, message: 'OPENAI_API_KEY 미설정' });
        }

        const { caseId, caseTitle, notes } = req.body || {};
        if (!caseId || !caseTitle || !notes) {
            return res.status(400).json({ success: false, message: 'caseId, caseTitle, notes가 필요합니다.' });
        }

        // 해당 증례의 체크리스트 후보 불러오기
        const checklists = await loadData(CHECKLISTS_FILE);
        const caseChecklist = checklists[caseTitle] || {};
        const interviewCandidates = Array.isArray(caseChecklist['문진']) ? caseChecklist['문진'] : [];
        const peCandidates = Array.isArray(caseChecklist['PE']) ? caseChecklist['PE'] : [];

        // 공통 체크리스트 라벨들
        const commonLabels = ['O','L','D','Co','Ex','C','A','F','E','외','과','약','사','가','여'];

        const systemPrompt = `You are a medical OSCE assistant.
한국어 자유서술형 메모를 엄격하게 평가하여 체크리스트 항목을 선택합니다.
규칙:
1) 노트에 문자 그대로 등장하는 내용만 선택합니다. 추론/상상 금지.
2) 각 선택 항목은 반드시 노트에서 발췌한 짧은 근거 텍스트(evidence)를 함께 제공합니다.
3) 후보에 없는 항목은 절대 포함하지 않습니다.
4) 확실하지 않으면 포함하지 않습니다 (보수적 선택).`;
        
        const userPrompt = {
            case: caseTitle,
            notes,
            candidates: {
                common: commonLabels,
                interview: interviewCandidates,
                pe: peCandidates
            },
            instructions: `각 섹션은 다음 형식으로만 반환하세요:\n{\n  "common": [{"label":"라벨","evidence":"노트에서 발췌한 짧은 문구"}],\n  "interview": [{"label":"라벨","evidence":"..."}],\n  "pe": [{"label":"라벨","evidence":"..."}]\n}\n evidence가 없거나 메모에 실제로 존재하지 않으면 그 항목은 제외하세요.`
        };
        
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `입력을 평가하고 evidence를 포함한 JSON만 반환하세요.\n\n${JSON.stringify(userPrompt)}` }
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' }
        });
        
        let content = response.choices?.[0]?.message?.content || '{}';
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (e) {
            parsed = { common: [], interview: [], pe: [] };
        }
        
        // 서버 측: evidence가 실제 노트에 존재하는지 확인하며 후보 내 라벨만 채택
        const normalize = (t) => (typeof t === 'string' ? t.toLowerCase().replace(/[\s.,;:?!()\[\]{}\"'`~…·\-]/g, '') : '');
        const notesNorm = normalize(notes);
        const includesInNotes = (evidence) => {
            if (!evidence || typeof evidence !== 'string') return false;
            const ev = normalize(evidence);
            return ev.length > 0 && notesNorm.includes(ev);
        };
        
        const mapAndFilter = (section, candidates) => {
            const raw = Array.isArray(parsed[section]) ? parsed[section] : [];
            // 허용 형식: ["label", ...] 또는 [{label, evidence}, ...]
            const objs = raw.map(item => {
                if (typeof item === 'string') return { label: item, evidence: '' };
                if (item && typeof item.label === 'string') return { label: item.label, evidence: item.evidence || '' };
                return null;
            }).filter(Boolean);
            
            const filtered = objs.filter(({ label, evidence }) => {
                if (!candidates.includes(label)) return false;
                // evidence가 있는 경우에만 채택 (없으면 제외하여 과다 체크 방지)
                return includesInNotes(evidence);
            });
            
            return filtered.map(o => o.label);
        };
        
        const result = {
            common: mapAndFilter('common', commonLabels),
            interview: mapAndFilter('interview', interviewCandidates),
            pe: mapAndFilter('pe', peCandidates)
        };

        res.json(result);
    } catch (error) {
        console.error('노트 평가 오류:', error);
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

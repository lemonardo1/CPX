(function () {
    const TAB_NAMES = [
        '상처관리',
        '응급처치',
        '동맥혈 채혈 및 안전수혈술기',
        '혈액배양 채혈 및 안전수혈술기'
    ];

    /** @type {Record<string, { steps: { order: number; title: string; items: string[] }[] }>} */
    let osceData = {};

    const contentElement = document.getElementById('osceChecklist');
    const imageElement = document.getElementById('osceImage');
    const examTextElement = document.getElementById('osceExamText');
    const tabButtons = Array.from(document.querySelectorAll('.osce-tab-button'));

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    const SKILL_TO_IMAGE = {
        '상처관리': 'data/assets/상처관리.jpeg',
        '응급처치': 'data/assets/응급처치.jpeg',
        '동맥혈 채혈 및 안전수혈술기': 'data/assets/동맥혈 채혈 및 안전수혈술기.jpeg',
        '혈액배양 채혈 및 안전수혈술기': 'data/assets/혈액배양채혈 및 안전수혈술기.jpeg'
    };

    const SKILL_TO_TEXT = {
        '상처관리': '1. 환자가 착용하고 있는 모형을 대상으로 상처소독, 국소마취, 2. 모형을 대상으로 봉합 (표준화환자와 대화를 통해 진료 수행)',
        '응급처치': '1. 성인 심폐소생술(CPR), 2. 제세동, 3. 기관내 삽관 (간호사와 대화를 통해 응급처치 상황을 수행함',
        '동맥혈 채혈 및 안전수혈술기': '1. 동맥혈 채혈, 2. 안전수혈술기 (표준화환자와 대화를 통해 진료 수행)',
        '혈액배양 채혈 및 안전수혈술기': '1. 혈액배양 채혈, 2. 안전수혈술기 (표준화환자와 대화를 통해 진료 수행)'
    };

    function setActiveTab(skillName) {
        tabButtons.forEach((btn) => {
            const isActive = btn.dataset.skill === skillName;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', String(isActive));
        });
        renderMedia(skillName);
        renderContent(skillName);
    }

    function renderContent(skillName) {
        if (!contentElement) return;
        const section = osceData[skillName];
        const steps = Array.isArray(section?.steps) ? section.steps : [];

        if (steps.length === 0) {
            contentElement.innerHTML = '<div class="osce-empty">구성 준비중입니다.</div>';
            return;
        }

        const html = steps
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((step) => {
                const itemsHtml = (Array.isArray(step.items) ? step.items : [])
                    .map((item) => (
                        '<li class="osce-item">' +
                        '<label class="osce-item-label">' +
                        '<input type="checkbox" class="osce-item-input" />' +
                        '<span>' + escapeHtml(item) + '</span>' +
                        '</label>' +
                        '</li>'
                    ))
                    .join('');

                return (
                    '<section class="osce-step-card">' +
                    '<div class="osce-step-header">' +
                    '<div class="osce-step-order">' + escapeHtml(step.order ?? '') + '</div>' +
                    '<h3 class="osce-step-title">' + escapeHtml(step.title ?? '') + '</h3>' +
                    '</div>' +
                    '<ul class="osce-item-list">' + itemsHtml + '</ul>' +
                    '</section>'
                );
            })
            .join('');

        contentElement.innerHTML = html;
    }

    function renderMedia(skillName) {
        const imgSrc = SKILL_TO_IMAGE[skillName];
        if (imageElement && imgSrc) {
            imageElement.src = imgSrc;
        }
        const text = SKILL_TO_TEXT[skillName];
        if (examTextElement && typeof text === 'string') {
            examTextElement.textContent = text;
        }
    }

    // 탭 클릭 이벤트 바인딩
    tabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const skillName = btn.dataset.skill || TAB_NAMES[0];
            setActiveTab(skillName);
        });
    });

    // 체크 상태 시각적 반영 (이벤트 위임)
    if (contentElement) {
        contentElement.addEventListener('change', (e) => {
            const target = e.target;
            if (target && target.classList && target.classList.contains('osce-item-input')) {
                const li = target.closest('.osce-item');
                if (li) li.classList.toggle('checked', target.checked);
            }
        });
    }

    // 데이터 로드 후 초기 렌더링
    function tryFetch(url) {
        return fetch(url, { cache: 'no-store' }).then((r) => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        });
    }

    if (contentElement) {
        contentElement.innerHTML = '<div class="osce-empty">로딩 중...</div>';
    }

    const buster = Date.now();
    tryFetch('/data/OSCE.json?t=' + buster)
        .catch(() => tryFetch('data/OSCE.json?t=' + buster))
        .then((data) => {
            osceData = data || {};
            const activeButton = document.querySelector('.osce-tab-button.active');
            const initial = (activeButton && activeButton.getAttribute('data-skill')) || TAB_NAMES[0];
            setActiveTab(initial);
        })
        .catch((err) => {
            // 텍스트로 한번 더 시도하여 디버깅 정보 출력
            fetch('/data/OSCE.json?t=' + buster, { cache: 'no-store' })
                .then(r => r.text())
                .then(text => {
                    console.error('OSCE 데이터 원문:', text.slice(0, 3000));
                    console.error('OSCE 데이터 로딩 실패:', err);
                    if (contentElement) {
                        contentElement.innerHTML = '<div class="osce-empty">OSCE 데이터를 불러올 수 없습니다.</div>';
                    }
                })
                .catch(() => {
                    console.error('OSCE 데이터 로딩 실패:', err);
                    if (contentElement) {
                        contentElement.innerHTML = '<div class="osce-empty">OSCE 데이터를 불러올 수 없습니다.</div>';
                    }
                });
        });
})();



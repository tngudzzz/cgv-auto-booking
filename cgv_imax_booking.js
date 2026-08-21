/**
 * CGV 용산아이파크몰 IMAX [좌석 화면 실시간 고속 새로고침] 자동 예매 스크립트
 * 
 * [동작 핵심]
 * - 날짜별 좌석 선택 페이지(https://cgv.co.kr/cnm/selectVisitorCnt)에 '일반 2명' 선택 상태로 탭 유지
 * - 관람인원 우측의 '새로고침' 버튼을 눌러 초고속 비동기(AJAX) 좌석 갱신
 * - 취소표(E열 이상 중앙 2연석) 발견 즉시 1초 만에 좌석 클릭 -> 선택완료 -> 결제하기 -> https://cgv.co.kr/mpy/main 진입
 * - 사용자에게 제어권 전달(Handoff) 및 알림
 */

(async () => {
  const task = await useOrCreateTaskSpace('cgv booking');
  cliLog('=== [초고속 좌석 새로고침] CGV 용산 IMAX 자동 예매 스크립트 시작 ===');

  const TARGET_MOVIE = '오디세이';
  const TARGET_THEATER = '용산아이파크몰';
  const IDEAL_CENTER_COL = 22; // 용산 IMAX 센터 좌석 열 기준 (15~28번 부근)

  // 1. 현재 열려 있는 탭 확인 (사용자가 이미 좌석 페이지를 열어두었는지 체크)
  const tabs = await listTabs();
  const seatTabs = [];

  // 각 탭의 URL 및 상태 확인
  for (const t of tabs) {
    await switchTab(t.targetId);
    await wait(1);
    const info = await pageInfo();
    if (info.url.includes('selectVisitorCnt')) {
      seatTabs.push(t.targetId);
    }
  }

  cliLog(`현재 감지된 좌석 선택 페이지 탭 수: ${seatTabs.length}개`);

  // 2. 만약 좌석 선택 탭이 없거나 부족한 경우, 자동으로 날짜별 중간 회차 좌석 페이지 탭 세팅
  if (seatTabs.length === 0) {
    cliLog('좌석 선택 탭 세팅을 위해 영화/극장/회차 진입을 시작합니다...');

    await gotoAndWait('https://cgv.co.kr/tme/itgrSrch');
    await wait(2);

    await fillInput('input[placeholder="검색어를 입력해주세요."]', TARGET_MOVIE);
    await pressKey('Enter');
    await wait(3);

    // 예매하기 클릭
    await js(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.trim() === '예매하기');
      if (btn) btn.click();
    })()`);
    await wait(3);

    // 극장 선택: 용산아이파크몰
    await js(`(() => {
      const dialog = document.querySelector('dialog') || document.body;
      const btns = Array.from(dialog.querySelectorAll('button'));
      const t = btns.find(b => b.innerText.includes('${TARGET_THEATER}'));
      if (t) t.click();
    })()`);
    await wait(1);

    await js(`(() => {
      const dialog = document.querySelector('dialog') || document.body;
      const confirmBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.innerText.trim() === '극장선택');
      if (confirmBtn) confirmBtn.click();
    })()`);
    await wait(2);

    // IMAX 탭 선택
    await js(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const imaxBtn = btns.find(b => b.name === 'IMAX' || b.innerText.trim() === 'IMAX');
      if (imaxBtn) imaxBtn.click();
    })()`);
    await wait(2);

    // 사용 가능한 날짜 순회하며 중간 회차 좌석 페이지로 진입
    const movieBookUrl = (await pageInfo()).url;
    const availableDates = await js(`(() => {
      const container = document.querySelector('.dayScroll_container__e9cLv') || document.querySelector('[class*="dayScroll"]');
      if (!container) return [];
      return Array.from(container.querySelectorAll('button')).map((b, idx) => ({ idx, text: b.innerText.replace(/\\s+/g, ' ').trim() }));
    })()`);

    const maxTabsToSetup = Math.min(availableDates.length, 5);

    for (let i = 0; i < maxTabsToSetup; i++) {
      let targetTabId;
      if (i === 0) {
        targetTabId = (await listTabs())[0].targetId;
      } else {
        const newTab = await openOrReuseTab(movieBookUrl, { wait: true, timeout: 15 });
        targetTabId = newTab.targetId;
        await wait(2);
      }

      await switchTab(targetTabId);

      // 날짜 선택
      await js(`(() => {
        const container = document.querySelector('.dayScroll_container__e9cLv') || document.querySelector('[class*="dayScroll"]');
        if (container) {
          const btns = Array.from(container.querySelectorAll('button'));
          if (btns[${i}]) btns[${i}].click();
        }
      })()`);
      await wait(1.5);

      // 중간 시간대 회차(첫/마지막 제외) 선택
      const selectedSession = await js(`(() => {
        const btns = Array.from(document.querySelectorAll('button')).filter(b => {
          return b.innerText && /\\d{2}:\\d{2}/.test(b.innerText);
        });
        if (btns.length >= 3) {
          // 중간 회차 (예: 2번째 회차) 클릭
          const target = btns[Math.floor(btns.length / 2)];
          target.click();
          return target.innerText.replace(/\\s+/g, ' ').trim();
        } else if (btns.length > 0) {
          btns[0].click();
          return btns[0].innerText.replace(/\\s+/g, ' ').trim();
        }
        return null;
      })()`);

      cliLog(`[탭 ${i + 1}] ${availableDates[i]?.text} -> 회차(${selectedSession}) 좌석 페이지 진입 중...`);
      await wait(3);

      // 일반 2명 사전 선택
      await js(`(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const twoBtn = btns.find(b => b.getAttribute('aria-label') === '2 선택');
        if (twoBtn) twoBtn.click();
      })()`);
      await wait(1);

      seatTabs.push(targetTabId);
    }
  }

  cliLog(`✅ 총 ${seatTabs.length}개 탭에서 고속 좌석 새로고침 모니터링을 진행합니다.`);

  // 3. 초고속 원자적(Atomic) 새로고침 및 좌석 분석 루프
  let matchFound = false;

  for (const tabId of seatTabs) {
    if (matchFound) break;

    await switchTab(tabId);

    // [딜레이 제로 초고속 원자적 실행] 새로고침 -> 2인 재선택 -> 2연석 감지 -> 좌석클릭 -> 선택 -> 결제 -> 팝업확인까지 원샷 직행
    const result = await js(`(async () => {
      // 1. React/가상 DOM 대응 초고속 합성 클릭 헬퍼
      function fastClick(element) {
        if (!element) return false;
        const opts = { bubbles: true, cancelable: true, view: window, buttons: 1 };
        try {
          element.dispatchEvent(new PointerEvent('pointerdown', opts));
          element.dispatchEvent(new MouseEvent('mousedown', opts));
          element.dispatchEvent(new PointerEvent('pointerup', opts));
          element.dispatchEvent(new MouseEvent('mouseup', opts));
          element.click();
          return true;
        } catch (e) {
          element.click();
          return true;
        }
      }

      // 2. 새로고침 버튼 즉각 클릭 (딜레이 0ms)
      const refreshBtn = document.querySelector('button[title="새로고침"]') ||
                         document.querySelector('.cnms01520_titleWrap__ITsqM button') ||
                         Array.from(document.querySelectorAll('button')).find(b => {
                           const aria = b.getAttribute('aria-label') || '';
                           const title = b.getAttribute('title') || '';
                           return aria.includes('새로고침') || title.includes('새로고침') || b.className.includes('refresh');
                         });

      if (refreshBtn) fastClick(refreshBtn);

      // 3. 10ms 초미세 폴링으로 '일반 2인' 즉시 재선택 (비동기 갱신 찰나 반응)
      const getGeneralTwoBtn = () => {
        const generalWrap = Array.from(document.querySelectorAll('.numberChoice_NumberWrap__JKTv1, [class*="NumberWrap"], [class*="numberChoice"]')).find(w => (w.innerText || '').includes('일반'));
        return generalWrap ? (generalWrap.querySelector('button[aria-label="2 선택"]') || Array.from(generalWrap.querySelectorAll('button')).find(btn => btn.innerText.trim() === '2'))
                           : document.querySelector('button[aria-label="2 선택"]');
      };

      const pollStart = performance.now();
      while (performance.now() - pollStart < 300) {
        const twoBtn = getGeneralTwoBtn();
        if (twoBtn && twoBtn.getAttribute('aria-pressed') !== 'true') {
          fastClick(twoBtn);
          break;
        }
        await new Promise(r => setTimeout(r, 10));
      }

      // 4. 실시간 메인 좌석 배치도 분석 (E열 이상 중앙 최단거리 2연석, 미니맵 제외)
      const allSeats = Array.from(document.querySelectorAll('button.seatMap_seatNumber__JHck5, .seatMap_seatPositionWrap__v5y_3 button'))
        .filter(b => {
          const cls = b.className || '';
          const txt = (b.innerText || '').trim();
          const isNormal = cls.includes('Normal') || cls.includes('normal') || !cls.includes('Disabled');
          return isNormal && /^[A-Z]\\d+$/.test(txt);
        })
        .map(b => ({ el: b, name: b.innerText.trim() }));

      const byRow = {};
      for (const item of allSeats) {
        const r = item.name[0];
        const num = parseInt(item.name.slice(1), 10);
        if (!byRow[r]) byRow[r] = [];
        byRow[r].push({ num, el: item.el, name: item.name });
      }

      const candidatePairs = [];
      for (const r of Object.keys(byRow).sort()) {
        if (r < 'E') continue; // A~D열 제외
        const seatsInRow = byRow[r].sort((a, b) => a.num - b.num);
        for (let i = 0; i < seatsInRow.length - 1; i++) {
          if (seatsInRow[i + 1].num === seatsInRow[i].num + 1) { // 2연석
            const s1 = seatsInRow[i];
            const s2 = seatsInRow[i + 1];
            const avgCol = (s1.num + s2.num) / 2;
            const distFromCenter = Math.abs(avgCol - ${IDEAL_CENTER_COL});

            candidatePairs.push({
              seat1: s1.name,
              seat2: s2.name,
              el1: s1.el,
              el2: s2.el,
              distFromCenter,
              pairStr: s1.name + ', ' + s2.name
            });
          }
        }
      }

      candidatePairs.sort((a, b) => a.distFromCenter - b.distFromCenter);

      if (candidatePairs.length > 0) {
        const best = candidatePairs[0];

        // 즉시 좌석 2자리 클릭 (딜레이 0ms)
        fastClick(best.el1);
        fastClick(best.el2);

        // 하단 '선택' 또는 '선택완료' 즉시 클릭 (딜레이 0ms)
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '선택' || b.innerText.includes('선택완료'));
        if (confirmBtn) fastClick(confirmBtn);

        // 결제하기 및 팝업 확인 초고속 반응형 인터셉트 (10ms 폴링)
        const payStart = performance.now();
        let payClicked = false;
        let okClicked = false;

        while (performance.now() - payStart < 1500) {
          if (!payClicked) {
            const payBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('결제하기') || b.innerText.trim() === '결제');
            if (payBtn && !payBtn.disabled) {
              fastClick(payBtn);
              payClicked = true;
            }
          }
          if (payClicked && !okClicked) {
            const dialog = document.querySelector('dialog, [role="dialog"], .layer_popup, .popup') || document.body;
            const okBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.innerText.trim() === '확인' || (b.innerText.trim() === '결제하기' && b.className.includes('fill-main')));
            if (okBtn) {
              fastClick(okBtn);
              okClicked = true;
              break;
            }
          }
          await new Promise(r => setTimeout(r, 10));
        }

        return {
          found: true,
          pairStr: best.pairStr,
          totalAvailable: allSeats.length
        };
      }

      return {
        found: false,
        pairStr: null,
        totalAvailable: allSeats.length
      };
    })()`);

    if (result && result.found) {
      cliLog(`🎉🎉 [대박! 취소표 2연석 발견 및 초고속 선점!] 좌석: ${result.pairStr}`);
      await wait(1); // 결제 페이지 전환 대기

      // 최종 결제 페이지(https://cgv.co.kr/mpy/main) 도달 확인
      const finalUrl = (await pageInfo()).url;
      cliLog('최종 결제 페이지 도달: ' + finalUrl);

      // 세션 안전: 다른 날짜 탭들 정리
      const currentTabs = await listTabs();
      for (const t of currentTabs) {
        if (t.targetId !== tabId) {
          await closeTab(t.targetId);
        }
      }

      // 사용자에게 브라우저 제어권 전달 (Handoff)
      await handOffTaskSpace(task.id);
      cliLog(`[예매 완료] 좌석(${result.pairStr}) 결제 화면 진입 완료.`);
      matchFound = true;
      return;
    } else {
      cliLog(`[탭 ${tabId.slice(-4)}] 모니터링 중... (현재 잔여석: ${result ? result.totalAvailable : 0}석)`);
    }
  }

  if (!matchFound) {
    cliLog('새로고침 순회 완료: 현재 E열 이상 중앙 2연석 취소표가 없습니다.');
  }
})();

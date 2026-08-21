/**
 * CGV 용산아이파크몰 IMAX 무제한 백그라운드 좌석 모니터링 데몬
 */

(async () => {
  const task = await useOrCreateTaskSpace('cgv booking');
  cliLog('🚀 === CGV 용산 IMAX [무제한 자동 모니터링 데몬] 가동 시작 ===');

  const IDEAL_CENTER_COL = 22;
  const INTERVAL_MS = 6000; // 탭 순회 사이의 안전 딜레이 (6초)

  // 1. 현재 열려 있는 좌석 선택 탭 확인
  const initialTabs = await listTabs();
  const seatTabs = [];

  for (const t of initialTabs) {
    try {
      await switchTab(t.targetId);
      await wait(0.5);
      const info = await pageInfo();
      if (info.url && info.url.includes('selectVisitorCnt')) {
        seatTabs.push(t.targetId);
      }
    } catch (e) {}
  }

  if (seatTabs.length === 0) {
    cliLog('좌석 선택 탭이 감지되지 않아 메인 탭으로 탐색을 진행합니다.');
    seatTabs.push(initialTabs[0].targetId);
  }

  cliLog(`🎯 총 ${seatTabs.length}개 탭에서 무제한 새로고침 루프를 시작합니다.`);

  let round = 1;
  let matchFound = false;

  while (!matchFound) {
    cliLog(`\n[Round ${round}] 4개 탭 좌석 갱신 탐색 중... (${new Date().toLocaleTimeString()})`);

    for (let idx = 0; idx < seatTabs.length; idx++) {
      const tabId = seatTabs[idx];

      try {
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
          cliLog(`\n🎉🎉🎉 [취소표 2연석 초고속 선점 완료!] 좌석: ${result.pairStr}`);
          await wait(1); // 페이지 전환 대기

          // 결제 페이지 확인
          const finalUrl = (await pageInfo()).url;
          cliLog('✅ 최종 결제 페이지 도달: ' + finalUrl);

          // 다른 탭 정리
          const currentTabs = await listTabs();
          for (const t of currentTabs) {
            if (t.targetId !== tabId) {
              try { await closeTab(t.targetId); } catch (e) {}
            }
          }

          // 제어권 사용자 전달
          await handOffTaskSpace(task.id);
          cliLog(`🏁 [예매 성공] ${result.pairStr} 좌석으로 결제 화면에 대기 중입니다.`);
          matchFound = true;
          return;
        }
      } catch (err) {
        cliLog(`[Tab Error] ${err.message}`);
      }
    }

    round++;
    await wait(INTERVAL_MS / 1000); // 6초 안전 휴식
  }
})();

const { spawn } = require('child_process');

const completeScript = `
(() => {
  const logs = [];
  const log = (msg) => logs.push(msg);

  const fastClick = (el) => {
    if (!el) return false;
    const opts = { bubbles: true, cancelable: true, view: window, buttons: 1 };
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.click();
      return true;
    } catch (e) {
      el.click();
      return true;
    }
  };

  const getGeneralTwoBtn = () => {
    const generalWrap = Array.from(document.querySelectorAll('.numberChoice_NumberWrap__JKTv1, [class*="NumberWrap"], [class*="numberChoice"]')).find(w => (w.innerText || '').includes('일반'));
    if (generalWrap) {
      const b = generalWrap.querySelector('button[aria-label="2 선택"]') || Array.from(generalWrap.querySelectorAll('button')).find(btn => btn.innerText.trim() === '2');
      if (b) return b;
    }
    return document.querySelector('button[aria-label="2 선택"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '2');
  };

  const getRefreshBtn = () => {
    return document.querySelector('button[title="새로고침"]') ||
           document.querySelector('.cnms01520_titleWrap__ITsqM button') ||
           Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('title')||'').includes('새로고침') || (b.getAttribute('aria-label')||'').includes('새로고침') || b.className.includes('refresh'));
  };

  // 1. 일반 2인 선택
  const b1 = getGeneralTwoBtn();
  if (b1) { fastClick(b1); log('1. 일반 2인 선택'); }

  // 2. 새로고침 클릭 (200ms 후)
  setTimeout(() => {
    const rf = getRefreshBtn();
    if (rf) { fastClick(rf); log('2. 새로고침 클릭'); }

    // 3. 다시 일반 2인 재선택 (400ms 후)
    setTimeout(() => {
      const b2 = getGeneralTwoBtn();
      if (b2) { fastClick(b2); log('3. 일반 2인 재선택'); }

      // 4. 잔여 좌석 2연석 선택 (300ms 후)
      setTimeout(() => {
        // 정확한 CGV 좌석 Span 엘리먼트 탐색
        const seatSpans = Array.from(document.querySelectorAll('.seatMainMap_seatNumber__zoUn_, [class*="seatNumber"], [class*="seatNormal"]')).filter(el => {
          const cls = el.className || '';
          const txt = (el.innerText || '').trim();
          const isNormal = cls.includes('Normal') || cls.includes('normal') || !cls.includes('Disabled');
          return isNormal && /^[A-Z]\\d+$/.test(txt);
        }).map(el => ({ el, name: el.innerText.trim() }));

        log('4. 감지된 좌석 수: ' + seatSpans.length);

        const byRow = {};
        for (const s of seatSpans) {
          const r = s.name[0];
          const num = parseInt(s.name.slice(1), 10);
          if (!byRow[r]) byRow[r] = [];
          byRow[r].push({ num, el: s.el, name: s.name });
        }

        let selectedPair = null;
        for (const r of Object.keys(byRow).sort()) {
          const rowSeats = byRow[r].sort((a, b) => a.num - b.num);
          for (let i = 0; i < rowSeats.length - 1; i++) {
            if (rowSeats[i + 1].num === rowSeats[i].num + 1) {
              selectedPair = [rowSeats[i], rowSeats[i + 1]];
              break;
            }
          }
          if (selectedPair) break;
        }

        if (!selectedPair && seatSpans.length >= 2) {
          selectedPair = [seatSpans[0], seatSpans[1]];
        }

        if (selectedPair) {
          fastClick(selectedPair[0].el);
          fastClick(selectedPair[1].el);
          // inner span도 혹시 모르니 트리거
          if (selectedPair[0].el.firstElementChild) fastClick(selectedPair[0].el.firstElementChild);
          if (selectedPair[1].el.firstElementChild) fastClick(selectedPair[1].el.firstElementChild);

          log('4. 좌석 2개 클릭 완료: ' + selectedPair[0].name + ', ' + selectedPair[1].name);

          // 5. 하단 [선택] 클릭 (300ms 후)
          setTimeout(() => {
            const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '선택' || b.innerText.includes('선택완료'));
            if (confirmBtn) {
              fastClick(confirmBtn);
              log('5. 하단 선택 클릭');
            }

            // 6. [결제하기] 클릭 (600ms 후)
            setTimeout(() => {
              const payBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('결제하기') || b.innerText.trim() === '결제');
              if (payBtn) {
                fastClick(payBtn);
                log('6. 결제하기 클릭');
              }

              // 7. 팝업 [확인] 클릭 (600ms 후)
              setTimeout(() => {
                const dialog = document.querySelector('dialog, [role="dialog"], .layer_popup, .popup') || document.body;
                const okBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.innerText.trim() === '확인' || b.innerText.trim() === '결제하기');
                if (okBtn) {
                  fastClick(okBtn);
                  log('7. 팝업 확인 클릭');
                }
              }, 600);
            }, 600);
          }, 300);
        } else {
          log('❌ 좌석 없음');
        }
      }, 300);
    }, 400);
  }, 200);

  return '시작됨';
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(completeScript)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.on('close', () => {
  console.log('실행 완료! 브라우저 상태 대기 중...');
});
proc.stdin.write(appleScript);
proc.stdin.end();

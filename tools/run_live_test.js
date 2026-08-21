const { spawn } = require('child_process');

const exactScript = `
(() => {
  const logs = [];
  const log = (msg) => logs.push(msg);

  // [1] 고속 합성 클릭
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

  log('시작: ' + window.location.href);

  // 1. 일반 2인 탐색 함수 (정확한 live DOM 기준)
  const getGeneralTwoBtn = () => {
    const generalWrap = Array.from(document.querySelectorAll('.numberChoice_NumberWrap__JKTv1, [class*="NumberWrap"], [class*="numberChoice"]')).find(w => {
      return (w.innerText || '').includes('일반');
    });
    if (generalWrap) {
      const b = generalWrap.querySelector('button[aria-label="2 선택"]') || Array.from(generalWrap.querySelectorAll('button')).find(btn => btn.innerText.trim() === '2');
      if (b) return b;
    }
    return document.querySelector('button[aria-label="2 선택"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '2');
  };

  // 2. 새로고침 버튼 (정확한 live DOM 기준)
  const getRefreshBtn = () => {
    return document.querySelector('button[title="새로고침"]') ||
           document.querySelector('.cnms01520_titleWrap__ITsqM button') ||
           Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('title')||'').includes('새로고침') || (b.getAttribute('aria-label')||'').includes('새로고침') || b.className.includes('refresh'));
  };

  // [Step 1] 일반 2인 선택
  const btnGen1 = getGeneralTwoBtn();
  if (btnGen1) {
    fastClick(btnGen1);
    log('1️⃣ 일반 2인 클릭 완료 (aria-pressed=' + btnGen1.getAttribute('aria-pressed') + ')');
  }

  // [Step 2] 0.2초 후 새로고침 클릭
  setTimeout(() => {
    const btnRef = getRefreshBtn();
    if (btnRef) {
      fastClick(btnRef);
      log('2️⃣ 새로고침 클릭 완료');
    }

    // [Step 3] 0.4초 후 일반 2인 재선택
    setTimeout(() => {
      const btnGen2 = getGeneralTwoBtn();
      if (btnGen2) {
        fastClick(btnGen2);
        log('3️⃣ 일반 2인 재선택 완료');
      }

      // [Step 4] 0.25초 후 잔여 2연석 선택
      setTimeout(() => {
        const allSeatElements = Array.from(document.querySelectorAll('[class*="seatNumber"], [class*="SeatNumber"], [class*="seatMainMap"], [class*="seatMap"]'))
          .filter(el => {
            const cls = el.className || '';
            const txt = (el.innerText || '').trim();
            const notDisabled = !cls.includes('Disabled') && !cls.includes('disabled');
            return notDisabled && /^[A-Z]\\d+$/.test(txt);
          })
          .map(el => ({ el, name: el.innerText.trim() }));

        log('4️⃣ 감지된 좌석 수: ' + allSeatElements.length + '석');

        const byRow = {};
        for (const item of allSeatElements) {
          const r = item.name[0];
          const num = parseInt(item.name.slice(1), 10);
          if (!byRow[r]) byRow[r] = [];
          byRow[r].push({ num, el: item.el, name: item.name });
        }

        let targetPair = null;
        for (const r of Object.keys(byRow).sort()) {
          const rowSeats = byRow[r].sort((a, b) => a.num - b.num);
          for (let i = 0; i < rowSeats.length - 1; i++) {
            if (rowSeats[i + 1].num === rowSeats[i].num + 1) {
              targetPair = [rowSeats[i], rowSeats[i + 1]];
              break;
            }
          }
          if (targetPair) break;
        }

        if (!targetPair && allSeatElements.length >= 2) {
          targetPair = [allSeatElements[0], allSeatElements[1]];
        }

        if (targetPair) {
          fastClick(targetPair[0].el);
          fastClick(targetPair[1].el);
          log('4️⃣ 좌석 2자리 클릭 성공: ' + targetPair[0].name + ', ' + targetPair[1].name);

          // [Step 5] 하단 '선택' 클릭
          setTimeout(() => {
            const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '선택' || b.innerText.includes('선택완료'));
            if (confirmBtn) {
              fastClick(confirmBtn);
              log('5️⃣ 하단 선택 클릭 성공');
            }

            // [Step 6] 결제하기 클릭
            setTimeout(() => {
              const payBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('결제하기') || b.innerText.trim() === '결제');
              if (payBtn) {
                fastClick(payBtn);
                log('6️⃣ 결제하기 클릭 성공');
              }

              // [Step 7] 팝업 확인 클릭
              setTimeout(() => {
                const dialog = document.querySelector('dialog, [role="dialog"], .layer_popup, .popup') || document.body;
                const okBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.innerText.trim() === '확인' || b.innerText.trim() === '결제하기');
                if (okBtn) {
                  fastClick(okBtn);
                  log('7️⃣ 팝업 확인 클릭 성공');
                }
              }, 400);
            }, 500);
          }, 300);
        } else {
          log('❌ 잔여 좌석 없음');
        }
      }, 250);
    }, 400);
  }, 200);

  return logs.join(' | ');
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(exactScript)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.on('close', () => {
  console.log('실행 로그:', out.trim());
});
proc.stdin.write(appleScript);
proc.stdin.end();

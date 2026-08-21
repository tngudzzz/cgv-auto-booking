const { spawn } = require('child_process');

const runSyncScript = `
(() => {
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

  const logs = [];
  const log = (msg) => logs.push(msg);

  log('시작 URL: ' + window.location.href);

  // 1. 일반 2인 선택
  const allBtns = Array.from(document.querySelectorAll('button'));
  const btn2 = allBtns.find(b => b.getAttribute('aria-label') === '2 선택') || allBtns.filter(b => b.innerText.trim() === '2')[0];
  if (btn2) {
    fastClick(btn2);
    log('1. 일반 2인 클릭: ' + btn2.innerText.trim());
  } else {
    log('1. 일반 2인 버튼 못찾음');
  }

  // 2. 새로고침 클릭
  const refreshBtn = allBtns.find(b => {
    const aria = b.getAttribute('aria-label') || '';
    const txt = b.innerText || '';
    const cls = b.className || '';
    return aria.includes('새로고침') || txt.includes('새로고침') || cls.includes('refresh') || cls.includes('reset') || (b.closest && b.closest('[class*="visitor"], [class*="Visitor"]') && b.querySelector('svg, img'));
  });
  if (refreshBtn) {
    fastClick(refreshBtn);
    log('2. 새로고침 클릭');
  } else {
    log('2. 새로고침 버튼 못찾음');
  }

  // 3. 0.3초 후 2인 다시 선택 및 좌석 클릭 실행하는 타이머 등록
  setTimeout(() => {
    const curBtns = Array.from(document.querySelectorAll('button'));
    const reBtn2 = curBtns.find(b => b.getAttribute('aria-label') === '2 선택') || curBtns.filter(b => b.innerText.trim() === '2')[0];
    if (reBtn2) fastClick(reBtn2);

    setTimeout(() => {
      // 좌석 선택
      const seats = Array.from(document.querySelectorAll('.seatMap_seatNumber__JHck5, .seatMainMap_seatNumber__zoUn_, [class*="seatNumber"], button[class*="seat"]'))
        .filter(s => !s.className.includes('seatDisabled') && (s.className.includes('seatNormal') || !s.disabled))
        .map(el => ({ el, name: el.innerText.trim() }))
        .filter(item => /^[A-Z]\\d+$/.test(item.name));

      const byRow = {};
      for (const item of seats) {
        const r = item.name[0], num = parseInt(item.name.slice(1), 10);
        if (!byRow[r]) byRow[r] = [];
        byRow[r].push({ num, el: item.el, name: item.name });
      }

      let pair = null;
      for (const r of Object.keys(byRow).sort()) {
        const rowSeats = byRow[r].sort((a, b) => a.num - b.num);
        for (let i = 0; i < rowSeats.length - 1; i++) {
          if (rowSeats[i + 1].num === rowSeats[i].num + 1) {
            pair = [rowSeats[i].el, rowSeats[i + 1].el, rowSeats[i].name + ', ' + rowSeats[i + 1].name];
            break;
          }
        }
        if (pair) break;
      }
      if (!pair && seats.length >= 2) pair = [seats[0].el, seats[1].el, seats[0].name + ', ' + seats[1].name];

      if (pair) {
        fastClick(pair[0]);
        fastClick(pair[1]);

        setTimeout(() => {
          // 선택완료
          const latestBtns = Array.from(document.querySelectorAll('button'));
          const confirmBtn = latestBtns.find(b => b.innerText.trim() === '선택' || b.innerText.includes('선택완료'));
          if (confirmBtn) fastClick(confirmBtn);

          setTimeout(() => {
            // 결제하기
            const pBtns = Array.from(document.querySelectorAll('button'));
            const payBtn = pBtns.find(b => b.innerText.includes('결제하기') || b.innerText.trim() === '결제');
            if (payBtn) fastClick(payBtn);

            setTimeout(() => {
              // 팝업 확인
              const dialog = document.querySelector('dialog, [role="dialog"], .layer_popup, .popup') || document.body;
              const okBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.innerText.trim() === '확인' || b.innerText.trim() === '결제하기');
              if (okBtn) fastClick(okBtn);
            }, 500);
          }, 500);
        }, 300);
      }
    }, 200);
  }, 350);

  return logs.join(' | ');
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(runSyncScript)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.on('close', () => {
  console.log('실행 결과:', out.trim());
});
proc.stdin.write(appleScript);
proc.stdin.end();

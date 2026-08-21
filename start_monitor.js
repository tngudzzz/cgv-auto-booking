const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'monitor.log');

function log(msg) {
  const ts = new Date().toLocaleTimeString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) {}
}

const monitorScript = `
(async () => {
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

  // 1. 새로고침 버튼 즉시 클릭 (딜레이 0ms)
  const refreshBtn = document.querySelector('button[title="새로고침"]') ||
                     document.querySelector('.cnms01520_titleWrap__ITsqM button') ||
                     Array.from(document.querySelectorAll('button')).find(b => {
                       const aria = b.getAttribute('aria-label') || '';
                       const title = b.getAttribute('title') || '';
                       return aria.includes('새로고침') || title.includes('새로고침') || b.className.includes('refresh');
                     });

  if (refreshBtn) fastClick(refreshBtn);

  // 2. 10ms 초미세 폴링으로 '일반 2인' 즉시 재선택 (비동기 갱신 찰나 반응)
  const getGeneralTwoBtn = () => {
    const generalWrap = Array.from(document.querySelectorAll('.numberChoice_NumberWrap__JKTv1, [class*="NumberWrap"], [class*="numberChoice"]')).find(w => (w.innerText || '').includes('일반'));
    return generalWrap ? (generalWrap.querySelector('button[aria-label="2 선택"]') || Array.from(generalWrap.querySelectorAll('button')).find(btn => btn.innerText.trim() === '2'))
                       : document.querySelector('button[aria-label="2 선택"]');
  };

  const pollStart = performance.now();
  while (performance.now() - pollStart < 350) {
    const twoBtn = getGeneralTwoBtn();
    if (twoBtn && twoBtn.getAttribute('aria-pressed') !== 'true') {
      fastClick(twoBtn);
      break;
    }
    await new Promise(r => setTimeout(r, 10));
  }

  // 3. 실시간 메인 좌석 배치도 분석 (E열 이상 중앙 최단거리 2연석, 미니맵 제외)
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
  const IDEAL_CENTER_COL = 22; // 중앙 센터 기준

  for (const r of Object.keys(byRow).sort()) {
    // A~D열 제외 (E열 이상만)
    if (r < 'E') continue;

    const seatsInRow = byRow[r].sort((a, b) => a.num - b.num);
    for (let i = 0; i < seatsInRow.length - 1; i++) {
      if (seatsInRow[i + 1].num === seatsInRow[i].num + 1) { // 2연석
        const s1 = seatsInRow[i];
        const s2 = seatsInRow[i + 1];
        const avgCol = (s1.num + s2.num) / 2;
        const distFromCenter = Math.abs(avgCol - IDEAL_CENTER_COL);

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

  // 중앙 최단거리 우선 정렬
  candidatePairs.sort((a, b) => a.distFromCenter - b.distFromCenter);

  if (candidatePairs.length > 0) {
    const best = candidatePairs[0];

    // 즉시 좌석 2자리 클릭 (딜레이 0ms)
    fastClick(best.el1);
    fastClick(best.el2);

    // 하단 '선택 / 선택완료' 즉시 클릭 (딜레이 0ms)
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

    return JSON.stringify({
      found: true,
      pairStr: best.pairStr,
      totalAvailable: allSeats.length,
      url: window.location.href
    });
  }

  return JSON.stringify({
    found: false,
    pairStr: null,
    totalAvailable: allSeats.length,
    url: window.location.href
  });
})()
`;

function runCycle() {
  return new Promise((resolve) => {
    const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(monitorScript)}
end tell
`;

    const proc = spawn('osascript', ['-']);
    let out = '';
    proc.stdout.on('data', d => out += d);
    proc.on('close', (code) => {
      if (code === 0 && out.trim()) {
        try {
          resolve(JSON.parse(out.trim()));
        } catch (e) {
          resolve({ error: out.trim() });
        }
      } else {
        resolve({ error: '오류 코드: ' + code });
      }
    });
    proc.stdin.write(appleScript);
    proc.stdin.end();
  });
}

async function main() {
  log('🚀 === CGV 실시간 취소표 자동 모니터링 데몬 시작 ===');
  log('설정: [일반 2인 고정] ➔ [새로고침] ➔ [E열 이상 중앙 2연석 선점] ➔ [결제창 직행]');
  
  let round = 1;
  const INTERVAL_MS = 2000; // 안전 고속 모니터링 주기 (2초)

  while (true) {
    try {
      const res = await runCycle();

      if (res.found) {
        log(`\n🎉🎉🎉 [대박! 취소표 발견 및 결제 진입 완료!] 좌석: ${res.pairStr}`);
        log(`결제 페이지(https://cgv.co.kr/mpy/main)로 즉시 이동했습니다!`);
        try {
          spawn('afplay', ['/System/Library/Sounds/Glass.aiff']);
        } catch (e) {}
        break;
      } else if (res.totalAvailable !== undefined) {
        log(`[Round ${round}] 새로고침 완료 (현재 잔여석: ${res.totalAvailable}석 / E열 이상 2연석 대기 중)`);
      } else if (res.error) {
        log(`[Round ${round}] 응답: ${res.error.slice(0, 80)}`);
      }
    } catch (err) {
      log(`[Round ${round}] 오류: ${err.message}`);
    }

    round++;
    await new Promise(r => setTimeout(r, INTERVAL_MS));
  }
}

main();

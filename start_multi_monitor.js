const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'multi_monitor.log');

function log(msg) {
  const ts = new Date().toLocaleTimeString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) {}
}

// In-tab atomic execution script (Synchronous evaluation for instant AppleScript return)
const inTabScript = `
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

  // 1. 관람인원 우측 새로고침 버튼 즉시 클릭 (딜레이 0ms)
  const refreshBtn = document.querySelector('button[title="새로고침"]') ||
                     document.querySelector('.cnms01520_titleWrap__ITsqM button') ||
                     Array.from(document.querySelectorAll('button')).find(b => {
                       const aria = b.getAttribute('aria-label') || '';
                       const title = b.getAttribute('title') || '';
                       return aria.includes('새로고침') || title.includes('새로고침') || b.className.includes('refresh');
                     });

  if (refreshBtn) fastClick(refreshBtn);

  // 2. 일반 2인 선택 버튼 확보
  const getGeneralTwoBtn = () => {
    const generalWrap = Array.from(document.querySelectorAll('.numberChoice_NumberWrap__JKTv1, [class*="NumberWrap"], [class*="numberChoice"]')).find(w => (w.innerText || '').includes('일반'));
    return generalWrap ? (generalWrap.querySelector('button[aria-label="2 선택"]') || Array.from(generalWrap.querySelectorAll('button')).find(btn => btn.innerText.trim() === '2'))
                       : document.querySelector('button[aria-label="2 선택"]');
  };

  const twoBtn = getGeneralTwoBtn();
  if (twoBtn && twoBtn.getAttribute('aria-pressed') !== 'true') {
    fastClick(twoBtn);
  }

  // 3. 메인 좌석 배치도 분석 (E열 이상 중앙 최단거리 2연석, 미니맵 제외)
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
  const IDEAL_CENTER_COL = 22;

  for (const r of Object.keys(byRow).sort()) {
    if (r < 'E') continue; // A~D열 제외

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

  candidatePairs.sort((a, b) => a.distFromCenter - b.distFromCenter);

  // 상영 시간/회차 정보
  const timeBtns = Array.from(document.querySelectorAll('button, li, div')).filter(el => /\\d{2}:\\d{2}/.test(el.innerText || ''));
  const activeTime = timeBtns.find(b => b.className && (b.className.includes('active') || b.className.includes('selected') || b.className.includes('on')));
  const timeInfo = activeTime ? activeTime.innerText.replace(/\\s+/g, ' ').trim().slice(0, 30) : (timeBtns.length > 0 ? timeBtns[0].innerText.replace(/\\s+/g, ' ').trim().slice(0, 30) : '');

  if (candidatePairs.length > 0) {
    const best = candidatePairs[0];

    // 즉시 좌석 2자리 클릭
    fastClick(best.el1);
    fastClick(best.el2);

    // 하단 '선택 / 선택완료' 즉시 클릭
    const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '선택' || b.innerText.includes('선택완료'));
    if (confirmBtn) fastClick(confirmBtn);

    // 결제하기 및 팝업 확인 인터셉트
    setTimeout(() => {
      const payBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('결제하기') || b.innerText.trim() === '결제');
      if (payBtn) fastClick(payBtn);

      setTimeout(() => {
        const dialog = document.querySelector('dialog, [role="dialog"], .layer_popup, .popup') || document.body;
        const okBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.innerText.trim() === '확인' || (b.innerText.trim() === '결제하기' && b.className.includes('fill-main')));
        if (okBtn) fastClick(okBtn);
      }, 300);
    }, 300);

    return JSON.stringify({
      found: true,
      pairStr: best.pairStr,
      totalAvailable: allSeats.length,
      timeInfo,
      url: window.location.href
    });
  }

  return JSON.stringify({
    found: false,
    pairStr: null,
    totalAvailable: allSeats.length,
    timeInfo,
    url: window.location.href
  });
})()
`;

function getSeatTabs() {
  return new Promise((resolve) => {
    const script = `
tell application "Google Chrome"
  set res to {}
  set wIdx to 1
  repeat with w in (every window)
    set tIdx to 1
    repeat with t in (every tab of w)
      set tUrl to URL of t
      set tTitle to title of t
      if tUrl contains "selectVisitorCnt" then
        copy (wIdx as text) & "::" & (tIdx as text) & "::" & tTitle & "::" & tUrl to end of res
      end if
      set tIdx to tIdx + 1
    end repeat
    set wIdx to wIdx + 1
  end repeat
  set AppleScript's text item delimiters to "___TAB_SEP___"
  return res as text
end tell
`;
    const proc = spawn('osascript', ['-']);
    let out = '';
    proc.stdout.on('data', d => out += d);
    proc.on('close', () => {
      if (!out.trim()) return resolve([]);
      const rawList = out.trim().split('___TAB_SEP___');
      const tabs = [];
      for (const item of rawList) {
        const parts = item.split('::');
        if (parts.length >= 4) {
          tabs.push({
            winIdx: parseInt(parts[0], 10),
            tabIdx: parseInt(parts[1], 10),
            title: parts[2],
            url: parts[3]
          });
        }
      }
      resolve(tabs);
    });
    proc.stdin.write(script);
    proc.stdin.end();
  });
}

function runInTab(winIdx, tabIdx) {
  return new Promise((resolve) => {
    const script = `
tell application "Google Chrome"
  try
    return execute tab ${tabIdx} of window ${winIdx} javascript ${JSON.stringify(inTabScript)}
  on error errMsg
    return "ERROR:" & errMsg
  end try
end tell
`;
    const proc = spawn('osascript', ['-']);
    let out = '';
    proc.stdout.on('data', d => out += d);
    proc.on('close', () => {
      if (!out.trim()) return resolve({ error: 'empty response' });
      if (out.startsWith('ERROR:')) return resolve({ error: out });
      try {
        resolve(JSON.parse(out.trim()));
      } catch (e) {
        resolve({ error: out.trim() });
      }
    });
    proc.stdin.write(script);
    proc.stdin.end();
  });
}

function focusTab(winIdx, tabIdx) {
  const script = `
tell application "Google Chrome"
  activate
  set active tab index of window ${winIdx} to ${tabIdx}
  set index of window ${winIdx} to 1
end tell
`;
  const proc = spawn('osascript', ['-']);
  proc.stdin.write(script);
  proc.stdin.end();
}

async function main() {
  log('🚀 === CGV [멀티 탭 동시 모니터링] 초고속 자동 예매 시스템 가동 ===');
  log('📋 설정: [일반 2인] ➔ [새로고침] ➔ [E열 이상 중앙 최단거리 2연석 선점] ➔ [결제창 직행]');

  let round = 1;
  const ROUND_INTERVAL_MS = 1500; // 탭 순회 주기 (1.5초)

  while (true) {
    try {
      const tabs = await getSeatTabs();

      if (tabs.length === 0) {
        log(`[Round ${round}] ⚠️ Chrome에서 CGV 좌석 선택 탭('selectVisitorCnt')이 감지되지 않았습니다. 탭을 열어두시면 자동으로 감지합니다.`);
        await new Promise(r => setTimeout(r, 3000));
        round++;
        continue;
      }

      log(`\n[Round ${round}] 총 ${tabs.length}개 탭 실시간 동시 모니터링 중... (${new Date().toLocaleTimeString()})`);

      let matched = false;

      for (let i = 0; i < tabs.length; i++) {
        const t = tabs[i];
        const res = await runInTab(t.winIdx, t.tabIdx);

        const timeLabel = res.timeInfo ? ` (${res.timeInfo})` : '';

        if (res.found) {
          matched = true;
          log(`\n🎉🎉🎉 [대박! 취소표 2연석 발견 및 선점 완료!]`);
          log(`📍 대상 탭: [탭 ${i + 1}]${timeLabel} (Window ${t.winIdx}, Tab ${t.tabIdx})`);
          log(`💺 좌석: ${res.pairStr}`);
          log(`💳 최종 결제 페이지(https://cgv.co.kr/mpy/main)로 진입했습니다!`);

          // 화면 활성화 및 알림음
          focusTab(t.winIdx, t.tabIdx);
          try {
            spawn('afplay', ['/System/Library/Sounds/Glass.aiff']);
          } catch (e) {}
          break;
        } else if (res.totalAvailable !== undefined) {
          log(`  • [탭 ${i + 1}]${timeLabel} 잔여석: ${res.totalAvailable}석 (E열 이상 중앙 2연석 대기 중)`);
        } else if (res.error) {
          log(`  • [탭 ${i + 1}] 상태: ${res.error.slice(0, 60)}`);
        }

        // 탭 간 초미세 간격
        await new Promise(r => setTimeout(r, 100));
      }

      if (matched) {
        log('🏁 [예매 완료] 프로세스를 종료합니다. 결제를 진행해 주세요.');
        break;
      }

    } catch (err) {
      log(`[Round ${round}] 오류: ${err.message}`);
    }

    round++;
    await new Promise(r => setTimeout(r, ROUND_INTERVAL_MS));
  }
}

main();

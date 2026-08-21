const { spawn } = require('child_process');

const debugScript = `
(async () => {
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

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  log('시작: ' + window.location.href);

  // 1. 일반 2인 탐색
  const allBtns = Array.from(document.querySelectorAll('button'));
  log('총 버튼 수: ' + allBtns.length);

  const aria2 = allBtns.find(b => b.getAttribute('aria-label') === '2 선택' || b.getAttribute('aria-label')?.includes('2'));
  const text2 = allBtns.filter(b => b.innerText.trim() === '2');
  log('aria2 발견: ' + (aria2 ? aria2.outerHTML.slice(0, 100) : '없음'));
  log('text2 발견 수: ' + text2.length);

  const target2 = aria2 || text2[0];
  if (target2) {
    fastClick(target2);
    log('일반 2인 클릭 수행');
  }
  await sleep(300);

  // 2. 새로고침 탐색
  const refreshBtn = allBtns.find(b => {
    const aria = b.getAttribute('aria-label') || '';
    const txt = b.innerText || '';
    const cls = b.className || '';
    return aria.includes('새로고침') || txt.includes('새로고침') || cls.includes('refresh') || cls.includes('reset');
  });
  log('새로고침 버튼: ' + (refreshBtn ? refreshBtn.outerHTML.slice(0, 100) : '없음'));
  if (refreshBtn) {
    fastClick(refreshBtn);
    log('새로고침 클릭 수행');
  }
  await sleep(500);

  // 3. 일반 2인 다시 클릭
  const freshBtns = Array.from(document.querySelectorAll('button'));
  const fresh2 = freshBtns.find(b => b.getAttribute('aria-label') === '2 선택') || freshBtns.filter(b => b.innerText.trim() === '2')[0];
  if (fresh2) {
    fastClick(fresh2);
    log('일반 2인 재선택 완료: ' + fresh2.className);
  }
  await sleep(300);

  // 4. 좌석 탐색
  const seats = Array.from(document.querySelectorAll('button, div, span, a')).filter(el => {
    const cls = el.className || '';
    const txt = el.innerText ? el.innerText.trim() : '';
    return (cls.includes('seat') || cls.includes('Seat')) && /^[A-Z]\\d+$/.test(txt);
  });
  log('감지된 좌석 요소 수: ' + seats.length + '개');
  if (seats.length > 0) {
    log('샘플 좌석: ' + seats.slice(0, 5).map(s => s.innerText.trim() + '(' + s.className + ')').join(', '));
  }

  return logs.join(' \\n');
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(debugScript)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.stderr.on('data', d => console.error(d.toString()));
proc.on('close', () => {
  console.log('실행 로그:\\n', out);
});
proc.stdin.write(appleScript);
proc.stdin.end();

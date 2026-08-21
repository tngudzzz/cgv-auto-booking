const { spawn } = require('child_process');

const testSeatClick = `
(() => {
  // Find B3 or C3
  const targetSeat = Array.from(document.querySelectorAll('.seatMainMap_seatNumber__zoUn_')).find(s => s.innerText.trim() === 'B3');
  if (!targetSeat) return 'B3 없음';

  const rect = targetSeat.getBoundingClientRect();
  const infoBefore = targetSeat.className;

  // React event trigger
  const clickEvent = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2
  });

  targetSeat.dispatchEvent(clickEvent);
  if (targetSeat.firstElementChild) {
    targetSeat.firstElementChild.dispatchEvent(clickEvent);
  }

  return JSON.stringify({
    name: targetSeat.innerText.trim(),
    rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
    before: infoBefore,
    after: targetSeat.className
  });
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(testSeatClick)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.on('close', () => {
  console.log('단일 좌석 클릭 테스트 결과:', out.trim());
});
proc.stdin.write(appleScript);
proc.stdin.end();

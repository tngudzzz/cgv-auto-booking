const { spawn } = require('child_process');

const testBottomBar = `
(() => {
  // Click A2
  const btnA2 = Array.from(document.querySelectorAll('button.seatMap_seatNumber__JHck5')).find(b => b.innerText.trim() === 'A2');
  if (btnA2) btnA2.click();

  // Find all active seats
  const activeSeats = Array.from(document.querySelectorAll('.seatMap_active__I_XA6, [class*="active"]')).map(b => b.innerText.trim());

  // Find bottom bar buttons
  const bottomBtns = Array.from(document.querySelectorAll('button')).map(b => ({
    text: b.innerText.trim(),
    cls: b.className,
    disabled: b.disabled
  })).filter(b => b.text === '선택' || b.text.includes('선택') || b.text.includes('결제') || b.text.includes('다음'));

  return JSON.stringify({
    activeSeats,
    bottomBtns
  });
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(testBottomBar)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.on('close', () => {
  console.log('하단 바 상태:\n', out.trim());
});
proc.stdin.write(appleScript);
proc.stdin.end();

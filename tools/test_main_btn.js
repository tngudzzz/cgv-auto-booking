const { spawn } = require('child_process');

const testMainButton = `
(() => {
  const btnA1 = Array.from(document.querySelectorAll('button.seatMap_seatNumber__JHck5')).find(b => b.innerText.trim() === 'A1') || document.querySelector('button.seatMap_seatNumber__JHck5');
  if (!btnA1) return 'A1 버튼 없음';

  const beforeClass = btnA1.className;
  
  // Try normal click + pointer events
  btnA1.click();

  const afterClass = btnA1.className;

  return JSON.stringify({
    text: btnA1.innerText.trim(),
    beforeClass,
    afterClass,
    parentCls: btnA1.parentElement.className
  });
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(testMainButton)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.on('close', () => {
  console.log('메인 좌석 버튼 클릭 테스트:', out.trim());
});
proc.stdin.write(appleScript);
proc.stdin.end();

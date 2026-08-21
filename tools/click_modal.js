const { spawn } = require('child_process');

const clickModalPay = `
(() => {
  const allBtns = Array.from(document.querySelectorAll('button'));
  // Click popup confirmation button
  const okBtn = allBtns.find(b => b.innerText.trim() === '확인' || b.innerText.trim() === '결제하기' && b.className.includes('fill-main'));
  if (okBtn) {
    okBtn.click();
    return '클릭 성공: ' + okBtn.innerText.trim();
  }
  return '버튼 없음';
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(clickModalPay)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.on('close', () => {
  console.log('팝업 결제 클릭 결과:', out.trim());
});
proc.stdin.write(appleScript);
proc.stdin.end();

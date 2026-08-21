const { spawn } = require('child_process');

const checkScript = `
(() => {
  const url = window.location.href;
  const generalTwoBtn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === '2 선택' || b.innerText.trim() === '2');
  const isGen2Selected = generalTwoBtn ? (generalTwoBtn.className + ' ' + (generalTwoBtn.getAttribute('aria-selected') || '')) : 'not found';
  const selectedSeats = Array.from(document.querySelectorAll('.seatSelected, [class*="Selected"], [class*="selected"]')).map(s => s.innerText.trim());
  const popup = document.querySelector('dialog, [role="dialog"], .popup');
  const popupText = popup ? popup.innerText.slice(0, 100) : 'none';

  return JSON.stringify({
    url,
    isGen2Selected,
    selectedSeats,
    popupText
  });
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(checkScript)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.on('close', () => {
  console.log('상태:', out);
});
proc.stdin.write(appleScript);
proc.stdin.end();

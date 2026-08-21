const { spawn } = require('child_process');

const inspectSeats = `
(() => {
  // All seat elements
  const allSeatEls = Array.from(document.querySelectorAll('[class*="seatNumber"], [class*="SeatNumber"], [class*="seatMainMap"], [class*="seatMap"], [class*="seat_"]')).map(el => ({
    tag: el.tagName,
    cls: el.className,
    text: el.innerText.trim(),
    html: el.outerHTML.slice(0, 150),
    onClick: typeof el.onclick,
    parentTag: el.parentElement ? el.parentElement.tagName : 'none'
  }));

  return JSON.stringify(allSeatEls.slice(0, 15));
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(inspectSeats)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.on('close', () => {
  console.log('좌석 요소 상세:\n', out.trim());
});
proc.stdin.write(appleScript);
proc.stdin.end();

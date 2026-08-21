const { spawn } = require('child_process');

const inspectDetails = `
(() => {
  try {
    const personnelSection = document.querySelector('section[class*="personnel"]');
    const personnelHTML = personnelSection ? personnelSection.outerHTML : 'no personnel';

    const seatMap = document.querySelector('[class*="seatMap"], [class*="SeatMap"], [class*="seatContainer"]');
    const seatMapHTML = seatMap ? seatMap.outerHTML.slice(0, 500) : 'no seatMap';

    const allButtons = Array.from(document.querySelectorAll('button')).map(b => ({
      title: b.getAttribute('title'),
      aria: b.getAttribute('aria-label'),
      text: b.innerText.trim(),
      cls: b.className
    }));

    return JSON.stringify({
      personnelHTML: personnelHTML.slice(0, 1000),
      seatMapHTML,
      buttonSample: allButtons.filter(b => b.title || b.text === '2' || b.text === '선택' || b.text.includes('결제'))
    });
  } catch (err) {
    return err.message;
  }
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(inspectDetails)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.on('close', () => {
  console.log('상세 구조:\n', out.trim());
});
proc.stdin.write(appleScript);
proc.stdin.end();

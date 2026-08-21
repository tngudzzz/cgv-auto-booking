const { spawn } = require('child_process');

const inspectMainMap = `
(() => {
  // Find all seat elements outside minimap
  const allSeatEls = Array.from(document.querySelectorAll('button, a, div, span')).filter(el => {
    const cls = el.className || '';
    const txt = (el.innerText || '').trim();
    const isMinimap = el.closest && el.closest('[class*="minimap"]');
    return !isMinimap && /^[A-Z]\\d+$/.test(txt);
  });

  return JSON.stringify(allSeatEls.map(el => ({
    tag: el.tagName,
    cls: el.className,
    text: el.innerText.trim(),
    parentTag: el.parentElement ? el.parentElement.tagName : '',
    parentCls: el.parentElement ? el.parentElement.className : ''
  })).slice(0, 15));
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(inspectMainMap)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.on('close', () => {
  console.log('실제 메인 좌석 맵 요소들:\n', out.trim());
});
proc.stdin.write(appleScript);
proc.stdin.end();

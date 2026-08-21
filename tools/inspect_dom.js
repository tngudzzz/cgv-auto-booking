const { spawn } = require('child_process');

const inspectButtons = `
(() => {
  const visitorHeader = Array.from(document.querySelectorAll('*')).find(el => el.children.length === 0 && el.innerText.trim() === '관람인원');
  const parent = visitorHeader ? visitorHeader.parentElement : null;
  const parentHTML = parent ? parent.outerHTML : 'no parent';
  
  const allClickables = Array.from(document.querySelectorAll('button, a, svg, img, [role="button"], span, div')).filter(el => {
    const txt = el.innerText || '';
    const aria = el.getAttribute('aria-label') || '';
    const cls = el.className || '';
    return typeof cls === 'string' && (cls.includes('refresh') || cls.includes('reset') || cls.includes('btn') || cls.includes('Btn') || aria.includes('새로고침') || txt.includes('새로고침'));
  }).map(el => ({ tag: el.tagName, class: el.className, aria: el.getAttribute('aria-label'), text: el.innerText.slice(0, 30), html: el.outerHTML.slice(0, 150) }));

  return JSON.stringify({
    parentHTML,
    allClickables: allClickables.slice(0, 10)
  });
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(inspectButtons)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.on('close', () => {
  console.log('관람인원 영역 구조:', out.trim());
});
proc.stdin.write(appleScript);
proc.stdin.end();

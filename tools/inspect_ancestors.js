const { spawn } = require('child_process');

const inspectAncestors = `
(() => {
  const target = Array.from(document.querySelectorAll('.seatMainMap_seatNumber__zoUn_')).find(s => s.innerText.trim() === 'B3') || document.querySelector('.seatMap_seatNormal__SojfU');
  if (!target) return '좌석 없음';

  const chain = [];
  let curr = target;
  while (curr && curr !== document.body) {
    const keys = Object.keys(curr).filter(k => k.startsWith('__react'));
    let props = [];
    keys.forEach(k => {
      if (curr[k] && typeof curr[k] === 'object') {
        props.push(k + ': ' + Object.keys(curr[k]).join(','));
      }
    });
    chain.push({
      tag: curr.tagName,
      cls: curr.className,
      id: curr.id,
      reactKeys: props
    });
    curr = curr.parentElement;
  }

  return JSON.stringify(chain);
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(inspectAncestors)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.on('close', () => {
  console.log('계층 구조 분석:\n', out.trim());
});
proc.stdin.write(appleScript);
proc.stdin.end();

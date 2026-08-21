const { spawn } = require('child_process');

const inspectReact = `
(() => {
  const target = Array.from(document.querySelectorAll('.seatMainMap_seatNumber__zoUn_')).find(s => s.innerText.trim() === 'B3') || document.querySelector('.seatMap_seatNormal__SojfU');
  if (!target) return '좌석 없음';

  const getReactProps = (el) => {
    const keys = Object.keys(el);
    const fiberKey = keys.find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    const propsKey = keys.find(k => k.startsWith('__reactProps') || k.startsWith('__reactEventHandlers'));
    return {
      fiberKey,
      propsKey,
      props: propsKey ? Object.keys(el[propsKey]) : [],
      parentProps: el.parentElement ? Object.keys(el.parentElement).filter(k => k.startsWith('__react')) : []
    };
  };

  const info = getReactProps(target);
  let handled = false;

  // If React props has onClick
  const key = Object.keys(target).find(k => k.startsWith('__reactProps'));
  if (key && target[key]) {
    if (typeof target[key].onClick === 'function') {
      target[key].onClick({ stopPropagation: () => {}, preventDefault: () => {} });
      handled = true;
    }
  }

  // Check parent
  const parent = target.closest('[class*="seatPositionWrap"], [class*="seatWrap"], [class*="SeatWrap"]');
  let parentKeyInfo = 'none';
  if (parent) {
    const pKey = Object.keys(parent).find(k => k.startsWith('__reactProps'));
    if (pKey && parent[pKey]) {
      parentKeyInfo = Object.keys(parent[pKey]).join(', ');
      if (typeof parent[pKey].onClick === 'function') {
        parent[pKey].onClick({ target, currentTarget: parent, stopPropagation: () => {}, preventDefault: () => {} });
        handled = true;
      }
    }
  }

  return JSON.stringify({
    info,
    parentKeyInfo,
    handled,
    afterClass: target.className
  });
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(inspectReact)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.on('close', () => {
  console.log('React Fiber 분석 결과:\n', out.trim());
});
proc.stdin.write(appleScript);
proc.stdin.end();

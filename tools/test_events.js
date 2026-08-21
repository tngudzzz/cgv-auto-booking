const { spawn } = require('child_process');

const testEvents = `
(() => {
  const targetSeat = Array.from(document.querySelectorAll('.seatMainMap_seatNumber__zoUn_')).find(s => s.innerText.trim() === 'B3') || document.querySelector('.seatMap_seatNormal__SojfU');
  if (!targetSeat) return '좌석 없음';

  const rect = targetSeat.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const eventTypes = ['pointerdown', 'mousedown', 'touchstart', 'pointerup', 'mouseup', 'touchend', 'click'];
  
  eventTypes.forEach(type => {
    let evt;
    if (type.startsWith('touch')) {
      const touch = new Touch({
        identifier: Date.now(),
        target: targetSeat,
        clientX: cx,
        clientY: cy,
        pageX: cx + window.scrollX,
        pageY: cy + window.scrollY
      });
      evt = new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        touches: type === 'touchend' ? [] : [touch],
        targetTouches: type === 'touchend' ? [] : [touch],
        changedTouches: [touch]
      });
    } else if (type.startsWith('pointer')) {
      evt = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: cx,
        clientY: cy,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        buttons: type.includes('down') ? 1 : 0
      });
    } else {
      evt = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: cx,
        clientY: cy,
        buttons: type.includes('down') ? 1 : 0
      });
    }

    targetSeat.dispatchEvent(evt);
    if (targetSeat.firstElementChild) targetSeat.firstElementChild.dispatchEvent(evt);
  });

  return JSON.stringify({
    seat: targetSeat.innerText.trim(),
    classes: targetSeat.className,
    parentClasses: targetSeat.parentElement.className
  });
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(testEvents)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.on('close', () => {
  console.log('이벤트 디스패치 결과:', out.trim());
});
proc.stdin.write(appleScript);
proc.stdin.end();

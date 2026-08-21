#!/usr/bin/env bash
# Chrome 활성 탭에서 CGV 즉시 예매 스크립트 실행

JS_CODE=$(cat << 'EOF'
(async function cgvInstantTest() {
  const fastClick = (el) => {
    if (!el) return false;
    const opts = { bubbles: true, cancelable: true, view: window, buttons: 1 };
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.click();
      return true;
    } catch (e) { el.click(); return true; }
  };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  console.log("🎬 [인시디어스] 좌석 화면 즉시 예매 테스트 시작");

  // 1. 일반 2인 선택
  const getGen2 = () => Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === '2 선택') || Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim() === '2')[0];
  const btn1 = getGen2();
  if (btn1) { fastClick(btn1); console.log("1. 일반 2인 클릭"); }
  await sleep(150);

  // 2. 새로고침 클릭
  const refreshBtn = Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('aria-label')||'').includes('새로고침') || (b.innerText||'').includes('새로고침') || b.className.includes('refresh') || (b.closest && b.closest('[class*="visitor"], [class*="Visitor"]') && b.querySelector('svg, img')));
  if (refreshBtn) { fastClick(refreshBtn); console.log("2. 새로고침 클릭"); }
  await sleep(350);

  // 3. 다시 일반 2인 선택
  const btn2 = getGen2();
  if (btn2) { fastClick(btn2); console.log("3. 일반 2인 재선택"); }
  await sleep(150);

  // 4. 잔여 2연석 자동 선택
  const seats = Array.from(document.querySelectorAll('.seatMap_seatNumber__JHck5, .seatMainMap_seatNumber__zoUn_, [class*="seatNumber"], button[class*="seat"]'))
    .filter(s => !s.className.includes('seatDisabled') && (s.className.includes('seatNormal') || !s.disabled))
    .map(el => ({ el, name: el.innerText.trim() }))
    .filter(item => /^[A-Z]\d+$/.test(item.name));

  const byRow = {};
  for (const item of seats) {
    const r = item.name[0], num = parseInt(item.name.slice(1), 10);
    if (!byRow[r]) byRow[r] = [];
    byRow[r].push({ num, el: item.el, name: item.name });
  }

  let pair = null;
  for (const r of Object.keys(byRow).sort()) {
    const rowSeats = byRow[r].sort((a, b) => a.num - b.num);
    for (let i = 0; i < rowSeats.length - 1; i++) {
      if (rowSeats[i + 1].num === rowSeats[i].num + 1) {
        pair = [rowSeats[i].el, rowSeats[i + 1].el, `${rowSeats[i].name}, ${rowSeats[i + 1].name}`];
        break;
      }
    }
    if (pair) break;
  }
  if (!pair && seats.length >= 2) pair = [seats[0].el, seats[1].el, `${seats[0].name}, ${seats[1].name}`];

  if (pair) {
    fastClick(pair[0]);
    fastClick(pair[1]);
    console.log("4. 좌석 2개 클릭 완료: " + pair[2]);
    await sleep(200);

    // 5. 선택 / 선택완료
    const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '선택' || b.innerText.includes('선택완료'));
    if (confirmBtn) { fastClick(confirmBtn); console.log("5. 선택 완료 클릭"); }
    await sleep(600);

    // 6. 결제하기
    const payBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('결제하기') || b.innerText.trim() === '결제');
    if (payBtn) { fastClick(payBtn); console.log("6. 결제하기 클릭"); }
    await sleep(600);

    // 7. 팝업 확인
    const dialog = document.querySelector('dialog, [role="dialog"], .layer_popup, .popup') || document.body;
    const okBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.innerText.trim() === '확인' || b.innerText.trim() === '결제하기');
    if (okBtn) { fastClick(okBtn); console.log("7. 팝업 확인 클릭"); }

    return "SUCCESS:" + pair[2];
  } else {
    return "NO_SEATS";
  }
})();
EOF
)

osascript << APPLESCRIPT
tell application "Google Chrome"
  set jsScript to "$JS_CODE"
  execute active tab of front window javascript jsScript
end tell
APPLESCRIPT

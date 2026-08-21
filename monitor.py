#!/usr/bin/env python3
"""
CGV 용산아이파크몰 IMAX 실시간 취소표 모니터링 데몬
"""
import subprocess
import time
import datetime
import os
import sys

LOG_FILE = "/Users/choesuhyeong/.gemini/antigravity/scratch/monitor.log"

def log(msg):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")
        f.flush()

SCRIPT_JS = """
try {
  await takeOverTaskSpace('cgv booking');
} catch (e) {}

const task = await useOrCreateTaskSpace('cgv booking');

// 1. 현재 열려 있는 탭 정리 및 좌석 선택 탭 확인
const tabs = await listTabs();
let seatTab = null;

for (const t of tabs) {
  try {
    await switchTab(t.targetId);
    await wait(0.2);
    const info = await pageInfo();
    if (info.url && info.url.includes('selectVisitorCnt')) {
      seatTab = t.targetId;
      break;
    }
  } catch (e) {}
}

if (!seatTab) {
  // 좌석 탭이 없으면 첫 탭 선택
  if (tabs.length > 0) {
    await switchTab(tabs[0].targetId);
  }
}

// [딜레이 제로 초고속 원자적 실행] 새로고침 -> 2인 재선택 -> 2연석 감지 -> 좌석클릭 -> 선택 -> 결제 -> 팝업확인까지 원샷 직행
const result = await js(`(async () => {
  // 1. React/가상 DOM 대응 초고속 합성 클릭 헬퍼
  function fastClick(element) {
    if (!element) return false;
    const opts = { bubbles: true, cancelable: true, view: window, buttons: 1 };
    try {
      element.dispatchEvent(new PointerEvent('pointerdown', opts));
      element.dispatchEvent(new MouseEvent('mousedown', opts));
      element.dispatchEvent(new PointerEvent('pointerup', opts));
      element.dispatchEvent(new MouseEvent('mouseup', opts));
      element.click();
      return true;
    } catch (e) {
      element.click();
      return true;
    }
  }

  // 2. 새로고침 버튼 즉각 클릭 (딜레이 0ms)
  const refreshBtn = document.querySelector('button[title="새로고침"]') ||
                     document.querySelector('.cnms01520_titleWrap__ITsqM button') ||
                     Array.from(document.querySelectorAll('button')).find(b => {
                       const aria = b.getAttribute('aria-label') || '';
                       const title = b.getAttribute('title') || '';
                       return aria.includes('새로고침') || title.includes('새로고침') || b.className.includes('refresh');
                     });

  if (refreshBtn) fastClick(refreshBtn);

  // 3. 10ms 초미세 폴링으로 '일반 2인' 즉시 재선택 (비동기 갱신 찰나 반응)
  const getGeneralTwoBtn = () => {
    const generalWrap = Array.from(document.querySelectorAll('.numberChoice_NumberWrap__JKTv1, [class*="NumberWrap"], [class*="numberChoice"]')).find(w => (w.innerText || '').includes('일반'));
    return generalWrap ? (generalWrap.querySelector('button[aria-label="2 선택"]') || Array.from(generalWrap.querySelectorAll('button')).find(btn => btn.innerText.trim() === '2'))
                       : document.querySelector('button[aria-label="2 선택"]');
  };

  const pollStart = performance.now();
  while (performance.now() - pollStart < 300) {
    const twoBtn = getGeneralTwoBtn();
    if (twoBtn && twoBtn.getAttribute('aria-pressed') !== 'true') {
      fastClick(twoBtn);
      break;
    }
    await new Promise(r => setTimeout(r, 10));
  }

  // 4. 실시간 메인 좌석 배치도 분석 (E열 이상 중앙 최단거리 2연석, 미니맵 제외)
  const allSeats = Array.from(document.querySelectorAll('button.seatMap_seatNumber__JHck5, .seatMap_seatPositionWrap__v5y_3 button'))
    .filter(b => {
      const cls = b.className || '';
      const txt = (b.innerText || '').trim();
      const isNormal = cls.includes('Normal') || cls.includes('normal') || !cls.includes('Disabled');
      return isNormal && /^[A-Z]\\\\d+$/.test(txt);
    })
    .map(b => ({ el: b, name: b.innerText.trim() }));

  const byRow = {};
  for (const item of allSeats) {
    const r = item.name[0];
    const num = parseInt(item.name.slice(1), 10);
    if (!byRow[r]) byRow[r] = [];
    byRow[r].push({ num, el: item.el, name: item.name });
  }

  const candidatePairs = [];
  for (const r of Object.keys(byRow).sort()) {
    if (r < 'E') continue; // A~D열 제외
    const seatsInRow = byRow[r].sort((a, b) => a.num - b.num);
    for (let i = 0; i < seatsInRow.length - 1; i++) {
      if (seatsInRow[i + 1].num === seatsInRow[i].num + 1) { // 2연석
        const s1 = seatsInRow[i];
        const s2 = seatsInRow[i + 1];
        const avgCol = (s1.num + s2.num) / 2;
        const distFromCenter = Math.abs(avgCol - 22);

        candidatePairs.push({
          seat1: s1.name,
          seat2: s2.name,
          el1: s1.el,
          el2: s2.el,
          distFromCenter,
          pairStr: s1.name + ', ' + s2.name
        });
      }
    }
  }

  candidatePairs.sort((a, b) => a.distFromCenter - b.distFromCenter);

  if (candidatePairs.length > 0) {
    const best = candidatePairs[0];

    // 즉시 좌석 2자리 클릭 (딜레이 0ms)
    fastClick(best.el1);
    fastClick(best.el2);

    // 하단 '선택' 또는 '선택완료' 즉시 클릭 (딜레이 0ms)
    const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '선택' || b.innerText.includes('선택완료'));
    if (confirmBtn) fastClick(confirmBtn);

    // 결제하기 및 팝업 확인 초고속 반응형 인터셉트 (10ms 폴링)
    const payStart = performance.now();
    let payClicked = false;
    let okClicked = false;

    while (performance.now() - payStart < 1500) {
      if (!payClicked) {
        const payBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('결제하기') || b.innerText.trim() === '결제');
        if (payBtn && !payBtn.disabled) {
          fastClick(payBtn);
          payClicked = true;
        }
      }
      if (payClicked && !okClicked) {
        const dialog = document.querySelector('dialog, [role="dialog"], .layer_popup, .popup') || document.body;
        const okBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.innerText.trim() === '확인' || (b.innerText.trim() === '결제하기' && b.className.includes('fill-main')));
        if (okBtn) {
          fastClick(okBtn);
          okClicked = true;
          break;
        }
      }
      await new Promise(r => setTimeout(r, 10));
    }

    return {
      found: true,
      pairStr: best.pairStr,
      totalAvailable: allSeats.length
    };
  }

  return {
    found: false,
    pairStr: null,
    totalAvailable: allSeats.length
  };
})()`);

if (result && result.found) {
  cliLog('STATUS:FOUND:' + result.pairStr);
  await handOffTaskSpace(task.id);
} else {
  cliLog('STATUS:SEARCHING:avail=' + (result ? result.totalAvailable : 0));
}
"""

def main():
    log("=== CGV 용산아이파크몰 IMAX 실시간 새로고침 모니터링 데몬 가동 ===")
    round_num = 1
    
    while True:
        try:
            cmd = ["ego-browser", "nodejs"]
            proc = subprocess.run(
                cmd,
                input=SCRIPT_JS,
                capture_output=True,
                text=True,
                timeout=30
            )
            output = proc.stdout.strip()
            
            if "STATUS:FOUND:" in output:
                pair = output.split("STATUS:FOUND:")[1].split()[0]
                log(f"🎉🎉 [취소표 발견 및 결제 진입 완료!] 좌석: {pair}")
                log("결제 페이지(https://cgv.co.kr/mpy/main)로 이동 완료. 사용자에게 제어권을 전달했습니다.")
                break
            elif "STATUS:SEARCHING:" in output:
                avail = output.split("STATUS:SEARCHING:")[1].strip()
                log(f"[Round {round_num}] 새로고침 완료 (현재 잔여석: {avail}석 / E열 이상 중앙 2연석 대기 중)")
            else:
                log(f"[Round {round_num}] 실행 상태: {output[:100]}")
                
        except Exception as e:
            log(f"[Round {round_num}] 오류: {str(e)}")
            
        round_num += 1
        time.sleep(5)

if __name__ == "__main__":
    main()

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const jsCode = fs.readFileSync(path.join(__dirname, 'cgv_fast_instant_run.js'), 'utf-8');

// Use JSON.stringify for safe JavaScript embedding inside AppleScript
const appleScript = `
tell application "Google Chrome"
  execute active tab of front window javascript ${JSON.stringify(jsCode)}
end tell
`;

console.log('🚀 Chrome 활성 탭에 CGV 자동 예매 스크립트 실행 중...');

const osascript = spawn('osascript', ['-']);

let stdout = '';
let stderr = '';

osascript.stdout.on('data', (d) => stdout += d.toString());
osascript.stderr.on('data', (d) => stderr += d.toString());

osascript.on('close', (code) => {
  if (code === 0) {
    console.log('🎉 [실행 완료] Chrome에서 좌석 선택 및 결제창 진입 시퀀스가 실행되었습니다!');
    if (stdout.trim()) console.log('결과:', stdout.trim());
  } else {
    console.error('❌ [실행 실패] 에러 코드:', code);
    console.error(stderr);
  }
});

osascript.stdin.write(appleScript);
osascript.stdin.end();

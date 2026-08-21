const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const jsCode = fs.readFileSync(path.join(__dirname, 'cgv_fast_instant_run.js'), 'utf-8');

const appleScript = `
tell application "Google Chrome"
  execute active tab of front window javascript ${JSON.stringify(jsCode)}
end tell
`;

console.log('⚡ [딜레이 제로] Chrome 활성 탭에 초고속 원자적 선점 스크립트 실행 중...');

const osascript = spawn('osascript', ['-']);
let out = '';
let err = '';

osascript.stdout.on('data', d => out += d);
osascript.stderr.on('data', d => err += d);

osascript.on('close', (code) => {
  if (code === 0) {
    console.log('🏁 [전송 완료] 0ms 딜레이 초고속 선점 시퀀스가 실행되었습니다.');
    if (out.trim()) console.log(out.trim());
  } else {
    console.error('오류:', err);
  }
});

osascript.stdin.write(appleScript);
osascript.stdin.end();

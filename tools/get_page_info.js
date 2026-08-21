const { spawn } = require('child_process');

const getPageInfo = `
(() => {
  const title = document.title;
  const movieHeader = document.querySelector('h1, h2, h3, [class*="movieTitle"], [class*="title"]') ? document.querySelector('h1, h2, h3, [class*="movieTitle"], [class*="title"]').innerText.trim() : '';
  const theater = document.querySelector('[class*="theater"], [class*="Theater"]') ? document.querySelector('[class*="theater"], [class*="Theater"]').innerText.trim() : '';
  return JSON.stringify({ title, movieHeader, theater, url: window.location.href });
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(getPageInfo)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.on('close', () => {
  console.log('페이지 정보:', out.trim());
});
proc.stdin.write(appleScript);
proc.stdin.end();

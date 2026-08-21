const { spawn } = require('child_process');

const inspectSafe = `
(() => {
  try {
    const el = document.body;
    // Find any element with text '관람인원'
    const headers = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, div, span, p')).filter(e => e.innerText && e.innerText.includes('관람인원') && e.children.length <= 2);
    
    const results = [];
    headers.forEach(h => {
      results.push('HEADER: ' + h.outerHTML.slice(0, 200));
      if (h.parentElement) {
        results.push('PARENT: ' + h.parentElement.outerHTML.slice(0, 300));
      }
    });

    // Check all buttons
    const btns = Array.from(document.querySelectorAll('button')).map(b => ({
      aria: b.getAttribute('aria-label'),
      text: b.innerText.trim(),
      cls: b.className,
      html: b.outerHTML.slice(0, 100)
    }));

    return JSON.stringify({ headers: results, btns: btns.slice(0, 20) });
  } catch (err) {
    return 'ERROR: ' + err.message;
  }
})()
`;

const appleScript = `
tell application "Google Chrome"
  return execute active tab of front window javascript ${JSON.stringify(inspectSafe)}
end tell
`;

const proc = spawn('osascript', ['-']);
let out = '';
proc.stdout.on('data', d => out += d);
proc.on('close', () => {
  console.log('결과:\n', out.trim());
});
proc.stdin.write(appleScript);
proc.stdin.end();

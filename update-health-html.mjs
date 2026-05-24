import fs from 'fs';

let html = fs.readFileSync('health-check.html', 'utf8');

// Find where Auto Health Check settings start and remove it up to the script tag
const startIndex = html.indexOf('<!-- Auto Health Check settings -->');
if (startIndex !== -1) {
  const endIndex = html.indexOf('<script src="health-check.js"></script>', startIndex);
  if (endIndex !== -1) {
    html = html.substring(0, startIndex) + '  </div>\n  ' + html.substring(endIndex);
    fs.writeFileSync('health-check.html', html);
    console.log('Removed settings from health-check.html');
  }
}

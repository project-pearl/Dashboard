const fs = require('fs');
const path = require('path');
const files = ['NationalCommandCenter','StateCommandCenter','MS4CommandCenter','K12CommandCenter','NGOCommandCenter','UniversityCommandCenter','SiteAssessmentCard'];
files.forEach(name => {
  const f = path.join('components', name + '.tsx');
  let s = fs.readFileSync(f, 'utf8');
  const bad = 'addText(clean\x60';
  const good = 'addText(clean(\x60';
  let count = 0;
  while (s.includes(bad)) { s = s.replace(bad, good); count++; }
  if (count) { fs.writeFileSync(f, s); console.log('Fixed ' + count + ' in ' + name); }
  else console.log(name + ': already clean');
});

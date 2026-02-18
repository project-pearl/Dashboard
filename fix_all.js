const fs = require('fs');
const path = require('path');

const files = [
  'NationalCommandCenter',
  'StateCommandCenter', 
  'MS4CommandCenter',
  'K12CommandCenter',
  'NGOCommandCenter',
  'UniversityCommandCenter',
  'SiteAssessmentCard'
];

files.forEach(name => {
  const f = path.join('components', name + '.tsx');
  let s = fs.readFileSync(f, 'utf8');
  
  // Collapse any number of (( back to single (
  // Match clean( followed by one or more extra (
  let before = s;
  while (s.includes('clean((')) {
    s = s.replace(/clean\(\(+/g, 'clean(');
  }
  
  // Also fix any remaining tagged template: clean` -> clean(`
  s = s.replace(/addText\(clean`/g, 'addText(clean(`');
  
  if (s !== before) {
    fs.writeFileSync(f, s);
    console.log('Fixed: ' + name);
  } else {
    console.log(name + ': already clean');
  }
});

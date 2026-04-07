const fs = require('fs');
const path = 'src/lib/db/queries.ts';
let content = fs.readFileSync(path, 'utf8');
content = content.replace('\\${CUP_FIXTURE_JOIN_INNER}', '${CUP_FIXTURE_JOIN_INNER}');
fs.writeFileSync(path, content);
console.log('Fixed interpolation in queries.ts');

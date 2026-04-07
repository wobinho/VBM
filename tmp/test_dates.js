const start = new Date(2026, 4, 1);
const end = new Date(2026, 5, 30);
const all = [];
for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
  if ([1, 3, 5].includes(d.getDay())) {
    all.push(new Date(d).toISOString().slice(0, 10));
  }
}
console.log('All Mon/Wed/Fri in May/June 2026:', all.slice(0, 10));
const round1 = all.slice(0, 5);
const round2 = all.slice(6, 11);
const round3 = all.slice(12, 17);
console.log('Round 1 Dates:', round1);
console.log('Round 2 Dates:', round2);
console.log('Round 3 Dates:', round3);

async function testAdvanceDay() {
  try {
    const res = await fetch('http://localhost:3000/api/advance-day', {
      method: 'POST',
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error testing advance-day:', e);
  }
}

testAdvanceDay();

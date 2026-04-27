const axios = require('axios');

async function testHead() {
  const url = 'https://morristreesfl.com/rock-mulching/';
  try {
    await axios.head(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log('HEAD passed!');
  } catch (err) {
    console.log('HEAD failed:', err.response && err.response.status);
    try {
      await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log('GET passed!');
    } catch (err2) {
      console.log('GET failed:', err2.response && err2.response.status);
    }
  }
}
testHead();

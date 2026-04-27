const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const url = 'https://morristreesfl.com';
  const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
  const $ = cheerio.load(response.data);
  const links = [];
  $('a[href]').each((i, el) => {
    links.push($(el).attr('href'));
  });
  console.log('Total links found on homepage:', links.length);
  const target = links.find(l => l.includes('rock-mulching'));
  console.log('Found rock-mulching?', target);
}
test();

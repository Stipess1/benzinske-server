var request = require('request');
var zlib = require('zlib');
const NodeCache = require('node-cache');
const express = require('express');
const app = express();

const myCache = new NodeCache();
const PORT = process.env.PORT || 3000;

// Function to calculate time remaining until 2 minutes after midnight
function getTTL() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 2); // Next midnight + 2 minutes
  return (midnight - now) / 1000; // Return the TTL in seconds
}

var allowCrossDomain = function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

  // Intercept OPTIONS method
  if ('OPTIONS' == req.method) {
    res.send(200);
  } else {
    next();
  }
};

app.use(allowCrossDomain);

var headers = {
  'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3',
  'accept-language': 'en-US,en;q=0.8',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/537.13+ (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2',
};

var options = {
  url: 'http://mzoe-gor.hr/data.gz',
  headers: headers,
  rejectUnauthorized: false,
};

app.get('/', function (req, res) {
  if (req.headers.authorization === 's7SrVBAkT2WudQW5') console.log('hello');

  // Check if data is in cache
  let cachedData = myCache.get('cachedData');
  if (cachedData) {
    res.end(cachedData);
    return;
  }

  var requestWithEncoding = function (options, callback) {
    var req = request.get(options);

    req.on('response', function (res) {
      var chunks = [];
      res.on('data', function (chunk) {
        chunks.push(chunk);
      });

      res.on('end', function () {
        var buffer = Buffer.concat(chunks);
        zlib.gunzip(buffer, function (err, decoded) {
          callback(err, decoded && decoded.toString());
        });
      });
    });

    req.on('error', function (err) {
      callback(err);
    });
  };

  requestWithEncoding(options, function (err, data) {
    if (err) {
      res.status(500).send('Error fetching data');
      return;
    }

    let temp = JSON.parse(data);
    delete temp['naseljes'];
    delete temp['opcina_grads'];
    delete temp['zupanijas'];
    // neke benzinske postaje imaju krivo postavljene vrste goriva
    for (let i = 0; i < temp['gorivos'].length; i++) {
      let gorivo = temp['gorivos'][i];
      if ((gorivo['naziv'] === 'EURODIESEL BS' && gorivo['id'] == 29) || gorivo['id'] == 1055) {
        gorivo['vrsta_goriva_id'] = 8;
      } else if (gorivo['id'] == 30) {
        gorivo['vrsta_goriva_id'] = 7;
      }
    }

    const result = JSON.stringify(temp);

    // Cache the result with TTL until 2 minutes after midnight
    const ttl = getTTL();
    myCache.set('cachedData', result, ttl);
    res.end(result);
  });
});

app.get('/ping', function (req, res) {
  res.end('Pinged!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

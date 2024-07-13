const request = require('request');
const zlib = require('zlib');
const NodeCache = require('node-cache');
const express = require('express');
const app = express();

const myCache = new NodeCache();
const PORT = process.env.PORT || 3000;

const allowCrossDomain = function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  if ('OPTIONS' == req.method) {
    res.sendStatus(200);
  } else {
    next();
  }
};

app.use(allowCrossDomain);

const headers = {
  'accept-charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3',
  'accept-language': 'en-US,en;q=0.8',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/537.13+ (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2',
};

const options = {
  url: 'http://mzoe-gor.hr/data.gz',
  headers: headers,
  rejectUnauthorized: false,
};

function fetchData(callback) {
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
}

function cacheData(key, data) {
  const ttl = getTTL();
  myCache.set(key, data, ttl);
}

function getTTL() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 2);
  return (midnight - now) / 1000;
}

// Fetch all data and cache them in different keys
function fetchAndCacheAllData(callback) {
  fetchData(function (err, data) {
    if (err) {
      console.error('Error fetching data:', err);
      if (callback) callback(err, null);
      return;
    }
    const parsedData = JSON.parse(data);

    // Cache different parts of data in different keys
    cacheData('allData', parsedData);
    cacheData('postajas', parsedData['postajas']);
    cacheData('gorivos', parsedData['gorivos']);
    cacheData('obvezniks', parsedData['obvezniks']);
    cacheData('opcijas', parsedData['opcijas']);
    cacheData('vrsta_danas', parsedData['vrsta_danas']);
    cacheData('vrsta_gorivas', parsedData['vrsta_gorivas']);
    cacheData('tip_gorivas', parsedData['tip_gorivas']);

    if (callback) callback(null, parsedData);
  });
}

// Cache all data on server start
fetchAndCacheAllData();

// Refresh cache at 2 minutes after midnight
setInterval(fetchAndCacheAllData, 24 * 60 * 60 * 1000); // 24 hours

// Middleware to get data from cache or fetch from source
function getDataFromCacheOrFetch(key, fetchFunction, callback) {
  const data = myCache.get(key);
  if (data) {
    callback(null, data);
  } else {
    fetchFunction(function (err, fetchedData) {
      if (err) {
        console.error(`Error fetching ${key}:`, err);
        callback(err, null);
        return;
      }
      cacheData(key, fetchedData);
      callback(null, fetchedData);
    });
  }
}

// Define routes
app.get("/", function (req, res) {
  getDataFromCacheOrFetch('allData', fetchAndCacheAllData, function (err, data) {
    if (err) {
      res.status(500).send("Error fetching data");
      return;
    }

    let temp = JSON.parse(JSON.stringify(data)); // Clone data to avoid mutation
    delete temp['naseljes'];
    delete temp['opcina_grads'];
    delete temp['zupanijas'];
    // neke benzinske postaje imaju krivo postavljene vrste goriva
    for (let i = 0; i < temp['gorivos'].length; i++) {
      let gorivo = temp['gorivos'][i];
      if (gorivo['naziv'] === "EURODIESEL BS" && (gorivo['id'] == 29 || gorivo['id'] == 1055)) {
        gorivo['vrsta_goriva_id'] = 8;
      } else if (gorivo['id'] == 30) {
        gorivo['vrsta_goriva_id'] = 7;
      }
    }

    res.json(temp);
  });
});

app.get("/postajas", function (req, res) {
  getDataFromCacheOrFetch('postajas', fetchAndCacheAllData, function (err, data) {
    if (err) {
      res.status(500).send("Error fetching data");
      return;
    }
    res.json(data);
  });
});

app.get("/gorivos", function (req, res) {
  getDataFromCacheOrFetch('gorivos', fetchAndCacheAllData, function (err, data) {
    if (err) {
      res.status(500).send("Error fetching data");
      return;
    }
    res.json(data);
  });
});

app.get("/opcijas", function (req, res) {
  getDataFromCacheOrFetch('opcijas', fetchAndCacheAllData, function (err, data) {
    if (err) {
      res.status(500).send("Error fetching data");
      return;
    }
    res.json(data);
  });
});

app.get("/:dataType/:id", function (req, res) {
  const { dataType, id } = req.params;
  getDataFromCacheOrFetch(dataType, fetchAndCacheAllData, function (err, data) {
    if (err) {
      res.status(500).send("Error fetching data");
      return;
    }
   
    if (!data) {
      res.status(404).send("Data not found");
      return 
    }

    const item = data.find(item => item.id == id);
    if (!item) {
      res.status(404).send("Item not found");
      return;
    }

    res.json(item);
  });
});

// Add more routes for other endpoints as needed...

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

var request = require('request'),
  zlib = require('zlib');
  
const express = require('express');
const app = express();

var headers = {
  "accept-charset" : "ISO-8859-1,utf-8;q=0.7,*;q=0.3",
  "accept-language" : "en-US,en;q=0.8",
  "accept" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "user-agent" : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/537.13+ (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2",
};

var options = {
  url: "http://mzoe-gor.hr/data.gz",
  headers: headers,
  "rejectUnauthorized": false
};

app.get("/", function(req, res) {
var requestWithEncoding = function(options, callback) {
  var req = request.get(options);

  req.on('response', function(res) {
    var chunks = [];
    res.on('data', function(chunk) {
      chunks.push(chunk);
    });

    res.on('end', function() {
      var buffer = Buffer.concat(chunks);
      
      zlib.gunzip(buffer, function(err, decoded) {
          callback(err, decoded && decoded.toString());
        });
    });
  });

  req.on('error', function(err) {
    callback(err);
  });
}

requestWithEncoding(options, function(err, data) {
  if (err) console.log(err);
  else console.log(data);
});
}



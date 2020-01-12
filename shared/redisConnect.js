'use strict';

var redis = require('redis');

module.exports = function(uri, callback) {
    var client;
    if(uri) {
	console.log("hey");
        var rtg = require('url').parse(uri);
        client = redis.createClient(rtg.port, rtg.hostname);
        client.auth(rtg.auth.split(':')[1]);
	console.log(rtg.port);
    }
    else {
        client = redis.createClient();
    }

    if(callback) {
	console.log("woah");
        client.on('ready', function() {
            callback(null);
        });
        client.on('error', function(err) {
            callback(err);
        });
    }

    return client;
};
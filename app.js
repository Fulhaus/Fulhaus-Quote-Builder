var express = require('express');
var Airtable = require('airtable');

var app = express();
var base = new Airtable({apiKey: 'keyVjcU07cHQbToae'}).base('appdOBdOVVYq3gjom');

base('Purchase Orders / Quotes').select({
    // Selecting the first 3 records in Grid view:
    maxRecords: 10,
    view: "Grid view"
}).eachPage(function page(records, fetchNextPage) {
    // This function (`page`) will get called for each page of records; pagination at 100 records by default

    records.forEach(function(record) {
		// test to list POs with costs
        console.log('P.O.:\t', (record.get('Name')+"                  ").substring(0, 34), '\t\tCost:\t', record.get('Order Total (CAD)'));
    });

    // To fetch the next page of records, call `fetchNextPage`.
    // If there are more records, `page` will get called again, else `done` will get called.
    fetchNextPage();

}, function done(err) {
    if (err) { console.error(err); return; }
});


//---- test code for server listener ----
// This listener will eventually parse quote requests, fetch data from airtable, return info to user (via email?)

// const http = require('http');

// http.createServer((request, response) => {
// 	const { headers, method, url } = request;
// 	let body = [];
// 	request.on('error', (err) => {
// 		console.error(err);
// 	}).on('data', (chunk) => {
// 		body.push(chunk);
// 	}).on('end', () => {
// 		body = Buffer.concat(body).toString();
// 		// BEGINNING OF NEW STUFF

// 		response.on('error', (err) => {
// 		console.error(err);
// 		});

// 		response.writeHead(200, {'Content-Type': 'application/json'})

// 		const responseBody = { headers, method, url, body };

// 		response.write(JSON.stringify(responseBody));
// 		response.end();
// 		// Note: the 2 lines above could be replaced with this next one:
// 		// response.end(JSON.stringify(responseBody))
// 	});
// }).listen(8080);
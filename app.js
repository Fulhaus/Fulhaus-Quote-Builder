var express = require('express');
var Airtable = require('airtable');

var app = express();
var base = new Airtable({apiKey: 'keyVjcU07cHQbToae'}).base('appdOBdOVVYq3gjom'); // TODO: base for quote info

app.get('/', function(req, res) {

})
// test inputs
var testjson = '{"HAUS1-COR-FUL": 1, "HAUS2-LUX-FUL": 2, "HAUS4-LUX-FUL": 1}';
quoteItems = JSON.parse(testjson);

// Print headers for columns
console.log('SKU\t\t Vendor Product Name\t\t\t\t\t Qt.\t Price\t\t Total');

base('Vendor Product Library').select({
	fields: ['SKU', 'Vendor Product Name', 'Unit Price (CAD)'],
	filterByFormula: 'SEARCH("HAUS", SKU) >= 1', // SKU begins with 'HAUS'
}).eachPage(function page(records, fetchNextPage) { //func page called for each page of records; default pagination 100
    records.forEach(function(record) {
		var sku = record.get('SKU'); 
		if (sku in quoteItems) { // Check if sku is contained in quote; if so, log and note quantity
			console.log(
				sku,'\t', 
				(record.get('Vendor Product Name') + "            ").substring(0,50),'\t', 
				quoteItems[sku], '\t', 
				record.get('Unit Price (CAD)').toFixed(2), '\t', 
				(record.get('Unit Price (CAD)')*quoteItems[sku]).toFixed(2)
			); 
		}
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
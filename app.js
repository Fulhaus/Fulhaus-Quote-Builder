const buildquote = require('./db/buildquote.js');
const http = require('http');

// Simple server listener; receives request from quoteform, calls quote builder
http.createServer((request, response) => {
	//console.log("Request received!");
	//const { headers, method, url } = request;
	let body = [];
	request.on('error', (err) => {
		console.error(err);
	}).on('data', (chunk) => {
		body.push(chunk);
	}).on('end', () => {
		body = Buffer.concat(body).toString();
		var quotequery = JSON.parse(body);
		buildquote.makeQuote(quotequery);
	});
	response.writeHead(200);
	response.end(); // Must send response so form doesn't timeout
}).listen(8080, '127.0.0.1');
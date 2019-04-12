const Airtable = require('airtable');
var base = new Airtable({apiKey: 'keyVjcU07cHQbToae'}).base('appdOBdOVVYq3gjom');

/**
 * Need to create quote and get record ID
 * THEN create line items and attach quote's record ID
 * THEN add line items by record ID to quote (2 way link??)
 */

async function store(quoteid) {
	try {
		var newQuote = await storeQuote(quoteid);
		var quoteItems = await findQuoteItems(newQuote.id, newQuote.quote);
		makeLineItems(quoteItems.id, quoteItems.arr);
	} catch (err) {
		console.error(err);
	}
}

function storeQuote(quote) { // THIS should return a promise, then we call it and attach .then's to the call?
	return new Promise(function(resolve, reject) {
		// First we create the quote record, filling in client info
		base('Generated Quotes').create({
			"Project Name": quote['projectname'],
			"Client Name": quote['clientname'],
			"Primary Contact" : quote['clientemail'],
			"Project Address": quote['projectaddress'],
			//More fields if desired
		}, function(err, record) {
			if (err) { 
				reject(err); 
			} else {
				resolve({
					id: record.getId(),
					quote: quote
				});
			}
		});
	});
}

function findQuoteItems(quoteID, quote) {
	return new Promise(function(resolve, reject) {
		var vendorProductArr = [];
		base('Vendor Product Library').select({
			fields: ['SKU', 'Vendor Product Name', 'Unit Price (CAD)'],
			filterByFormula: 'SEARCH("HAUS", SKU) >= 1', // SKU begins with 'HAUS'
		}).eachPage(function page(records, fetchNextPage) { //func page called for each page of records; default pagination 100
			records.forEach(function(record) {
				var sku = record.get('SKU'); 
				if (sku in quote) { // Check if sku is contained in quote; if so, log and note quantity
					var recID = record.getId();
					vendorProductArr[recID] = quote[sku]; // to array, add the record ID and the quantity
				}
			});
			fetchNextPage();
		}, function done(err) {
			if (err) {
				reject(err); 
			} else {
				resolve({
					id: quoteID,
					arr: vendorProductArr
				});
			}
		});
	});
}

function makeLineItems(quoteID, lineItems) {
	return new Promise(function(resolve, reject) {
		var length = Object.keys(lineItems).length;
		for (i = 0; i < length; i++) {
			var key = Object.keys(lineItems)[i];
			base('Quote Line Items').create({
				"Linked Product" : [key],
				"QTY" : parseInt(lineItems[key]),
				"Related Quote" : [quoteID],
			}, function(err, record) {
				if (err) { 
					reject(err); 
				} else {
					if (i == length-1) {
						resolve(record);
					}
				}
			});
		}
	});
}

module.exports = { store };

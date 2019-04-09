const Airtable = require('airtable');
var base = new Airtable({apiKey: 'keyVjcU07cHQbToae'}).base('appdOBdOVVYq3gjom');

/**
 * Need to create quote and get record ID
 * THEN create line items and attach quote's record ID
 * THEN add line items by record ID to quote (2 way link??)
 */
function makeQuote(quote) {
	// First we create the quote record, filling in client info
	base('Generated Quotes').create({
		"Project Name": quote['projectname'],
		"Client Name": quote['clientname'],
		"Primary Contact" : quote['clientemail'],
		"Project Address": quote['projectaddress'],
		//More fields if desired
	} , function(err, record) {
		if (err) { console.error(err); return; }
		findQuoteItems(record.getId(), quote); // Now record-create finished and returned, we can make the line items
	});
}

function findQuoteItems(quoteID, quote) {
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
		if (err) { console.error(err); return; }
		makeLineItems(quoteID, vendorProductArr);
	});
}

function makeLineItems(quoteID, lineItems) {
	var quoteItems = [];
	for (i in lineItems) {
		console.log("Making quote line item: ", i, " with qty :", lineItems[i]);
		base('Quote Line Items').create({
			"Linked Product" : [i],
			"QTY" : parseInt(lineItems[i]),
			"Related Quote" : [quoteID],
		}, function(err, record) {
			if (err) { console.error(err); return; }
			quoteItems.push(record.getId()); // once again, we save recordIDs in an array this time
		});
	}
	linkLineItems(quoteID, quoteItems);
}

function linkLineItems(quoteID, itemArray) {
	console.log("Linking line items.");
	var itemstring = "'" + itemArray.join("','") + "'";
	base('Generated Quotes').update(quoteID, {
		"Quote Line Items" : [ itemstring ],
	});
}

module.exports = { makeQuote };
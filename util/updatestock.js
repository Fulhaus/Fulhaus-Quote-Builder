const fs = require('fs');
const Airtable = require('airtable');
const base = new Airtable({apiKey: 'keyZ0zojIuzRN8VWU'}).base('appdOBdOVVYq3gjom');

const SKUregex = /#|ID|Part|SKU|Item|Mat'l|Product|product/;
const QTYregex = /QTY|Quantity|Inventory|QOH|Avail|qty/;
const ETAregex = /ETA|eta|Next Deliv|Scheduled|ship date|Ship Date|Exp Date|BACK ORDER/;

var csvsToRead = fs.readdirSync('./vendorcsv'); //process.argv[2];

var existingSKUs = [];
var existingRecs = [];

base('Vendor Product Library').select({
	fields: ['SKU'],
}).eachPage(function page(records, fetchNextPage) {
	records.forEach(function(record) {
		//console.log(record.get('SKU'));
		if (record.get('SKU') != null) {
			existingSKUs.push(record.get('SKU'));
			existingRecs.push(record.getId());
		}
		//console.log(existingSKUs[existingSKUs.length-1], " : ", existingRecs[existingRecs.length-1]);
	});
	fetchNextPage();
}, function done(err) {
	if (err) { console.error(err); return; }
	console.log(existingSKUs.length + " and " + existingRecs.length);
	updateStock();
});

 
function updateStock() {
	var date = getDateFormatted();
	var OoS = [];
	for (csv of csvsToRead) {
		var csvlines = fs.readFileSync('./vendorcsv/'+csv, {encoding: 'utf-8'} ).split(/\r?\n\r?/);
		// if csv begins with TOV => switch parsing to sum qtys
		var SKUcol = findCol(csvlines[0], SKUregex);
		if (SKUcol < 0) { SKUcol = findCol(csvlines[1], SKUregex); }

		var QTYcol = findCol(csvlines[0], QTYregex);
		if (QTYcol < 0) { QTYcol = findCol(csvlines[1], QTYregex); }
		if (csvlines[8] == "CA_FL_TOTAL_ON_HAND") { QTYcol = 8; }

		var ETAcol = findCol(csvlines[0], ETAregex);
		if (ETAcol < 0) { ETAcol = findCol(csvlines[1], ETAregex); }

		if (csv.startsWith('TOV')) {
			ETAcol = -1;
			console.log("Tov!!!");
		}
		//console.log(SKUcol, ' and ', QTYcol);
		var filteredCSV = csvlines.filter(line => {
			//console.log("Looking for :"+ line.split(',')[SKUcol]+" result: "+existingSKUs.includes(line.split(',')[SKUcol]));
			return (existingSKUs.includes(line.split(',')[SKUcol]));
		});
		
		for (line of filteredCSV) {
			var lineCols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
			
			if (parseInt(lineCols[QTYcol]) == 0) {
				OoS.push(lineCols[SKUcol]);
			}
			var idx = existingSKUs.findIndex((element) => {
				return (element === lineCols[SKUcol]);
			});
			//console.log(lineCols[SKUcol],'\t',lineCols[QTYcol],'\t',existingRecs[idx]);
			if (csv.startsWith('TOV')) {
				base('Vendor Product Library').update(existingRecs[idx], {
					"Stock Qty (from CSVs)": 'Coro CA: '+lineCols[2]+', Grns NC: '+lineCols[3]+', MoVa CA: '+lineCols[4],
					"Stock Date As Of": date,
					"Restock Date": ETAcol == -1 ? "" : lineCols[ETAcol]
				}, {typecast: true}, function(err, record) {
					if (err) { console.error(err); return; }
					//console.log(record.get('SKU'), '\t', record.get('Stock Qty'), '\t', record.getId());
				}); 
			} else {
				base('Vendor Product Library').update(existingRecs[idx], {
					"Stock Qty (from CSVs)": lineCols[QTYcol],
					"Stock Date As Of": date,
					"Restock Date": ETAcol == -1 ? "" : lineCols[ETAcol]
				}, {typecast: true}, function(err, record) {
					if (err) { console.error(err); return; }
					//console.log(record.get('SKU'), '\t', record.get('Stock Qty'), '\t', record.getId());
				}); 
			}
		}
	}
	console.log('Out of stock items: ', OoS);
}

// This function reads the first line (or two) of a csv and tries to determine which
// column holds the SKU, and which holds the quantity. 
function findCol(line, regex) {
	var cols = line.split(',');
	for (i = 0; i < cols.length; i++) {
		if (regex.test(cols[i])) {
			return i;
		}
	}
	return -1;
}

function getDateFormatted() {
	var today = new Date();
	var dd = today.getDate();
	var mm = today.getMonth();
	var yyyy = today.getFullYear();

	if (dd < 10) dd = '0'+dd;
	if (mm < 10) mm = '0'+mm;

	return mm+'/'+dd+'/'+yyyy;
}
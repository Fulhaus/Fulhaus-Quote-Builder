const Airtable = require('airtable');
const base = new Airtable({apiKey: 'keyZ0zojIuzRN8VWU'}).base('appdOBdOVVYq3gjom');
const fs = require('fs');
const pdfmake = require('pdfmake');
const https = require('https');

var fonts = {
	Helvetica: {
		normal: 'Helvetica',
		bold: 'Helvetica-Bold',
		italics: 'Helvetica-Oblique',
		bolditalics: 'Helvetica-BoldOblique'
	},
};

const doc = new pdfmake(fonts);

// Vendor POs will have the vendor NAME and PO RECORDID stored at the same index in the following arrays, respectively
var vendorNames = [];
var PORecs = [];
var docBodies = [];

var date = '06/04/2019';

async function main() {
	base('Sourced Products').select({
		view: "Kalin's Special View Don't Touch",
		//maxRecords: 10
	}).eachPage(async function page(records, fetchNextPage) {
		for (record of records) {
			if (!vendorNames.includes(record.get('Vendor Formatted')[0])) {
				var PO = await makeNewPO(record.get('Vendor Formatted')[0]);
				vendorNames.push(record.get('Vendor Formatted')[0]);
				PORecs.push(PO);
				docBodies.push([]);
			}
			var i = vendorNames.indexOf(record.get('Vendor Formatted')[0]);
			console.log("Found Vendor "+ vendorNames[i]+" at index "+i);
			// If SKU is already in a PO, we should update the QTY instead
			var n = docBodies[i].findIndex((row) => { return row[1] == record.get('SKU'); });
			if (n >= 0) {
				docBodies[i][n][5] += record.get('QTY Ordered');
				console.log(docBodies[i][n][6]);
				docBodies[i][n][6] = (parseFloat(docBodies[i][n][6]) + parseFloat(record.get('Trade Price x QTY (USD)'))).toFixed(2);
				console.log(docBodies[i][n][6]);
			} else {
				var rowData = [];
				rowData.push(docBodies[i].length+1);
				rowData.push(record.get('SKU')[0]);
				rowData.push(record.get('Vendor Product Name')[0]);
				var imgpath = await downloadImage(record.get('Images')[0].url);
				rowData.push({image: imgpath, width: 50});
				rowData.push(record.get('Trade Price (USD)').toFixed(2));
				rowData.push(record.get('QTY Ordered'));
				rowData.push(record.get('Trade Price x QTY (USD)').toFixed(2));
				docBodies[i].push(rowData)
			}
			await attachPO(record.getId(), PORecs[i].getId());
		}
		fetchNextPage();
	}, async function done(err) {
		if (err) {
			console.log(err);
		}
		var len = PORecs.length;
		for (i = 0; i < len; i++) {
			PORecs[i] = await getPO(PORecs[i].getId());
			console.log("Calling PO builder!");
			await buildPO(PORecs[i], docBodies[i]);
		}
});
}

function makeNewPO(vendor, proj) {
	return new Promise(function(resolve, reject) {
		base('Purchase Orders').create({
			'Name': "Niido - "+vendor+" P.O.",
			'Project': proj
		}, function(err, record) {
			if (err) {
				console.log(err);
				reject(err);
				return;
			}
			resolve(record);
		});
	});
}

function getPO(POrec) {
	return new Promise(function(resolve, reject) {
		base('Purchase Orders').find(POrec, (err, record) => {
			if (err) {
				console.log(err);
				reject(err);
				return;
			} else {
				resolve(record);
				return;
			}
		});
	});
}

function downloadImage(url, localPath) {
	return new Promise(function(resolve, reject) {
		https.get(url, function(response) {
			response.setEncoding('base64');
			body = "data:"+response.headers['content-type']+";base64,";
			response.on('data', (data) => { body += data; });
			response.on('end', () => {
				resolve(body);
				return;
			});
		}).on('error', function(err) {
			console.log(err);
			reject(err);
			return;
		});
	});
}

function attachPO(SPrecord, POrecord) {
	return new Promise(function(resolve, reject) {
		base('Sourced Products').update(SPrecord, {
			'Purchase Order': [POrecord]
		}, function(err, record) {
			if (err) {
				console.log(err);
				reject(err);
			} else {
				resolve();
			}
		});
	});
}

function buildPO(PO, tableBody) {
	tableBody.unshift([{text: 'Line #', style: 'tableHeader'},{text: 'Item SKU', style: 'tableHeader'},{text: 'Product Name', style: 'tableHeader'},{text: 'Image', style: 'tableHeader'},{text: 'Unit Cost', style: 'tableHeader'},{text: 'QTY', style: 'tableHeader'},{text: 'Line Total', style: 'tableHeader'}]);
	var docDefinition = {
		content: [
			{
				columns: [
					{	
						image: __dirname + '/../public/images/fulhaus-logo.png',
						width: 60,
						margin: [0, 0, 0, 10]
					},{	
						width: '*',
						stack: [ 'Purchase Order', PO.get('Vendor Name')],
						style: 'title'
					},{
						width: 160,
						stack: [
							{
								text: 'P.O. Number: '+ (110+(PO.get('Number')))
							},{
								text: date
							},{
								text: ' '
							},{
								text: 'Order Total: $'+ PO.get('Total Order (USD)').toFixed(2),
								fontSize: 16
							}
						]
					}
				],
				columnGap: 10
			},{
				table: {
					headerRows: 1,
					widths: ['*', '*'],
					body: [
						[{text: 'Billing Address', style: 'tableHeader'}, {text: 'Shipping Address', style: 'tableHeader'}],
						["6560 Avenue de l'Esplanade #020\nMontréal, QC  H2V 4L5\n(514)270-1234\nnada@fulhaus.com", "Alexander’s\nc/o Fulhaus INC\n\n7235 Cockrill Bend Blvd.\nNashville, TN 37209\n\nATTN: DB\nReceiving hours = 8:00 AM – 4:00 PM Monday through Friday excluding Holidays.\nMike Pickett, 615-499-5810"]
					]
				},
				style: 'tableStyle',
				//layout: 'headerLineOnly'
			},{
				text: [
					"DELIVERY LANDED DEADLINE FOR THIS ORDER: 06/14/2019\n\n",
					"*Please confirm PO with a Sales Order and Freight Estimate in 24 hrs*\n",
					"* LABEL EACH BOX CLEARLY WITH ", {text:'"FULHAUS"', bold:true}, ' *\n\n',
					"*Please send Sales Invoice and tracking shipping number or freight information 48 hours after sales order receipt*\n\n",
					"SEND INVOICES AND SHIPPING INFORMATION TO: nada@fulhaus.com"
				],
				margin: 10
			},{
				table: {
					headerRows: 1,
					dontBreakRows: true,
					widths: ['auto', 'auto', '*', 50, 'auto','auto', 'auto'],
					body: tableBody
				},
				style: 'tableStyle'
			}
		],
		styles: {
			tableHeader: {
				fontSize: 10,
				bold: true
			},
			title: {
				fontSize: 24,
				bold: true
			},
			tableStyle: {
				fontSize: 10
			}
		},
		defaultStyle: {
			font: 'Helvetica'
		}
	}
	return new Promise(function(resolve, reject) {
		var pdfDoc = doc.createPdfKitDocument(docDefinition);
		console.log("Writing PDF!");
		pdfDoc.pipe(fs.createWriteStream('PO-'+PO.get('Number')+'.pdf'));
		
		pdfDoc.on('end', function() {
			resolve(pdfDoc);
		});

		pdfDoc.on('error', function(err) {
			reject(err);
		});

		pdfDoc.end();
	});	
}

main();
/**
 * Monolith function to perform quote-related task pipeline
 * 1. Receives quote from HTTPS request and inserts generated quote and line items into Airtable
 * 2. Using the generated quote, creates a pdf of the quote
 * 3. Mails the pdf to info@fulhaus.com with the relevant client info
 */

const fs = require('fs');
const pdfmake = require('pdfmake');
const nodemailer = require("nodemailer");
const Airtable = require('airtable');
var base = new Airtable({apiKey: 'keyVjcU07cHQbToae'}).base('appdOBdOVVYq3gjom');

// create reusable transporter object using the default SMTP transport
const mailkey = require('./mailerKey.json');

const SENDER_ADDRESS = 'info@fulhaus.com';
let transporter = nodemailer.createTransport({
	service: 'Gmail',
	auth: {
		type: 'OAuth2',
		user: SENDER_ADDRESS, // generated ethereal user
		serviceClient: mailkey.client_id,
		privateKey: mailkey.private_key
	}
});

exports.handler = async function(event, context, callback) {
	console.log("Handler called!");
	if (event.body !== null && event.body !== undefined) {
		let body = JSON.parse(event.body)
		await store(body);
	}
}

async function store(quoteobj) {
	try {
		var newQuote = await storeQuote(quoteobj);
		console.log("Made Generated Quote");
		var quoteItems = await findQuoteItems(newQuote.id, newQuote.quote);
		console.log("Found Quote Line Items");
		console.log(quoteItems.id+' - '+quoteItems.arr);
		var x = await makeLineItems(quoteItems.id, quoteItems.arr);
		console.log("Made Line Items");
		var pdfpath = await getQuotePDFPath(newQuote.id);
		console.log("PDF created at: "+pdfpath);
		await sendEmail(pdfpath);
		console.log("Sent email!");
	} catch (err) {
		console.log(err);
	}
}

function storeQuote(quote) { // THIS should return a promise, then we call it and attach .then's to the call?
	return new Promise(function(resolve, reject) {
		// First we create the quote record, filling in client info
		base('Generated Quotes').create({
			"Client Name": quote['clientname'],
			"Primary Contact": quote['clientemail'],
			"Project Address": quote['inputAddress'],
			//More fields if desired
		}, function(err, record) {
			if (err) { 
				console.log(err);
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
			view: "Fulhaus Items",
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
				console.log(err);
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
					console.log(err);
					reject(err); 
				} else {
					if (record.get("Linked Product") == Object.keys(lineItems)[length-1]) {
						console.log("Make Line Items Resolving");
						resolve(record);
					}
				}
			});
		}
	});
}

var fonts = {
	Helvetica: {
		normal: 'Helvetica',
		bold: 'Helvetica-Bold',
		italics: 'Helvetica-Oblique',
		bolditalics: 'Helvetica-BoldOblique'
	},
};

const doc = new pdfmake(fonts);

async function getQuotePDFPath(id) {
	var q = await makePDF(id);
	var q2 = await buildQuoteBody(q.rec, q.head);
	var pdf = await buildPDF(q2.head, q2.body, q2.sum);
	return new Promise(function(resolve, reject) {
		pdf.pipe(fs.createWriteStream('/tmp/'+id+'.pdf'));
		pdf.on('end', function() {
			resolve ('/tmp/'+id+'.pdf');
		});
		pdf.on('error', function(err) {
			console.log(err);
			reject(err);
		});
	}).catch(function(reason) {
		console.error(reason);
	});
}

function makePDF(quoteID) {
	return new Promise(function(resolve, reject) {
		base('Generated Quotes').find(quoteID, function(err, record) {
			if (err) { 
				console.log(err);
				reject(err); 
			}
			// Gather info to populate pdf
			var quoteHeader = {
				num: record.get('Quote Number'), 
				name: record.get('Client Name'), 
				addr: record.get('Project Address'), 
				units: record.get('Number of Units')
			};
			resolve({
				rec: record, 
				head: quoteHeader
			});
			//buildQuoteBody(record, quoteHeader);
		});
	});
}

function buildQuoteBody(quoteRecord, quoteHeader) {
	return new Promise(function(resolve, reject) {
		var body = [];
		var idx = 0;
		
		var recordArray = quoteRecord.get('Quote Line Items');
		var len = recordArray.length;
		
		for (i = 0; i < len; i++) {
			base('Quote Line Items').find(recordArray[i], function(err, record) {
				if (err) {
					console.log(err);
					reject(err);
				}
				var row = [];
				row.push(record.get('Product Name'));
				row.push(record.get('QTY'));
				row.push('$'+(record.get('Discounted Unit Price')).toFixed(2));
				row.push((record.get('Unit Price x QTY (USD)').toFixed(2)));
				body.push(row)
				idx++;
				if (idx == len) { //after last airtable find returns, we build the pdf
					body.sort(function(a, b) {
						return b[3] - a[3];
					});
					var sum = 0.0;
					body.forEach(function(row, index) {
						row.unshift(index+1);
						sum += parseFloat(row[4]);
						row[4] = '$'+row[4];
					});
					body.unshift([{text: 'Line Number', style: 'subheader'}, {text: 'Product Name', style: 'subheader'}, {text: 'QTY', style: 'subheader'}, {text: 'Unit Price (USD)', style: 'subheader'}, {text: 'Unit Price * QTY (USD)', style: 'subheader'}]);
					resolve({
						head: quoteHeader,
						body: body,
						sum: sum
					});
					//buildPDF(quoteHeader, body, sum);
				}
			});
		}
	});
}

function buildPDF(qhead, qbody, sum) {
	//console.log(qbody);
	var docDefinition = {
		content: [
		{	
			columns: [
			{	
				image: './fulhaus-logo.png',
				width: 50
			},{	
				width: '*',
				stack: [
					{ 	
						style: 'header',
						margin: [20, 9],
						text: 'Quote '+qhead.num+ ' | '+qhead.name+' | '+qhead.addr,
					},{	
						style: 'small',
						margin: [20, 2],
						text: qhead.name
					},{	
						style: 'small',
						margin: [20, 2],
						text: qhead.addr
					},{	
						style: 'small',
						margin: [20, 2],
						text: qhead.units + ' units'
					}
				]
			}]
		},{
			table: {
				headerRows: 1,
				heights: 15,
				widths: ['auto', '*', 'auto', 'auto', 'auto'],
				body: qbody
			},
			style: 'tableStyle',
			layout: 'headerLineOnly'
		},{
			columns: [
				{
					width: '*',
					stack: [
						// {
						// 	text: 'Subtotal:'
						// },{
						// 	text: 'Discount:'
						// },
						{
							text: 'Total:'
						}
					]
				},{
					width: 100,
					stack: [
						// {
						// 	text: '$'+sum.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')
						// },{
						// 	text: '$'+(sum*0.1).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')
						// },
						{
							text: '$'+(sum).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')
						}
					],
				}
			],
			style: 'footer'
		}
		],
		styles: {
			header: {
				fontSize: 18,
			},
			subheader: {
				fontSize: 8,
				bold: true,
				margin: [0, 10, 0, 0] // left, top, right, bottom
			},
			small: {
				fontSize: 10
			},
			tableStyle: {
				fontSize: 9,
				margin: 10
			},
			footer: {
				fontSize: 12,
				margin: [30, 20],
				lineHeight: 2,
				alignment: 'right'
			}
		},
		defaultStyle: { font: 'Helvetica'}
	};
	return new Promise(function(resolve, reject) {
		var pdfDoc = doc.createPdfKitDocument(docDefinition);
		// TODO: instead of piping, return pdfDoc as a readable stream, which we read from directly for email attachment
		//pdfDoc.pipe(fs.createWriteStream('document.pdf'));
		
		//pdfDoc.on('end', function() {
			resolve(pdfDoc);
		//});

		pdfDoc.on('error', function(err) {
			reject(err);
		});

		pdfDoc.end();
	});	
}


// async..await is not allowed in global scope, must use a wrapper
async function sendEmail(pdf){
	// send mail with defined transport object
	let info = await transporter.sendMail({
		from: '"Fulhaus Auto-Quote" <info@fulhaus.com>', // sender address
		to: "info@fulhaus.com", // list of receivers
		subject: "Someone used the quote builder! See attachment", // Subject line
    	text: "The provided quote is an estimate. Taxes, shipping and handling, and industry discounts may all affect the final price. Please contact our team for more info!", // plain text body
		attachments: [
			{
				filename: 'quote.pdf',
				path: pdf
			}
		]
	});
}
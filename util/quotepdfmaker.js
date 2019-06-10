const fs = require('fs');
const pdfmake = require('pdfmake');
const Airtable = require('airtable');

var fonts = {
	Helvetica: {
		normal: 'Helvetica',
		bold: 'Helvetica-Bold',
		italics: 'Helvetica-Oblique',
		bolditalics: 'Helvetica-BoldOblique'
	},
};

const doc = new pdfmake(fonts);
const base = new Airtable({apiKey: 'keyVjcU07cHQbToae'}).base('appdOBdOVVYq3gjom'); // TODO: base for quote info

var quoteid = 'recCQ6b4kMwQElcLr';
makePDF(quoteid);

async function getQuoteStream(id) {
	console.log(id);
	var q = await makePDF(id);
	console.log("madePDF returns");
	var q2 = await buildQuoteBody(q.rec, q.head);
	console.log("buildQuoteBody returns");
	var pdf = await buildPDF(q2.head, q2.body, q2.sum);
	console.log("buildPDF returns");
	return new Promise(function(resolve, reject) {
		pdf.pipe(fs.createWriteStream(__dirname+'/temp/'+id+'.pdf'));
		pdf.on('end', function() {
			console.log(('/temp/'+id+'.pdf'));
			resolve ('/temp/'+id+'.pdf');
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
				num: (record.get('Quote Number (Backend)')+122), 
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
				image: __dirname + '/../public/images/fulhaus-logo.png',
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
		
		pdfDoc.on('end', function() {
			resolve(pdfDoc);
		});

		pdfDoc.on('error', function(err) {
			reject(err);
		});

		pdfDoc.end();
	});	
}
module.exports = { makePDF, getQuoteStream };
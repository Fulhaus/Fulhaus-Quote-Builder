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

var quoteid = 'recabCZXITS5lnlih';

base('Generated Quotes').find(quoteid, function(err, record) {
	if (err) { console.error(err); return; }
	
	// Gather info to populate pdf
	var quoteHeader = {
		num: (record.get('Quote Number (Backend)')+122), 
		name: record.get('Client Name'), 
		addr: record.get('Project Address'), 
		units: record.get('Number of Units')
	};
	buildQuoteBody(record, quoteHeader);
});

function buildQuoteBody(quoteRecord, quoteHeader) {
	var body = [];
	var idx = 1;
	body.push([{text: 'Line Number', style: 'subheader'}, {text: 'Product Name', style: 'subheader'}, {text: 'QTY', style: 'subheader'}, {text: 'Unit Price (USD)', style: 'subheader'}, {text: 'Unit Price * QTY (USD)', style: 'subheader'}]);
	
	var recordArray = quoteRecord.get('Quote Line Items');
	var len = recordArray.length;
	
	for (i = 0; i < len; i++) {
		base('Quote Line Items').find(recordArray[i], function(err, record) {
			var row = [];
			row.push(idx);
			row.push(record.get('Product Name'));
			row.push(record.get('QTY'));
			row.push('$'+(record.get('Unit Price (USD)').toFixed(2)));
			row.push('$'+(record.get('Unit Price x QTY (USD)').toFixed(2)));
			//console.log(row)
			body.push(row)
			idx++;
			// TODO: fix the sorting and append idx after!!!!
			if (idx > len) {
				// body.sort(function(a, b) {
				// 	return a[3] - b[3];
				// });
				buildPDF(quoteHeader, body);
			}
		});
	}
}

function buildPDF(qhead, qbody) {
	console.log(qbody);
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
			style: 'tableStyle',
			table: {
				headerRows: 1,
				heights: 15,
				widths: ['auto', '*', 'auto', 'auto', 'auto'],
				body: qbody
			},
			layout: 'headerLineOnly'
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
			}
		},
		defaultStyle: { font: 'Helvetica'}
	};

	var pdfDoc = doc.createPdfKitDocument(docDefinition);
	pdfDoc.pipe(fs.createWriteStream('document.pdf'));
	pdfDoc.end();
}




  
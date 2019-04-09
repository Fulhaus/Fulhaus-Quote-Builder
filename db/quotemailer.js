const fs = require('fs');
const pdfkit = require('pdfkit');
const Airtable = require('airtable');

var quoteid = 'recabCZXITS5lnlih';

const doc = new pdfkit;
const base = new Airtable({apiKey: 'keyVjcU07cHQbToae'}).base('appdOBdOVVYq3gjom'); // TODO: base for quote info

doc.pipe(fs.createWriteStream('quote.pdf'));
doc.image(__dirname + '/../public/images/fulhaus-logo.png', 40, 40);

base('Generated Quotes').find(quoteid, function(err, record) {
	if (err) { console.error(err); return; }
	
	doc
		.fontSize(24)
		.text('Quote ' + (record.get('Quote Number (Backend)')+122) + ' | ' + record.get('Client Name') + ' | ' + record.get('Project Address'), 130, 44)
		.fontSize(10)
		.lineGap(0.5)
		.moveDown()
		.text(record.get('Client Name'))
		.moveDown()
		.text(record.get('Project Address'))
		.moveDown()
		.text(record.get('Number of Units') + ' units');
	doc.end();
});
const xlsx = require('xlsx');
const fs = require('fs');

var files = fs.readdirSync('./vendorcsv/');

var ext = /.+\.xlsx?$/;
var toConvert = files.filter(file => {
	return ext.test(file);
});

console.log(toConvert);

for (file of toConvert) {
	var workbook = xlsx.readFile('./vendorcsv/'+file);
	var ws = workbook.Sheets[workbook.SheetNames[0]];
	fs.writeFileSync('./vendorcsv/'+file.split('.xls')[0]+'.csv', xlsx.utils.sheet_to_csv(ws, {FS: ',', RS: '\r\n', blankrows: false}));	
	fs.unlink('./vendorcsv/'+file, (err) => {
		if (err) console.log(err);
	});
}
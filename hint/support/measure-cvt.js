var fs = require('fs');
var path = require('path');
var stream = require('stream');
var argv = require('yargs').argv;

var maxlen = 0;
argv._.forEach(function (file) {
	console.log('Measuring CVT of: ' + file);
	var cvt = JSON.parse(fs.readFileSync(file, 'utf-8')).cvt_;
	if (cvt && cvt.length > maxlen) maxlen = cvt.length;
});

console.log('From your font files, we suggest:\n\x1b[92mCVT_PADDING = ' + (maxlen + 1) + '\x1b[39;49m');

if(argv.o){
	fs.writeFileSync(argv.o, "CVT_PADDING = " + (maxlen + 1))
}
var fs = require("fs");

testChangedFiles();

function testChangedFiles(){
	process.stdin.resume();
	var data = [];
	process.stdin.on("data", function(c){
		data.push(c);
	});
	process.stdin.on("end", function(){
		if(data.length === 0) {
			check([]);
		} else {
			if(typeof data[0] === "string") {
				allData = data.join("");
			} else if(Buffer.isBuffer(data[0])) {
				allData = Buffer.concat(data).toString();
			} else {
				throw new Error("unexpected error");
			}
			var lines = allData.replace(/\r\n?/g, "\n").split("\n");
			lines = lines.map(function(line){
				return line.trim();
			}).filter(function(line){
				return line.length > 0;
			});
			var result = check(lines);
			if(result === false) {
				process.exit(1);
			}
		}
	});
}

function check(files) {
	var hasError = false;

	files.filter(function(f){
		return /(?:code|lang|images)\.js$/i.test(f);
	}).forEach(function(f){
		var text = fs.readFileSync(f, "utf-8");
		try {
			JSON.parse(text);
		} catch(e) {
			console.error("文件 " + f + " 有语法错误");
			hasError = true;
		}
	});
	return hasError;
}

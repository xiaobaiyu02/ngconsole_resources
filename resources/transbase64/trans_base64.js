"use strict";
let fs = require("fs");
let path = require('path');
let p = process.argv[1];

function trans_base64(file){
	let bitmap = fs.readFileSync(file);
	let base64str = new Buffer(bitmap).toString('base64');
	return base64str;
}

function getFile(dirpath){
	let files = [];
	fs.readdirSync(dirpath).forEach(function(item){
		let file = {};
		file.name = item.slice(0,item.lastIndexOf("."));
		file.type = item.slice(item.lastIndexOf(".")+1);
		file.value = trans_base64(path.join(dirpath, item));
		files.push(file);
	});
	return files;
}

function readdir(dirpath){
	let newArry = [];
	fs.readdirSync(dirpath).forEach(function(item){
		// 忽略 unix, mac 下面的隐藏文件
		if(item.startsWith('.')) { return; }
		let file = path.join(dirpath, item);
		let isDir = fs.statSync(file).isDirectory();
		if(isDir){
			let data = {dirName: item, trans_files: getFile(file)};
			newArry.push(data);
		}
	});
	return newArry;
}

function writFile(dirpath){
	let Arrays = readdir("./");
	fs.readdirSync(dirpath).forEach(function(item){
		let base64_arry;
		try {
			base64_arry = Arrays.filter(function(i){ return i.dirName===item; })[0].trans_files;
		} catch(e) {
			return
		}
		let final_arry = {};
		base64_arry.forEach(function(arry){
			if(arry.type==="png")
				final_arry[arry.name] = "data:image/png;base64,"+arry.value;
			else if(arry.type==="svg")
				final_arry[arry.name] = "data:image/svg+xml;base64,"+arry.value;
			else if(arry.type==="ico")
				final_arry[arry.name] = "data:image/x-icon;base64,"+arry.value;
			else
				console.log("---------------------"+arry.type+ " hasn't added!--------------------------------")
		});
		fs.writeFileSync(dirpath+item+"/images.js", JSON.stringify(final_arry), "utf8");
	});
}
writFile("../pkg/");

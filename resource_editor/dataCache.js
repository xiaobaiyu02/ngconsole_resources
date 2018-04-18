var fs = require("fs-extra");
var path = require("path");

var cacheDirectory = "./data/";

module.exports = {
	getCache: getCache,
	saveCache: saveCache
};

function getCache(name, type) {
	var file = cacheDirectory + name + "/" + type;
	if(!fs.existsSync(file)) {
		return Promise.resolve({});
	} else {
		return fs.readJson(file);
	}
}

function saveCache(name, type, data) {
	var file = cacheDirectory + name + "/" + type + ".json";
	fs.mkdirsSync(path.dirname(file));
	if(fs.existsSync(file)) {
		return fs.readJson(file).then(function(oldData){
			var change = false;
			Object.keys(data).forEach(function(key){
				var oldValue = oldData[key];
				var newValue = data[key];
				if(oldValue !== newValue) {
					change = true;
					oldData[key] = newValue;
				}
			});
			if(change) {
				return fs.writeJson(file, oldData);
			}
		});
	} else {
		return fs.writeJson(file, data);
	}
}
var express = require('express');
var router = express.Router();

var fs = require("fs-extra");
var path = require("path");
var xtend = require("xtend");

var languages = require("../languages");
var dataCache = require("../dataCache");
var types = ["lang", "code"];

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index');
});

router.get("/languages", function(req, resp){
	var langs = Object.keys(languages);
	var result = [];
	langs.forEach(function(key){
		var conf = languages[key];
		result.push({name: key, text: conf.text});
	});
	resp.json({result: result});
});

router.get("/language/:name", function(req, resp){
	var name = req.params.name;
	if(languages.hasOwnProperty(name)) {
		var source = languages[name].source;
		source = path.join(__dirname, "..", source);
		Promise.all(types.map(function(type){
			return fs.readJson(path.join(source, type + ".js"));
		})).then(function(arr){
			Promise.all(types.map(function(type){
				return dataCache.getCache(name, type);
			})).then(function(cacheArr){
				var result = {};
				types.forEach(function(t, i){
					result[t] = mergeLanguageData(arr[i], cacheArr[i]);
				});
				resp.json({result: result});
			});
		}).catch(function(e){
			resp.status(500).json({
				error: e,
				result: null
			});
		});
	} else {
		resp.status(404).json({result: null});
	}
});

router.post("/language/:name/save", function(req, resp){
	var name = req.params.name;
	var type = req.body.type;
	var data = req.body.data;
	dataCache.saveCache(name, type, data).then(function(){
		resp.json({result: true});
	}).catch(function(e){
		resp.json({error: e, result: null});
	});
});

module.exports = router;

function mergeLanguageData(src, cache) {
	var keys = Object.keys(src);
	var result = [];
	keys.forEach(function(key){
		result.push({
			key: key,
			text: src[key],
			cacheText: cache[key]
		});
	});
	return result;
}

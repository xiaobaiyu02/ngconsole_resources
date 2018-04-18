var app = angular.module("App", ['ngAnimate', 'ui.bootstrap']);

app.controller("LanguageController", ["$scope", "$uibModal", "backend", "isTranslated", function(scope, $uibModal, backend, isTranslated){
	// ngModel
	scope.editorReady = false;
	scope.filterText = "";
	scope.onlyUntranslated = false;
	scope.onlyModified = false;
	// ngRepeat
	scope.languages = [];
	scope.dataItems = [];
	scope.pages = [];
	scope.types = ["code", "lang"];
	scope.typeData = null;

	scope.typeText = {
		"code": "错误码",
		"lang": "文本"
	};
	scope.selectedIndex = {value: 0};
	scope.currentLanguage = null;

	scope.refresh = function(){
		var data = scope.typeData[scope.selectedIndex.value];
		var options = {
			language: scope.currentLanguage,
			filterText: scope.filterText.trim(),
			onlyUntranslated: scope.onlyUntranslated,
			onlyModified: scope.onlyModified
		};
		data.selectPage(1, options);
	};
	scope.selectType = function(type){
		var v = scope.types.indexOf(type);
		scope.selectedIndex.value = v;
		scope.refresh();
	};
	scope.selectLanguage = function(lang){
		scope.currentLanguage = lang.name;
		scope.editorReady = true;
		backend.loadLanguageData(lang.name).then(function(resp){
			var arr = [], data = resp.data.result;
			angular.forEach(scope.types, function(type){
				arr.push(createTypeData(type, data[type]));
			});
			scope.typeData = arr;
		});
	};
	scope.editLanguageItem = function(item, type){
		var modelInstance = $uibModal.open({
			templateUrl: "/views/edit-item.html",
			controller: "EditItemController",
			resolve: {
				item: function(){ return item; },
				type: function(){ return type; },
				name: function(){ return scope.currentLanguage; }
			}
		});
	};

	backend.loadLanguages().then(function(resp){
		scope.languages = resp.data.result;
	});
	tryAutoSelect();

	
	function tryAutoSelect(){
		var path = location.hash.substring(1);
		if(path) {
			result = /^\/language\/([a-z-]+)$/i.exec(path);
			if(result) {
				scope.selectLanguage({name: result[1]});
			}
		}
	}

	function createTypeData(type, data) {
		var result = {
			currentPage: 1,
			type: type,
			pageSize: 50,
			pages: []
		};
		
		result._setPageCount = function(c){
			var pageCount = Math.ceil(c / result.pageSize);
			var arr = [];
			for(var i = 1; i <= pageCount; i++) {
				arr.push(i);
			}
			result.pages = arr;
		};
		result._filter = function(item, options){
			var content = item.cacheText || item.text;
			options = options || {};
			var filterText = options.filterText;
			if(filterText) {
				if(content.indexOf(filterText) === -1) {
					return false;
				}
			}
			var language = options.language;
			var onlyUntranslated = options.onlyUntranslated;
			if(language === 'en-us' && onlyUntranslated) {
				if(isTranslated(content)) {
					return false;
				}
			}
			if(options.onlyModified) {
				if(!item.hasOwnProperty("cacheText")) {
					return false;
				}
			}
			return true;
		};
		result.selectPage = function(p, options){
			var arr = [];
			var i = (p - 1) * result.pageSize;
			var len = data.length;
			var item;
			var count = 0;
			if(!options) {
				options = result._lastOptions || {};
			}
			for(; i < len; i++) {
				item = data[i];
				if(false === this._filter(item, options)) {
					continue;
				}
				if(arr.length < result.pageSize) {
					arr.push(item);
				}
				count ++;
				
			}
			result.currentPage = p;
			result._setPageCount(count);
			result.items = arr;
			result._lastOptions = options;
		};
		result.selectPage(result.currentPage);
		return result;
	}
}]);

app.controller("EditItemController", ["$scope", "$uibModalInstance", "backend", "storage", "item", "type", "name", function(scope, $uibModalInstance, backend, storage, item, type, name){
	scope.loading = false;
	scope.item = {
		key: item.key,
		text: item.text,
		cacheText: item.cacheText
	};
	scope.ok = function(){
		scope.loading = true;
		angular.extend(item, scope.item);
		backend.saveLanguageData(name, type, {
			key: scope.item.key,
			text: scope.item.text,
			cacheText: scope.item.cacheText
		});
		$uibModalInstance.close();
	};
	scope.cancel = function(){
		$uibModalInstance.dismiss();
	};
}]);

app.factory("backend", ["$http", function($http){
	return {
		loadLanguages: loadLanguages,
		loadLanguageData: loadLanguageData,
		saveLanguageData: saveLanguageData
	};
	function loadLanguages(){
		return $http.get("/languages");
	}

	function loadLanguageData(lang){
		return $http.get("/language/" + lang);
	}

	function saveLanguageData(name, type, data){
		return $http.post("/language/" + name + "/save", {type: type, data: data});
	}
}]);

app.factory("isTranslated", [function(){
	var re = /[\u4e00-\u9fa5]/;
	return function(text){
		return !re.test(text);
	};
}]);

app.factory("storage", [function(){
	return {};
}]);
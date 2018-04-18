"use strict";
const electron = require("electron");
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

//electron.crashReporter.start();
let mainWindow = null;

app.on("window-all-closed", function(){
	if(process.platform !== "darwin"){
		app.quit();
	}
});

app.on("ready", function(){
	mainWindow = new BrowserWindow({
		width: 800,
		height: 600
	});
	mainWindow.loadURL("file://" + __dirname + "/index.html");
	mainWindow.on("closed", function(){
		mainWindow = null;
	});
});

const ipcMain = electron.ipcMain;
ipcMain.on("debug", function(event){
	event.sender.send("debug", electron);
});

ipcMain.on("asynchronous-message", function(event, args){
	console.log(arguments);
	event.sender.send("asynchronous-reply", arguments);
});

ipcMain.on("synchronous-message", function(event, args){
	console.log(arguments);
	event.returnValue = [arguments.length, event];
});

/**
 * Created by zhangyao on 2017/5/12.
 * Usage:
 *    node build.js build-client <version>
 *    node build.js deploy-client <version>
 *    node build.js build-init <version>
 *    node build.js deploy-init <version>
 *
 * 公版和 OEM 都需要以此方式调用
 */
var fs = require("fs");
var path = require("path");
var gulp = require("gulp");
var crypto = require("crypto");
var child_process = require("child_process");
var eachSeries = require("async/eachSeries");

var projectRoot = __dirname;

// 这个需要随着 OEM 版本的增多而增加
var deployDirectories = {
    "e-vdi": "E-VDI",
    pc: "云PC",
    classCh: "云教室",
    classEn: "云教室英文",
    huipu: "惠普",
    huipushow: "惠普演示版",
    tongfang: "清华同方",
    tongfangshow: "清华同方演示版",
    hwPC: "华网云",
    hwClassCh: "华网云桌面",
    fan: "圓宸桌面雲",
    japan: "日语",
    xipu: "西普",
    baode: "宝德",
    baodePC: "宝德云PC",
    wuzhou: "五舟"
};

if(module === require.main) {
    main();
}

function main(){
    var args = process.argv.slice(2);
    var cmd = args.shift();
    switch(cmd) {
        case "build-init":
            buildInit(args);
            break;
        case "build-client":
            buildClient(args);
            break;
        case "diff-patch":
            diffPatch(args[0]);
            break;
        case "deploy-init":
            deployInit(args);
            break;
        case "deploy-client":
            deployClient(args);
            break;
        default:
            console.error("unsupported command:", cmd);
            return;
    }
}

function buildInit(versions) {
    var initRoot = path.join(projectRoot, "client_init");
    // 默认公版
    if(versions.length === 0 || (versions.length === 1 && versions[0] === "all")) {
        versions = fs.readdirSync(initRoot);
        versions = versions.filter(function (v) {
            if(v === "gui") {
                return false;
            }
            return fs.lstatSync(path.join(initRoot, v)).isDirectory();
        });
    }
    var allVersionExists = true;
    versions.forEach(function (version) {
        var dirname = version;
        if(dirname.indexOf("gui_") === -1) {
            dirname = "gui_" + dirname;
        } else {
            version = version.substring("gui_".length);
        }
        try {
            if(!fs.lstatSync(path.join(initRoot, dirname)).isDirectory()) {
                console.error("can't find client_init/" + dirname);
                allVersionExists = false;
            }
        } catch (e) {
            allVersionExists = false;
            console.log(version + " not exists!!");
        }
    });
    if(allVersionExists) {
        var prevCwd = process.cwd();
        var outdir = path.join(projectRoot, "dist");
        versions.forEach(function (version) {
            var dirname = version;
            if(dirname.indexOf("gui_") === -1) {
                dirname = "gui_" + dirname;
            } else {
                version = version.substring("gui_".length);
            }
            var versiondir = path.join(initRoot, dirname);
            process.chdir(versiondir);
            gulp.src("./**/*").pipe(require("gulp-zip")("init_" + version + ".zip")).pipe(gulp.dest(outdir));
        });
        process.chdir(prevCwd);
    }
}

function buildClient(versions) {
    var clientRoot = path.join(projectRoot, "client");
    var gulpBin = path.join(projectRoot, "node_modules/.bin/gulp");
    if(versions.length === 0 || (versions.length === 1 && versions[0] === "all")) {
        versions = fs.readdirSync(clientRoot);
        versions = versions.filter(function(v){
            return fs.lstatSync(path.join(clientRoot, v)).isDirectory();
        });
    }
    // 是否指定的版本都存在
    var allVersionExists = true;
    versions.forEach(function(version){
        if(!allVersionExists) { return; }
        var versionRoot = path.join(clientRoot, version);
        try {
            allVersionExists = allVersionExists && fs.lstatSync(versionRoot).isDirectory();
        } catch (e) {
            allVersionExists = false;
            console.error("directory " + path.relative(projectRoot, versionRoot) + " do not exists!");
        }
    });
    if(!allVersionExists) { return; }
    versions.forEach(function(version){
        var versionRoot = path.join(clientRoot, version);
		var pargs = [gulpBin];
		if(version === "public") {
			["e-vdi", "pc", "classCh", "classEn"].forEach(function(v){
                console.log(">>>>>>>>>>>>>> start build client " + v);
                child_process.spawnSync(process.execPath, [gulpBin, v], {
                    env: {BUILD_OUT_DIR: path.join(projectRoot, "dist")},
                    stdio: 'inherit',
                    cwd: versionRoot
                });
                console.log("<<<<<<<<<<<<<< done!!!\n");
            });
		} else {
			console.log(">>>>>>>>>>>>>> start build client " + version);
            child_process.spawnSync(process.execPath, [gulpBin, version], {
                env: {BUILD_OUT_DIR: path.join(projectRoot, "dist")},
                stdio: 'inherit',
                cwd: versionRoot
            });
            console.log("<<<<<<<<<<<<<< done!!!\n");
		}
        
    });
}

function diffPatch(fromdir) {
    if(!fromdir) {
        console.error("usage: node build.js client/public");
        return;
    }
    fromdir = path.resolve(projectRoot, fromdir);
    var initdir = path.join(projectRoot, "client_init");
    var clientdir = path.join(projectRoot, "client");
    var fromVersion = null, dir;
    var changedFiles = getChangedFiles();
    changedFiles = changedFiles.filter(function (file) {
        return file.indexOf(fromdir) > -1;
    });
    if(changedFiles.length === 0) {
        console.error("no changed files in directory", fromdir);
        return;
    }
    fromVersion = path.basename(fromdir);
    if(fromdir.indexOf(initdir) > -1) {
        dir = initdir;
    } else if(fromdir.indexOf(clientdir) > -1) {
        dir = clientdir;
    } else {
        return console.error("unsupported directory:", fromdir);
    }
    var versions = fs.readdirSync(dir);
    if(versions.indexOf(fromVersion) === -1) {
        return console.error("usage: node build.js client/public");
    }
    versions = versions.filter(function (v) {
        return v !== fromVersion;
    }).filter(function (v) {
        var file = path.join(dir, v);
        return fs.lstatSync(file).isDirectory();
    });

    var childOptions = {cwd: projectRoot};
    var diffFile = path.join(projectRoot, "mydiff");
    var diffText = captureStdOut("git", ["diff", path.relative(projectRoot, fromdir)], childOptions);
    var diffReg = new RegExp("\\/" + fromVersion + "\\/", "g");
    try {
        versions.forEach(function (version) {
            var patch = diffText.replace(diffReg, "/" + version + "/");
            // write patch file
            fs.writeFileSync(diffFile, patch);
            diffReg.lastIndex = 0;
            console.log("try apply code change to client/" + version);
            var str = captureStdOut("git", ["apply", "mydiff"], childOptions);
            if(str.length === 0) {
                console.log("apply success!");
            }
        });
    } catch(e) {
        console.error(e);
    } finally {
        fs.unlinkSync(diffFile);
    }

}

function deployInit(versions) {
    var distRoot = path.join(projectRoot, "dist");
    var deployRoot = path.join(projectRoot, "../vdi-client-release");
    if(versions.length === 0) {
        return console.log("Usage: node build.js deploy-init version1 version2");
    }
    var bundles = versions.map(function (version) {
        return path.join(distRoot, "init_" + version + ".zip");
    });
    var allExists = true;
    bundles.forEach(function (zipfile) {
        if(!fs.existsSync(zipfile)) {
            console.error("file " + path.relative(projectRoot, zipfile) + " do not exists!");
            allExists = false;
        }
    });
    if(allExists) {
        bundles.forEach(function (zipfile, i) {
            var version = versions[i];
            var versiondir = deployDirectories[version] || version;
            var output = path.join(deployRoot, versiondir, getDeployName("init-client-for-<version>-<date>.zip", zipfile, version));
            console.log("copying", path.relative(projectRoot, zipfile), "to", path.relative(projectRoot, output));
            deploy(zipfile, output);
        });
    }
}

function deployClient(versions) {
    var distRoot = path.join(projectRoot, "dist");
    var deployRoot = path.join(projectRoot, "../vdi-client-release");
    if(versions.length === 0) {
        return console.log("Usage: node build.js deploy-client version1 version2");
    }
    var bundles = versions.map(function (version) {
        return path.join(distRoot, version + ".zip");
    });
    var allExists = true;
    bundles.forEach(function (zipfile) {
        if(!fs.existsSync(zipfile)) {
            console.error("file " + path.relative(projectRoot, zipfile) + " do not exists!");
            allExists = false;
        }
    });
    if(allExists) {
        bundles.forEach(function (zipfile, i) {
            var version = versions[i];
            var versiondir = deployDirectories[version] || version;
            var output = path.join(deployRoot, versiondir, getDeployName("client-for-<version>-<date>.zip", zipfile, version));
            console.log("copying", path.relative(projectRoot, zipfile), "to", path.relative(projectRoot, output));
            deploy(zipfile, output);
        });
    }
}


/**
 * 利用 git status -s 获取改变的文件
 */
function getChangedFiles() {
    var p = child_process.spawnSync('git', ['status', '-s'], {cwd: projectRoot});
    var lines = null;
    if(p.stdout && p.stdout.length > 0) {
        lines = p.stdout.toString().split("\n");
    }
    if(p.stderr && p.stderr.length > 0) {
        console.error(p.stderr.toString());
        return null;
    }
    if(!lines) {
        return [];
    }
    return lines.filter(function (line) {
        // git 未跟踪的文件
        if(line.indexOf('?') === 0) {
            return false;
        } else {
            return true;
        }
    }).map(function (line) {
        // 得到文件路径
        return path.join(projectRoot, line.substring(3).trim());
    });
}

function captureStdOut(cmd, args, options) {
    var p = child_process.spawnSync(cmd, args, options);
    if(p.stderr && p.stderr.length > 0) {
        console.error(p.stderr.toString());
    }
    if(p.stdout && p.stdout.length > 0) {
        return p.stdout.toString();
    } else {
        return '';
    }
}

function captureStdError(cmd, args, options) {
    var p = child_process.spawnSync(cmd, args, options);
    if(p.stdout && p.stdout.length > 0) {
        console.log(p.stdout.toString());
    }
    if(p.stderr && p.stderr.length > 0) {
        return p.stderr.toString();
    } else {
        return '';
    }
}

function deploy(src, dest) {
    var md5 = crypto.createHash("md5");
    var reader = fs.createReadStream(src);
    mkdirsFor(dest);
    var writer = fs.createWriteStream(dest);
    var md5file = dest.replace(".zip", ".md5");
    reader.on("data", function (chunk) {
        md5.update(chunk);
        writer.write(chunk);
    });
    reader.on("end", function () {
        writer.end();
        console.log("write file", path.relative(projectRoot, dest), "success!");
        fs.writeFileSync(md5file, md5.digest("hex"));
        console.log("write file", path.relative(projectRoot, md5file), "success!");
    });
}

function getDeployName(template, zipfile, version) {
    var name = template.replace("<version>", version);
    return name.replace("<date>", today());
}

function today() {
    var str = (new Date).toISOString();
    str = str.substr(0, 10);
    return str.replace(/-/g, '');
}

function mkdirsFor(file) {
    var dir = path.dirname(file);
    var parts = [];
    var name;
    while(!fs.existsSync(dir)) {
        name = path.basename(dir);
        parts.push(name);
        dir = path.dirname(dir);
    }
    while(parts.length > 0) {
        dir = path.join(dir, parts.pop());
        fs.mkdirSync(dir);
    }
}

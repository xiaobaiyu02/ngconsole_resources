#!/usr/bin/env node

/**
 * 这个脚本用于自动更新远程服务器（VDI 服务器）上客户端包。
 *
 * 在测试过程中，由于底层可执行包打包速度太慢，所以使用直接更新测试远程
 * 客户端包的目的实时查看修改结果，这也是测试人员们乐于看到的。
 *
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bl = require("bl");
const SSHClient = require("ssh2").Client;
const parseIni = require("ini").parse;

// 服务器用户名、密码
const SSH_USER = "root";
const SSH_PASSWORD = "oseasy";
// 服务器版本信息文件
const REMOTE_VERSION_FILE = "/etc/thor/version";
// 客户端包目录
const REMOTE_CLIENT_DIR = "/iso/iso/zip";

if(module === require.main) {
    main();
}

function main(){
    let server = process.argv[2];
    let file = process.argv[3];
    if(file) {
        file = path.resolve(process.cwd(), file);
    }
    if(!/(\d{1,3}\.?){4}(:\d{1,5})?/.test(server) || !fs.existsSync(file)) {
        return console.error("Usage: node deploy2server host:port file");
    }
    let parts = server.split(":");
    deploy(parts[0], parts[1], file);
}

function deploy(host, port, file) {
    let clientInstance;
    let remoteClientConfig;
    // 1. 获取 ssh 连接对象
    getConnection(host, port).then(function (client) {
        clientInstance = client;
        return client;
    }).then(function (client) { // 2. 读取 REMOTE_VERSION_FILE
        console.log(`read ${REMOTE_VERSION_FILE}:`);
        return exec(client, `cat ${REMOTE_VERSION_FILE}`);
    }).then(function (stream) { // 3. 解析 REMOTE_VERSION_FILE
        return new Promise(function (resolve, reject) {
            stream.pipe(bl(function (err, data) {
                if(err) {
                    reject(err);
                } else {
                    resolve(parseIni(data.toString()));
                }
            }))
        })
    }).then(function (conf) { // 4. 显示当前版本并询问是否继续
        remoteClientConfig = conf;
        return readConfirm(`remote client version is ${conf.lang.type}, continue ? `);
    }).then(function () { // 5. 备份相关的文件
        let version = remoteClientConfig.lang.type;
        console.log("backup files:");
        return Promise.all([
            exec(clientInstance, `\\cp ${REMOTE_VERSION_FILE} ${REMOTE_VERSION_FILE}.bak`),
            exec(clientInstance, `\\cp ${REMOTE_CLIENT_DIR}/md5.ini ${REMOTE_CLIENT_DIR}/md5.ini.bak`),
            exec(clientInstance, `\\cp ${REMOTE_CLIENT_DIR}/${version}.zip ${REMOTE_CLIENT_DIR}/${version}.zip.bak`)
        ]);
    }).then(function () { // 6. 准备 sftp
        return cb2promise(clientInstance, 'sftp');
    }).then(function (sftp) { // 7. 替换远程文件
        let md5 = getFileMd5(file);
        let oldMd5 = remoteClientConfig.lang[remoteClientConfig.lang.type];
        console.log("replace files:");
        // 替换文件，替换MD5
        return Promise.all([
            cb2promise(sftp, 'fastPut', [file, `${REMOTE_CLIENT_DIR}/${remoteClientConfig.lang.type}.zip`]),
            exec(clientInstance, `sed -i -e 's/${oldMd5}/${md5}/g' ${REMOTE_VERSION_FILE}`),
            exec(clientInstance, `sed -i -e 's/${oldMd5}/${md5}/g' ${REMOTE_CLIENT_DIR}/md5.ini`)
        ]);
    }).then(function () {
        console.log("all done!");
        close(clientInstance);
    }).catch(function (error) {
        console.error(error);
        close(clientInstance);
    });
}

function cb2promise(obj, method, args) {
    if(!args) {
        args = [];
    }
    return new Promise(function(resolve, reject){
        obj[method](...args, function (err, result) {
            if(err) {
                reject(err);
            } else {
                resolve(result);
            }
        })
    });
}

function exec(client, cmd) {
    return new Promise(function (resolve, reject) {
        console.log("exec command:", cmd);
        client.exec(cmd, function (err, stream) {
            if(err) {
                reject(err);
            } else {
                resolve(stream);
            }
        });
    });
}

function getFileMd5(file) {
    let md5 = crypto.createHash('md5');
    md5.update(fs.readFileSync(file));
    return md5.digest('hex');
}



function readConfirm(prompt) {
    return new Promise(function (resolve, reject) {
        process.stdout.write(prompt);
        let reader = process.stdin;
        reader.on("data", ondata);
        function ondata(data) {
            if(Buffer.isBuffer(data)) {
                data = data.toString();
            }
            reader.removeListener("data", ondata);
            if(/^y(es)?\n$/i.test(data)) {
                resolve();
            } else {
                reject(new Error("invalid input, exit ..."));
            }
        }
    })

}

/**
 * 获取 ssh 连接对象
 * @param  {String} host
 * @param  {String} port
 * @return {Promise}
 */
function getConnection(host, port) {
    return new Promise(function(resolve, reject){
        let conn = new SSHClient();
        let isResolved = false;
        conn.connect({
            host: host,
            port: port || 22,
            username: SSH_USER,
            password: SSH_PASSWORD
        });
        conn.on('ready', function() {
            isResolved = true;
            resolve(conn);
        });
        conn.on("error", function(e){
            if(isResolved) {
                console.error(e);
            } else {
                reject(e);
            }
        });
    });
}

function close(clientInstance) {
    try {
        clientInstance.destroy();
    } catch(e) {
        // ignore any error
    }
    process.exit();
}
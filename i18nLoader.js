/**
 * Created by zhangyao on 2017/5/17.
 *
 * 2017/5/18：由于 VDI 现有脚本受后端，Android端约束太多，这个脚本暂不使用，🤷‍♀️
 */
const fs = require("fs");
const path = require("path");
const qs = require("querystring");
const cheerio = require("cheerio");

const projectRoot = __dirname;

let langData = {};

const translate = (key) => langData.hasOwnProperty(key) ? langData[key] : null;

/**
 * 导出为 webpack loader。
 * 这个 loader 将形如下面的可预翻译片段提前翻译，避免程序运行时创建多个 angular 指令：
 *   <xx localize="i18n_key"></xx>
 *   <xx data-localize="i18n_key"></xx>
 *   <xx localize-title="i18n_key"></xx>
 *   <xx data-localize-title="i18n_key"></xx>
 *   <xx localize-placeholder="i18n_key"></xx>
 *   <xx data-localize-placeholder="i18n_key"></xx>
 * @param source
 */
module.exports = function (source) {
    if(!this.inited) {
        this.inited = initWithQuery(this.query ? this.query.substring(1) : null);
    }

    // 可能模板有多个元素，用一个空元素包装一下
    let id = 'temp-' + (Math.random() + '').substring(2);
    let $ = cheerio.load(`<div id="${id}">${source}</div>`);
    // 替换掉这些
    let attrs = {
        'localize': false,
        'data-localize': false,
        'localize-title': true,
        'data-localize-title': true,
        'localize-placeholder': true,
        'data-localize-placeholder': true
    };
    for(let attr of Object.keys(attrs)) {
        let replaceAttrOnly = attrs[attr];
        let realAttrName = attr.split('-').pop();
        // 替换每个找到的指令
        $(`[${attr}]`).each((i, el) => {
            let $el = $(el);
            // 忽略有参数的 localize 指令
            if($el.attr("param1") || $el.attr("data-param1")) {
                return;
            }
            let key = $el.attr(attr);
            let value = translate(key);
            // null 表示没有对应的翻译
            if(value === null) { return; }
            // 如果仅仅需要替换属性
            if(replaceAttrOnly) {
                $el.attr(realAttrName, value);
            } else {
                if($el.is("input, textarea")) {
                    $el.attr("placeholder", value);
                } else {
                    $el.html(value);
                }
            }
            $el.removeAttr(attr);
        });
    }
    return $('#' + id).html();
};

function initWithQuery(query) {
    if(!query) { return; }
    let o = qs.parse(query);
    let version = o.version;
    langData = JSON.parse(fs.readFileSync(path.join(projectRoot, `resources/pkg/${version}/lang.js`)), "utf-8");
    return true;
}
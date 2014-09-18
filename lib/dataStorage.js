

/**
 * 保存对应url的数据
 * @param url 要存储什么网页的资源，就用什么网页的url，此举会覆盖所有内容
 * @param {object} data
 * @param {string=} flag - w,a,a+
 *  w，默认值，表示覆盖原内容，
 *  a，表示将键值添加上去，若已存在相同键值的数据，则覆盖
 *  a+, 表示若已存在相同键值的数据则将新数据添加到后面
 */
function save(url, data, flag) {

}

/**
 * 将数据添加到对应url的库里边（也许在save上加个w+就可以取消这个接口了）
 * @param url 同save
 * @param {object} data
 * @param {boolean=} flag - 指示若已存在相同键值的数据，是增添还是覆盖，默认为false,表示增添
 */
function add(url, data, flag) {

}

/**
 * 加载数据
 * @param url
 * @param {string | [string] | {} | Function =} keys - 要读取的资源类型作为键值
 *  string:单个资源类型
 *  [string]:资源类型数组
 *  {key1:size1,key2:size2} or {key1:{size1:size,start1:index},key2:{}}
 *  function(data){exports = module.exports = {}}
 * @param {number=} size - 限制取出的数据条数，默认为0，即不限制；keys中的limit的优先级更高
 * @param {number=} start - 从第几条数据开始读，默认为0，keys中的优先级更高,可为负数
 * @returns {object}
 */
function load(url, keys, size, start) {
    return {}
}

/**
 * 移除数据
 * @param url - 若只有url参数则移除当前url对应的所有数据
 * @param {string | [string] | {} | Function =} keys - 要移除的资源类型作为键值
 *  string:单个资源类型
 *  [string]:资源类型数组
 *  {key1:limit1,key2:limit2} or {key1:{limit1:length,start1:index},key2:{}}
 *  function(data){return {}}
 * @param {number=} size - 限制移除的数据条数，默认为0，即不限制；keys中的limit的优先级更高
 * @param {number=} start - 从第几条数据开始移除，默认为0，keys中的优先级更高,可为负数
 */
function remove(url, keys, size, start) {

}

/**
 * 随意增删改数据
 * @param url
 * @param {Function} action - function(data) {}
 */
function manipulate(url, action) {

}

exports = module.exports = {
    add: add,
    save: save,
    load: load,
    remove: remove,
    manipulate: manipulate
}

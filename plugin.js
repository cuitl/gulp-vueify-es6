/**
 * 一些公共的方法
 */
var fs = require('fs');
var path = require('path');

module.exports = {
    /**
     * 读取文件目录下的文件
     * 可以用 gulp.src(path,function(err,files){}) 代替
     * @param {any} path 文件夹路径
     * @returns Array 文件夹路径下的所有文件集合
     */
    readFileList:function (path) {
        var filesList = [];
        var files = fs.readdirSync(path);
        files.forEach(function (itm, index) {
            var stat = fs.statSync(path + itm);
            if (stat.isDirectory()) {
                //递归读取文件
                readFileList(path + itm + "/", filesList)
            } else {

                var obj = {};//定义一个对象存放文件的路径和名字
                obj.path = path;//路径
                obj.filename = itm//名字
                filesList.push(obj);
            }

        });
        return filesList;
    },
    /**
     * 根据路径创建多级文件夹
     * 问题解决: vueify抽取样式时若传入的路径中的文件夹不存在 会导致样式抽取到文件失败 因此需要手动创建目录
     * @param {any} dirpath 
     * @param {any} mode 
     * @returns 
     */
    mkdirsSync:function (dirpath, mode) {
        if (!fs.existsSync(dirpath)) {
            var pathtmp;
            var sp = dirpath.indexOf('/') > -1 ? '/' : '\\';
            dirpath.split(sp).forEach(function(dirname) {
                if (pathtmp) {
                    pathtmp = path.join(pathtmp, dirname);
                }
                else {
                    pathtmp = dirname;
                }
                if (!fs.existsSync(pathtmp)) {
                    if (!fs.mkdirSync(pathtmp, mode)) {
                        return false;
                    }
                }
            });
        }
        return true; 
    },
    repeatFileHandle: (function () {
        var fileDelArr = [];
        return {
            getRepeat: function (file,targetDir) {
                var filenb = path.basename(file,path.extname(file));
                gulp.src(targetDir, function (err, files) {
                    if (err) { console.log('error in browserifies',err); return err; } 
                    files.forEach(function (file, index) {
                        var fname = path.basename(file);
                        if (fname.indexOf(filenb) > -1) {
                            fileDelArr.push(file);
                        }
                    });
                });
            },
            fileDel: function () {
                gulp.src(fileDelArr).pipe(clean());
                fileDelArr = [];
            }
       }
    }())
}
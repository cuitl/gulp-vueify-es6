var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');// soucemap生成
var streamify = require('gulp-streamify'); // 将 返回buffer类型数据的插件的结果转化为 gulp可以处理的流
var uglify = require('gulp-uglify'); // js代码丑化 压缩
var gulpif = require('gulp-if'); // pipe内写逻辑
var md5 = require('gulp-md5-plus');// 文件名 md5字符串添加
var md52 = require('gulp-md5-assets');// html中 js引入 添加 md5版本号
var clean = require('gulp-clean');// 清理文件 文件夹 (不能删除gulpfile.js所在目录外层的文件 文件夹)
var gutil = require('gulp-util'); // 控制台输出 可以控制输入文字的颜色 背景色
var tap = require('gulp-tap'); // 处理多文件 多出口

var browserify = require('browserify');// js模块打包
var watchify = require('watchify');// 加快 browserify的打包速度(基于缓存首次打包时间可能会长一点)
var source = require("vinyl-source-stream");// 将流转化为虚拟文件
var vueify = require('vueify'); // .vue编译
var fs = require('fs'); // node io
var path = require('path');// 路径处理
var browserSync = require('browser-sync'); // 浏览器刷新
var es = require('event-stream'); // 用于流的合并等
var yargs = require('yargs').argv; // 获取 终端写的命令参数

var plugin = require('./plugin');

//路径配置
var pathConfig = {
    server:{ // 启动服务相关配置
        root:__dirname+'/dist',
        startPath: 'index.html'
    },
    basepath:__dirname+'/dist', // 文件编译 指定根目录
    pageBase:'/', // html中 base标签的 url 便于 引入静态资源 解决 js中跳转 页面的路径问题
    baseDir:'/', // 输出到 根目录下的 文件夹的名称
    output:{ // 各个资源 对应的输出路径
        app:'',
        js:'static/js/',
        css:'static/css/',
        images:'static/images/'
    },
    get:function(name) {
        return this.basepath + this.baseDir + ( this.output[name] || '' );
    }
}
// 配置 vueify 抽取css到文件的方法
var vueifyCss = (function () {
    // var cssout = realPath('./dist/static/css'); // 配置 vueify抽取css文件存储的位置
    var cssout = ''; // 不抽取 css时

    return {
        createFolder: function () { // 创建 路径中的文件夹(vueify抽取css文件时 若路径中文件夹不存在会导致失败)
            if (cssout) {
                plugin.mkdirsSync(cssout);
            }
            return this;
        },
        getCssOutFile: function (filename) { // 获取 css文件完整路径 css名字 和 js文件名对应
            return cssout ? cssout+'/'+filename+'.css' :'';
        }
    }
}());

/**
 * 绝对路径地址获取
 * 
 * @param {any} p 如：'./src/app'
 * @returns D:\gitServer\vuejs\demos\gulp-vueify\src\app
 */
function realPath(p) {
    return path.resolve(__dirname, p);
}

/**
 * 根据路径处理html
 * 
 * @param {any} path 文件路径 [] / ''
 * @returns 
 */
function renderApp(path) {
    return gulp.src(path).pipe(gulp.dest('./dist'));
}
/**
 * browserify 打包文件
 * wactify让模块变更时打包变得快速(https://github.com/substack/watchify)
 * @param {any} file 
 */
function browserifies(file) {
    var production = process.env.NODE_ENV === 'production';
    var filename = path.basename(file);
    var cssfile = vueifyCss.getCssOutFile(path.basename(file, path.extname(file)));

    var resultStream = null;
    var b = browserify(file, { debug: true, cache: {}, packageCache: {},delay:500 }); // debug true 生成sourcemap便于调试 两个cache wachify(需要参数)
        b.transform(vueify);
        if ( yargs.w ) { // 有监听命令时才启动 模块儿监听
            b.plugin(watchify);
        }
        if (cssfile) { // 存在则配置 css 抽取
            b.plugin('vueify/plugins/extract-css', {
                out: cssfile // || fs.createWriteStream(url) 的 返回 注意 url 路径中的文件夹必须要存在 
            })
        }

        var bundle = function(ids) {
            // 不是刚启动 init时 用方法获取避免 pipe() 中使用浏览器刷新的判断参数 缓存且不变
            var _notInit = function () { return ids !== 'init'; }
            if( _notInit() ) {
                gutil.log('changing files ',ids);
                // 文件修改时 由于之前的 html 有了一个 hash版本号 若不重新 处理html覆盖之前的文件
                // 会导致 html 在文件中的引用 为 : index.js?ab124?hgdss?ers23.... 这种情况
                // 且此时html处理完后避免浏览器同步刷新 当 js 也编译完成时再刷新
                var fname = path.basename(file,path.extname(file))
                renderApp(realPath('./src/app/' + fname + '.html'));
            }
            resultStream = b.bundle() // browserify到这里返回的是一个常规可读流 若要后面用到 gulp.dest 则需要 vinyl-source-stream 转一下
            .pipe(source(filename))

            // 文件 添加MD5 后缀 ，在开发模式下由于使用了 watchify 加快browserify编译速度，但是会缓存之前的数据
            // 且会与一开始编译的文件做比对，这就导致 同一个文件每次修改会编译出不同文件名的文件的情况下，旧文件
            // 又不能删除掉 否则会报错 说找不到之前的文件 : 所以改用 gulp-md5-assets 只改变 js文件在 html中的md5版本号
            // 不过若要使用 文件名修改也是可以的 就是发布时 发布文件 md5改变的 js, 开发时 用 js引用修改版本号的方式
            // 注：文件不改变的情况下 编译出来的文件名字都是相同的 这样可以保证发布时只会改变 修改的部分而未修改的用户仍然可以使用
            // 之前的缓存.
            // .pipe(streamify(md5(10, realPath('./dist/*.html')))) 

            // sourcemaps uglify处理并返回的是 buffer类型的数据 而 pipe是管道流 因此需要 streamify转一下
            .pipe(streamify(gulpif(production, sourcemaps.init({ loadMaps: true })))) // loadMaps:true 加载已经存在的sourcemap(browserify,debug=true生成的内联sourcemap)
            .pipe(streamify(gulpif(production, uglify())))
            .pipe(streamify(gulpif(production, sourcemaps.write('./'))))

            .pipe(gulp.dest('dist/static/js'))
            .pipe(streamify(md52(10, realPath('./dist/*.html'))))
            .on('end', function () {
                if (_notInit()) {
                    // gutil.log('updated ',gutil.colors.bgBlue(filename) + ' ..finish...');
                }
            })
            // 文件修改时同步到浏览器
            .pipe(gulpif(_notInit(), browserSync.reload({stream:true}) ))
        }
        bundle('init');
        if (yargs.w) { // 监听状态下 绑定 模块儿更新时的处理方法
            b.on('update',bundle);//监听模块改变 这时 bundle的参数为 ids [ '...\\index.js' ] 变更的模块儿文件
            b.on('time',function(time){
                gutil.log('bundle / updating', gutil.colors.bgBlue(filename),'after ',gutil.colors.magenta(time > 1000 ? time / 1000 + 's' : time + 'ms'));
            });
        }
        return resultStream;
}

// html 页面
gulp.task('app', function (done) {
    var stream = renderApp('src/app/*.html');
    stream.on('end', done)
           .pipe(browserSync.reload({ stream: true }));

    // gulp.task('app,function(done){})
    // function 中若添加参数 必须在 .pipe( browserSync.reload({stream:true}) ) 前进行调用(.on('end',done))
    // 否则 done将无法完成
});

// js vue组件集合
gulp.task('js', function(done){
    gulp.src('./src/static/js/*.js', function (err, files) {
        if (!!err) { console.log(err); return; }
        gulp.src(realPath('./dist/static/js/*.*')).pipe(clean());
        vueifyCss.createFolder();
        var tasks = files.map(function (file) {
            return browserifies(file);
        });

        // 返回的stream合成一个 所有stream处理完成后 用 done 来触发任务完成 并 刷新浏览器
        es.merge(tasks).on('end', done)
        .pipe( browserSync.reload({stream:true}) );
    });
});

// 用 gulp-tap 处理多个文件的 browserify打包
// done在 gulp.dest()流后调用 会精确显示 任务执行完成的时间
gulp.task('js2', function (done) {

    gulp.src(realPath('./dist/static/js2/*.*')).pipe(clean());
    vueifyCss.createFolder();

    var production = process.env.NODE_ENV === 'production';
    var commonHandle = function (stream,callback) {
        stream.pipe(streamify(gulpif(production, sourcemaps.init({ loadMaps: true })))) // loadMaps:true 加载已经存在的sourcemap(browserify,debug=true生成的内联sourcemap)
        .pipe(streamify(gulpif(production, uglify())))
        .pipe(streamify(gulpif(production, sourcemaps.write('./'))))
        .pipe(gulp.dest(realPath('./dist/static/js')))
        .on('end',callback)
        .pipe(streamify(md52(10, realPath('./dist/*.html'))))
        .pipe(browserSync.reload({stream:true}))
    }
    var stream = gulp.src(realPath('./src/static/js/*.js'), { read: false })
        .pipe(tap(function (file) {
            gutil.log('bundling ' + file.path);

            var filename = path.basename(file.path);
            var cssfile = vueifyCss.getCssOutFile(path.basename(file.path, path.extname(file.path)));

            var b = browserify(file.path, { debug: true, cache: {}, packageCache: {}, delay: 500 }); // debug true 生成sourcemap便于调试 两个cache wachify(需要参数)
            b.transform(vueify);
            if ( yargs.w ) { // 有监听命令 yargs.w 才启动模块儿监听
                b.plugin(watchify);
            }
            if (cssfile) { // 存在则配置 css 抽取
                b.plugin('vueify/plugins/extract-css', {
                    out: cssfile // || fs.createWriteStream(url) 的 返回 注意 url 路径中的文件夹必须要存在 
                })
            }
            file.contents = b.bundle();
            if ( yargs.w ) {
                b.on('update', function (ids) {
                    gutil.log('changing files ',ids);
                    var fname = path.basename(file.path, path.extname(file.path))
                    renderApp(realPath('./src/app/' + fname + '.html'), true);

                    var stream = b.bundle().pipe(source(filename))

                    commonHandle(stream, function () {
                        // gutil.log('updated ', gutil.colors.bgBlue(filename) + ' ..finish...');
                    });
                });
                b.on('time', function (time) {
                    gutil.log('bundling / updating', gutil.colors.bgBlue(filename),'after ',gutil.colors.magenta(time > 1000 ? time / 1000 + 's' : time + 'ms'));
                });
            }

        }));
        commonHandle(stream, done);
});

// 图片
gulp.task('images', function () {
    gulp.src(realPath('./src/static/images/**/*.*'))
        .pipe(gulp.dest(pathConfig.get('images')));
});

//服务
gulp.task('server', function () {
    console.log( typeof yargs.p );
	yargs.p = typeof yargs.p ==='number' ? yargs.p  : 3000;
    var ghostMode = yargs.nogostMode ? false : true;
    console.log( 'server ghostMode :' + ghostMode);
    browserSync.init({
        ghostMode:ghostMode, // 幽灵模式控制 = false 时 浏览器打开多个的 同一链接页面 一个页面上的操作并不会引起 其他页面进行相同的操作和刷新
        server: {
            baseDir: './dist',
            index:'/index.html'
        },
        port: yargs.p,
        startPath: '/index.html',
        browser: ["chrome"]
    });
});

// 文件监听任务
gulp.task('watch', function () {

    // browserify打包的js模块儿 由 watchify进行监听
    // gulp.watch(realPath('./src/components/*.vue'),['js'] );
    // gulp.watch(realPath('./src/static/js/*.js'),['js'] );

    gulp.watch(realPath('./src/app/*.html'), ['app']);

});

gulp.task('test', function () {
    gulp.src(realPath('./src/static/js/*.js'), { read: false }, function (err, files) {
        console.log(err, files);
    });
});

gulp.task('clean:dist', function () {
    gulp.src(realPath('./dist')).pipe(clean())
});

gulp.task('default',function() {
    setTimeout(function () {
        gulp.start('images', 'app', 'js2');
    }, 800);
    if (yargs.w) {
        gulp.start('watch');
    }
    if (yargs.s) {// 以当前目录下的 build为根路径的服务
        gulp.start('server');
    }
    // process.env.NODE_ENV = 'production';
    console.log('default',__dirname,process.env.NODE_ENV);

});
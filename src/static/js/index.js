// require('vue') 默认引入的是 vue.common.js (由 vue/package.json中的 main指定)

import Vue from 'vue/dist/vue.js';
import hello from '../../components/hello.vue';

new Vue({
    el: '#app',
    template:'<hello></hello>',
    components: {
        'hello':hello
    }
});

console.log('index.js test 26');
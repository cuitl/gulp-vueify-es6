var hello = require('../../components/about.vue');

new Vue({
    el: '#app',
    template:'<hello></hello>',
    components: {
        'hello':hello
    }
});
console.log('about 17')
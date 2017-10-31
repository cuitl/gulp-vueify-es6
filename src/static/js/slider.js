import Vue from 'vue/dist/vue.js';
import slider from '../../components/slider.vue';

new Vue({
    el: '#app',
    template:'<slider></slider>',
    components: {
        'slider':slider
    }
});
console.log('slider test');
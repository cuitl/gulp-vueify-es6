<style lang="scss" scoped>
    h1 {
        color:blue;
        font-size:20px;
    }
    #app {
        border:1px solid red;
        background-image: url('./static/images/bg02.jpg');
        background-repeat: no-repeat;
        background-size: cover;
        h1 {
            color:peru;
        }
    }
</style>
<template>
    <div id="app">
        <h1>Hello World you !</h1>
        <word></word>
    </div>
</template>
<script>
import word from './word.vue';
module.exports = {
    components:{
        'word':word
    }
}
</script>
<template>
    <p :title="hover">这是一个文字段落</p>
</template>
<script>
   export default {
            data:function () {
               return {
                   hover:'我是word.vue组件中的段落'
               } 
            }
   } 
</script>
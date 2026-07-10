<script setup lang="ts">
import NavBar from '@/components/NavBar.vue'
import SiteFooter from '@/components/SiteFooter.vue'
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <NavBar />
    <div class="flex-1">
      <RouterView />
    </div>
    <SiteFooter />
  </div>
</template>

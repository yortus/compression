import { createApp } from 'vue'
import App from './App.vue'
import { vLoupe } from './deck/loupe'
import './styles/global.css'

createApp(App)
  .directive('loupe', vLoupe)
  .mount('#app')

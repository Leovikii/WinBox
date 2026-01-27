/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@wails' {
  const config: {
    info: {
      productVersion: string
    }
  }
  export default config
}
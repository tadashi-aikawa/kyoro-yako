// 撮影映像に開発用FPS表示を載せない。本体の設定には触れない。
export default {
  define: { 'import.meta.env.DEV': 'false' },
  resolve: { alias: process.env.PV_CAPTURE_SOURCE ? { '/src': process.env.PV_CAPTURE_SOURCE } : {} },
  server: { hmr: false, watch: null },
};

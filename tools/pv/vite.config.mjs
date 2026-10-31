// 撮影映像に開発用FPS表示を載せない。本体の設定には触れない。
export default {
  define: { 'import.meta.env.DEV': 'false' },
  server: { hmr: false, watch: null },
};

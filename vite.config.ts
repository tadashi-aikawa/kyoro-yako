import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 数千フレーム分の弾幕を検証するため、CIのCPU速度や負荷に余裕を持たせる。
  test: { environment: 'node', testTimeout: 30_000 },
});

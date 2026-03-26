import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['@supabase/supabase-js', '@supabase/auth-js'],
  },
  optimizeDeps: {
    include: ['@supabase/supabase-js', '@supabase/auth-js'],
  },
});
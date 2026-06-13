import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, sharpImageService } from "astro/config";
import remarkGitHubCallouts from "./src/lib/remarkGitHubCallouts.mjs";
import remarkTocHeadings from "./src/lib/remarkTocHeadings.mjs";
import config from "./src/config/config.json";

// https://astro.build/config
export default defineConfig({
  site: config.site.base_url ? config.site.base_url : "http://examplesite.com",
  base: config.site.base_path ? config.site.base_path : "/",
  trailingSlash: config.site.trailing_slash ? "always" : "never",
  image: { service: sharpImageService() },
  vite: { plugins: [tailwindcss()] },
  integrations: [react(), sitemap()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkGitHubCallouts, remarkTocHeadings],
    }),
    shikiConfig: {
      theme: "one-dark-pro",
      wrap: true,
      langAlias: { conf: "properties" },
    },
  },
});

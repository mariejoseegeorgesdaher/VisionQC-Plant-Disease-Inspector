import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

const packageAliases = {
  "vaul@1.1.2": "vaul",
  "sonner@2.0.3": "sonner",
  "react-resizable-panels@2.1.7": "react-resizable-panels",
  "react-hook-form@7.55.0": "react-hook-form",
  "react-day-picker@8.10.1": "react-day-picker",
  "next-themes@0.4.6": "next-themes",
  "lucide-react@0.487.0": "lucide-react",
  "input-otp@1.4.2": "input-otp",
  "embla-carousel-react@8.6.0": "embla-carousel-react",
  "cmdk@1.1.1": "cmdk",
  "class-variance-authority@0.7.1": "class-variance-authority",
  "@radix-ui/react-tooltip@1.1.8": "@radix-ui/react-tooltip",
  "@radix-ui/react-toggle@1.1.2": "@radix-ui/react-toggle",
  "@radix-ui/react-toggle-group@1.1.2": "@radix-ui/react-toggle-group",
  "@radix-ui/react-tabs@1.1.3": "@radix-ui/react-tabs",
  "@radix-ui/react-switch@1.1.3": "@radix-ui/react-switch",
  "@radix-ui/react-slot@1.1.2": "@radix-ui/react-slot",
  "@radix-ui/react-slider@1.2.3": "@radix-ui/react-slider",
  "@radix-ui/react-separator@1.1.2": "@radix-ui/react-separator",
  "@radix-ui/react-select@2.1.6": "@radix-ui/react-select",
  "@radix-ui/react-scroll-area@1.2.3": "@radix-ui/react-scroll-area",
  "@radix-ui/react-radio-group@1.2.3": "@radix-ui/react-radio-group",
  "@radix-ui/react-progress@1.1.2": "@radix-ui/react-progress",
  "@radix-ui/react-popover@1.1.6": "@radix-ui/react-popover",
  "@radix-ui/react-navigation-menu@1.2.5": "@radix-ui/react-navigation-menu",
  "@radix-ui/react-menubar@1.1.6": "@radix-ui/react-menubar",
  "@radix-ui/react-label@2.1.2": "@radix-ui/react-label",
  "@radix-ui/react-hover-card@1.1.6": "@radix-ui/react-hover-card",
  "@radix-ui/react-dropdown-menu@2.1.6": "@radix-ui/react-dropdown-menu",
  "@radix-ui/react-dialog@1.1.6": "@radix-ui/react-dialog",
  "@radix-ui/react-context-menu@2.2.6": "@radix-ui/react-context-menu",
  "@radix-ui/react-collapsible@1.1.3": "@radix-ui/react-collapsible",
  "@radix-ui/react-checkbox@1.1.4": "@radix-ui/react-checkbox",
  "@radix-ui/react-avatar@1.1.3": "@radix-ui/react-avatar",
  "@radix-ui/react-aspect-ratio@1.1.2": "@radix-ui/react-aspect-ratio",
  "@radix-ui/react-alert-dialog@1.1.6": "@radix-ui/react-alert-dialog",
  "@radix-ui/react-accordion@1.2.3": "@radix-ui/react-accordion",
};

function getPackageName(id) {
  const normalizedId = id.replace(/\\/g, "/");
  const nodeModulesIndex = normalizedId.lastIndexOf("/node_modules/");

  if (nodeModulesIndex === -1) {
    return null;
  }

  const packagePath = normalizedId.slice(nodeModulesIndex + "/node_modules/".length);
  const packageSegments = packagePath.split("/");

  if (packageSegments[0]?.startsWith("@")) {
    return packageSegments.slice(0, 2).join("/");
  }

  return packageSegments[0] || null;
}

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const { default: react } = await import("@vitejs/plugin-react-swc");
  const aiProxyTarget = env.VITE_AI_PROXY_TARGET || env.VITE_AI_API_BASE_URL || "http://127.0.0.1:8000";

  function manualChunks(id) {
    if (!id.includes("node_modules")) {
      return undefined;
    }

    const packageName = getPackageName(id);

    if (!packageName) {
      return undefined;
    }

    if (packageName === "react" || packageName === "react-dom") {
      return "vendor-react";
    }

    if (packageName === "react-router-dom") {
      return "vendor-router";
    }

    if (packageName === "@tanstack/react-query") {
      return "vendor-query";
    }

    if (packageName === "motion" || packageName === "lucide-react") {
      return "vendor-ui";
    }

    if (packageName.startsWith("@radix-ui/")) {
      return "vendor-radix";
    }

    return undefined;
  }

  return {
    plugins: [react()],
    resolve: {
      extensions: [".js", ".jsx", ".json"],
      alias: {
        ...packageAliases,
        "@": srcDir,
      },
    },
    build: {
      target: "esnext",
      outDir: "build",
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
      open: true,
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || "https://localhost:7125",
          changeOrigin: true,
          secure: false,
        },
        "/chat": {
          target: aiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});

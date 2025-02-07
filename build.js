const esbuild = require("esbuild");

esbuild.build({
  entryPoints: ["src/index.ts"],  
  outfile: "dist/index.bundle.js",       
  bundle: true,                   
  platform: "browser",             
  target: "es6",                   
  format: "iife",                   
  sourcemap: true                    
}).then(() => {
  console.log("✅ Compilación exitosa: dist/index.bundle.js");
}).catch(() => process.exit(1));
/**
 * @file /rollup.config.js
 * @name rollup.config.js
 * @description Rollup configuration file
 */

import typescript from "@rollup/plugin-typescript";
import autoExternal from "rollup-plugin-auto-external";
import commonjs from "@rollup/plugin-commonjs";
import babel from "@rollup/plugin-babel";

const config = {
    input: "src/index.ts",
    output: [
        {
            file: "dist/index.cjs",
            format: "cjs",
            exports: "named",
            sourcemap: true,
        },
        {
            file: "dist/index.js",
            format: "esm",
            exports: "named",
            sourcemap: true,
        },
    ],
    plugins: [
        autoExternal({ packagePath: "./package.json" }),
        commonjs(),
        typescript({
            tsconfig: "./tsconfig.json",
        }),
        babel({
            babelHelpers: "bundled",
            extensions: [".ts"],
            exclude: "node_modules/**",
        }),
    ],
    external: [/^@tiptap\//],
};

export default config;

// Bundles the component render tests for node. Components are compiled in
// server mode, so they render to HTML without a DOM, and `obsidian` is aliased
// to a stub since the real runtime only exists inside the app.
import esbuild from 'esbuild'
import esbuildSvelte from 'esbuild-svelte'
import sveltePreprocess from 'svelte-preprocess'
import path from 'node:path'

await esbuild.build({
	entryPoints: ['scripts/render-test.ts'],
	bundle: true,
	platform: 'node',
	format: 'esm',
	outfile: 'scripts/.render-test.mjs',
	conditions: ['svelte'],
	alias: { obsidian: path.resolve('scripts/obsidian-stub.ts') },
	plugins: [
		esbuildSvelte({
			compilerOptions: { generate: 'server', runes: true },
			preprocess: sveltePreprocess(),
		}),
	],
	logLevel: 'error',
})

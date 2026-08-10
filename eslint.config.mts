import obsidianmd from 'eslint-plugin-obsidianmd'
import globals from 'globals'
import { globalIgnores, defineConfig } from 'eslint/config'

export default defineConfig(
	globalIgnores([
		'node_modules',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
		'scripts/.logic-test.cjs',
	]),
	{
		languageOptions: {
			globals: { ...globals.browser },
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ['scripts/**/*.ts'],
		languageOptions: { globals: { ...globals.node } },
		rules: { 'obsidianmd/rule-custom-message': 'off' },
	},
	{
		files: ['src/homeView.ts', 'src/suggester/suggester.ts'],
		rules: { '@typescript-eslint/no-deprecated': 'off' },
	},
	{
		files: ['src/settings.ts'],
		rules: { 'obsidianmd/settings-tab/prefer-setting-definitions': 'off' },
	},
)

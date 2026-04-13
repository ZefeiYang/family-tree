import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier';

// 基础规则
const baseConfig = {
    languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: {
            window: 'readonly',
            document: 'readonly',
            console: 'readonly',
            alert: 'readonly',
            setTimeout: 'readonly',
            clearTimeout: 'readonly',
            requestAnimationFrame: 'readonly',
            URL: 'readonly',
            Blob: 'readonly',
        },
    },
    rules: {
        // 通用规则
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'no-console': 'off',
        'no-debugger': 'warn',
        
        // 缩进与空格
        indent: ['error', 4],
        semi: ['error', 'always'],
        quotes: ['error', 'single', { avoidEscape: true }],
        eqeqeq: ['error', 'always'],
        
        // 代码风格
        curly: ['error', 'all'],
        'brace-style': ['error', '1tbs', { allowSingleLine: true }],
        'comma-dangle': ['error', 'always-multiline'],
        'comma-spacing': ['error', { before: false, after: true }],
        'key-spacing': ['error', { beforeColon: false, afterColon: true }],
        'no-multi-spaces': ['error', { ignoreEOLComments: true }],
        
        // Import/Export
        'import/first': 'error',
        'import/newline-after-import': ['error', { count: 1 }],
        'import/no-unresolved': 'error',
        'import/order': [
            'error',
            {
                groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                'newlines-between': 'always',
                alphabetize: { order: 'asc', caseInsensitive: true },
            },
        ],
    },
};

// 测试文件特殊规则
const testConfig = {
    files: ['tests/**/*.js', '**/*.test.js'],
    languageOptions: {
        globals: {
            describe: 'readonly',
            it: 'readonly',
            expect: 'readonly',
            beforeEach: 'readonly',
            afterEach: 'readonly',
            vi: 'readonly',
        },
    },
    rules: {
        'import/no-extraneous-dependencies': 'off',
    },
};

// 合并配置
export default [
    { 
        ignores: [
            'node_modules/',
            'dist/',
            'build/',
            'coverage/',
            'eslint.config.js',
            '.prettierrc.cjs',
            '**/*.min.js',
            '**/*.bundle.js',
            'js/xlsx.full.min.js',
            '.git/'
        ] 
    },
    js.configs.recommended,
    { ...baseConfig, files: ['**/*.js'] },
    testConfig,
    {
        files: ['**/*.js'],
        plugins: {
            import: importPlugin,
            prettier: prettierPlugin,
        },
        rules: {
            'prettier/prettier': ['error', { singleQuote: true, tabWidth: 4, semi: true }],
        },
    },
];

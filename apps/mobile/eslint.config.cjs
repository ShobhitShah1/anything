const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
const stylistic = require('@stylistic/eslint-plugin');

module.exports = defineConfig([
  expo,
  {
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: '*', next: 'function' },
        { blankLine: 'always', prev: 'function', next: '*' },
      ],
    },
  },
  { ignores: ['dist/**', '.expo/**', 'android/**', 'ios/**'] },
]);

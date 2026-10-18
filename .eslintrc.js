module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true,
  },
  extends: [
    'airbnb-base',
  ],
  overrides: [
    {
      files: ['fetlife-technicolor-elephants.user.js'],
      env: {
        browser: true,
        es2021: true,
      },
      globals: {
        tf: 'readonly',
        nsfwjs: 'readonly',
      },
      rules: {
        'max-len': ['warn', 120],
        'no-use-before-define': 'off',
        'no-unused-vars': 'off',
      },
    },
    {
      files: ['tests/**/*.js'],
      rules: {
        'max-lines': ['warn', 250],
        'global-require': 'off',
        'no-plusplus': 'off',
      },
    },
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    'prefer-const': ['error', { destructuring: 'all' }],
    'no-underscore-dangle': 'off',
    'no-param-reassign': ['error', { props: false }],
    'class-methods-use-this': 'off',
    'no-restricted-syntax': ['error', 'LabeledStatement', 'WithStatement'],
    'max-lines': ['warn', 200],
    'no-bitwise': 'off',
  },
};

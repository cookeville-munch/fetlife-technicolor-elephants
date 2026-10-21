/**
 * JSDoc configuration.
 *
 * Generated API docs are written to docs/api so that the hand-written
 * markdown in docs/ (roadmap.md, elephant-gallery.md) is never overwritten.
 */
module.exports = {
  source: {
    include: ['src'],
    includePattern: '\\.js$',
    excludePattern: '(node_modules|tests|docs)',
  },
  opts: {
    destination: 'docs/api',
    recurse: true,
    readme: './README.md',
  },
  plugins: ['plugins/markdown'],
  templates: {
    default: {
      outputSourceFiles: true,
    },
  },
};

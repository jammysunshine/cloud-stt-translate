// Mock import.meta.url for Jest environment
Object.defineProperty(global, 'import', {
  value: {
    meta: {
      url: 'file:///mocked/path/to/module.js',
    },
  },
  writable: true,
});

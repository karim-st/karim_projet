module.exports = {
  trailingComma: "none",
  tabWidth: 4,
  semi: true,
  singleQuote: true,
  arrowParens: "avoid",
  useTabs: false,
  trailingComma: "es5",
  overrides: [
    {
      files: "*.json",
      options: {
        tabWidth: 2,
      },
    },
    {
      files: "*.md",
      options: {
        tabWidth: 2,
      },
    },
    {
      files: "*.yml",
      options: {
        tabWidth: 2,
      },
    },
  ],
};

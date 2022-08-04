module.exports = {
  testTimeout: 20000,
  transform: {
    "^.+\\.(t|j)s?$": ["@swc/jest"],
  },
};

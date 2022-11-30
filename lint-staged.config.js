module.exports = {
  '**/*.{js,jsx,cjs,mjs,ts,tsx}': [
    'yarn eslint --fix',
    'yarn prettier --write',
  ],
  '**/*.{md,yml,yaml,json}': ['yarn prettier --write'],
};

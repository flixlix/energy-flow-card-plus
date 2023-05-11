module.exports = {
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module"
    },
    extends: [
        "plugin:@typescript-eslint/recommended"
    ],
    rules: {
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-this-alias": ["off"],
        "@typescript-eslint/no-unused-vars": ["off"],
    }
};
module.exports = {
  extends: ["expo"],
  overrides: [
    {
      // The Convex CLI rewrites convex/tsconfig.json without the @/ alias when it configures a
      // new project or local deployment, so everything bundled into Convex uses relative imports.
      files: [
        "convex/**/*.ts",
        "lib/api/**/*.ts",
        "lib/tracking/**/*.ts",
        "lib/metadata-utils.ts",
        "lib/watching-with-others.ts",
      ],
      excludedFiles: ["convex/_generated/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["@/**"],
                message:
                  "Code bundled into Convex must use relative imports: the Convex CLI regenerates convex/tsconfig.json without the @/ alias.",
              },
            ],
          },
        ],
      },
    },
  ],
};

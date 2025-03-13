import type { API, FileInfo, JSCodeshift, Options } from "jscodeshift";

export const parser = "ts";

export default function transformer(
  file: FileInfo,
  api: API,
  options: Options,
) {
  const j: JSCodeshift = api.jscodeshift;
  const root = j(file.source, options);

  // Find all imports
  const allImports = root.find(j.ImportDeclaration);

  // Collect all imported identifiers to detect conflicts
  const importedIdentifiers = new Set();
  allImports.forEach((path) => {
    if (Array.isArray(path.node.specifiers)) {
      path.node.specifiers.forEach((spec) => {
        if (spec.local) {
          importedIdentifiers.add(spec.local.name);
        }
      });
    }
  });

  // Find lodash imports
  const lodashImports = root.find(j.ImportDeclaration, {
    source: {

      value: "lodash",
    },
  });

  console.log(lodashImports.size())
  if (lodashImports.size() === 0) {
    // No lodash import found
    return file.source;
  }



  const lodashMethods = new Set();
  root
    .find(j.MemberExpression, {
      object: {
        type: "Identifier",
        name: "_",
      },
    })
    .forEach((path) => {
      if (path.node.property.type === "Identifier") {
        lodashMethods.add(path.node.property.name);
      }
    });

  // Remove the original lodash import
  lodashImports.remove();

  // Add specific imports for each used lodash method
  lodashMethods.forEach(method => {
    if (importedIdentifiers.has(method)) {
      // If identifier is already imported, import lodash method as a named import
      const newImport = j.importDeclaration(
          // @ts-expect-error jscodeshift type error
        [j.importSpecifier(j.identifier(method), j.identifier(`_${method}`))],
        j.literal(`lodash/${method}`),
      );
      root.get().node.program.body.unshift(newImport);
    } else {
      // Otherwise, import normally
      const newImport = j.importDeclaration(
          // @ts-expect-error jscodeshift type error
        [j.importDefaultSpecifier(j.identifier(method))],
        j.literal(`lodash/${method}`),
      );
      root.get().node.program.body.unshift(newImport);
    }
  });

  // Replace all usages of _.method with method or _method if there was a conflict
  root
    .find(j.MemberExpression, {
      object: {
        type: "Identifier",
        name: "_",
      },
    })
    .replaceWith((path) => {
      // @ts-expect-error jscodeshift type error
      const methodName = path.node.property.name;
      return importedIdentifiers.has(methodName)
        ? j.identifier(`_${methodName}`)
        : j.identifier(methodName);
    });

  return root.toSource({ quote: "single", objectCurlySpacing: false });
}

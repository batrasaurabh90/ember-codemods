import type {
  API,
  JSCodeshift,
  FileInfo,
  ObjectProperty,
  Options,
} from "jscodeshift";

export const parser = "ts";

export default function transformer(
  fileInfo: FileInfo,
  api: API,
  options: Options,
) {
  const j: JSCodeshift = api.jscodeshift;

  const root = j(fileInfo.source, options);

  let isModified = false;

  // Search for all import declarations
  root.find(j.ImportDeclaration).forEach(path => {
    const importSourceValue = path.node.source.value;
    // @ts-expect-error jscodeshfit
    if (importSourceValue.endsWith('-test')) {
      // Define the comment text
      const commentToAdd = ' eslint-disable-next-line ember/no-test-import-export';

      // Check if the previous comment is not the same as the one we want to add
      const alreadyHasComment = path.node.comments && path.node.comments.some(
          comment => comment.value.includes(commentToAdd.trim())
      );

      if (!alreadyHasComment) {
        // Add a new comment to the import declaration
        j(path).replaceWith({
          ...path.node,
          comments: (path.node.comments || []).concat(j.commentLine(commentToAdd))
        });

        isModified = true;
      }
    }
  });

  // Return the modified source if changes have been made, otherwise return the original source
  return isModified ? root.toSource({ quote: "single", objectCurlySpacing: false }) : fileInfo.source;

  // return root.toSource({ quote: "single", objectCurlySpacing: false });
}

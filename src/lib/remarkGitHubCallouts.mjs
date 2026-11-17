import { toString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";

const CALLOUT_MARKER =
  /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s+|\n|$)/i;

const pruneEmptyText = (children) =>
  children.filter(
    (child) => child.type !== "text" || child.value.trim().length > 0,
  );

export default function remarkGitHubCallouts() {
  return (tree) => {
    visit(tree, "blockquote", (node) => {
      const firstChild = node.children?.[0];
      if (!firstChild || firstChild.type !== "paragraph") return;

      const firstParagraphText = toString(firstChild);
      const match = firstParagraphText.match(CALLOUT_MARKER);
      if (!match) return;

      const type = match[1].toLowerCase();
      const firstParagraphFirstChild = firstChild.children?.[0];
      if (!firstParagraphFirstChild || firstParagraphFirstChild.type !== "text")
        return;

      firstParagraphFirstChild.value = firstParagraphFirstChild.value.replace(
        CALLOUT_MARKER,
        "",
      );
      firstChild.children = pruneEmptyText(firstChild.children);

      node.data ||= {};
      node.data.hProperties ||= {};
      node.data.hProperties.className = ["callout", `callout-${type}`];
      node.data.hProperties["data-callout"] = type;

      node.children.unshift({
        type: "paragraph",
        data: { hProperties: { className: ["callout-title"] } },
        children: [{ type: "text", value: match[1] }],
      });

      if (firstChild.children.length === 0) {
        node.children.splice(1, 1);
      }
    });
  };
}

import * as css from "css-tree";
import * as nearestColor from "nearest-color";
const namedColors = require("color-name-list");

export interface TransformResult {
  result: css.CssNode;
  identifier: string;
}

export interface Palette {
  selector: string;
  colors: ColorPair;
  names: ColorPair;
}

export interface ColorPair {
  [key: string]: string;
}

export function addPalette(node: css.CssNode, pair: ColorPair): TransformResult {
  const name = `palette-${collectPalettes(node).length}`;
  const rule: css.Rule = {
    type: "Rule" as "Rule",
    prelude: {
      type: "SelectorList",
      children: new css.List<css.Selector>().fromArray([
        {
          type: "Selector",
          children: new css.List<css.AttributeSelector>().fromArray([
            {
              type: "AttributeSelector",
              name: {
                type: "Identifier",
                name: "palette"
              },
              value: {
                type: "Identifier",
                name: name
              },
              matcher: "=",
              flags: ""
            }
          ])
        }
      ])
    },
    block: {
      type: "Block",
      children: new css.List<css.Declaration>()
    }
  };

  const keys = Object.keys(pair);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i],
      val = pair[key];
    rule.block.children.push({
      type: "Declaration",
      important: false,
      property: `--${key}`,
      value: {
        type: "Raw",
        value: val
      }
    });
  }

  if (node.type == "StyleSheet") {
    node.children.push(rule);
  }

  return {
    identifier: name,
    result: node
  };
}

export function updateRootPalette(node: css.CssNode, palette: Palette) {
  css.walk(node, node => {
    if (node.type == "Rule" && css.generate(node.prelude) == ":root") {
      node.block.children.clear();
      const keys = Object.keys(palette.colors);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i],
          val = palette.colors[key];
        node.block.children.push({
          type: "Declaration",
          important: false,
          property: `--${key}`,
          value: {
            type: "Raw",
            value: val
          }
        });
      }
    }
  });
}

const colors = namedColors.reduce((o, {name, hex}) => Object.assign(o, {[name]: hex}), {});
const colorName = nearestColor.from(colors);

export function collectPalettes(node: css.CssNode): ReadonlyArray<Palette> {
  const palettes: Array<Palette> = [];
  css.walk(node, node => {
    if (node.type == "Rule" && node.prelude.type == "SelectorList") {
      const selector = (node.prelude.children.first() as css.Selector).children.first();
      if (
        selector.type == "AttributeSelector" &&
        selector.value.type == "Identifier" &&
        selector.name.name == "palette"
      ) {
        const palette: Palette = {
          selector: selector.value.name,
          colors: {},
          names: {}
        };
        css.walk(node, declNode => {
          if (
            declNode.type == "Declaration" &&
            declNode.value.type == "Raw" &&
            declNode.property.startsWith("--")
          ) {
            const name = declNode.property.slice(2),
              value = declNode.value.value.trim();
            palette.colors[name] = value;
            palette.names[name] = colorName(value).name;
          }
        });
        palettes.push(palette);
      }
    }
  });
  return palettes;
}

export const DefaultPalettes = [
  {
    names: {},
    colors: {
      primary: "#673ab7",
      secondary: "#4527a0",
      "primary-text": "#fff",
      "secondary-text": "#000",
      background: "#673ab7"
    }
  },
  {
    names: {},
    colors: {
      primary: "#f4511e",
      secondary: "#b91400",
      "primary-text": "#fff",
      "secondary-text": "#000",
      background: "#f4511e"
    }
  },
  {
    names: {},
    colors: {
      primary: "#1565c0",
      secondary: "#003c8f",
      "primary-text": "#fff",
      "secondary-text": "#000",
      background: "#673ab7"
    }
  }
].map(pp => {
  for (const key of Object.keys(pp.colors)) {
    pp.names[key] = colorName(pp.colors[key]).name;
  }
  return pp;
});

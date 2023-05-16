import {AfterViewInit, Component, Input, OnInit} from "@angular/core";
import JSZip from "jszip";

interface FileNode {
  name: string;
  dir: boolean;
  date: string;
  children?: FileNode[];
  expanded?: boolean;
  parent?: FileNode;
  size: number;
}

@Component({
  selector: "zip-viewer",
  templateUrl: "./zip-viewer.component.html",
  styleUrls: ["./zip-viewer.component.scss"]
})
export class ZipViewerComponent implements OnInit {
  @Input() content;
  @Input() controls: boolean;

  nodes: FileNode[];
  currentNode: FileNode;

  constructor() {}

  ngOnInit(): void {
    const fileReader = new FileReader();
    fileReader.onload = () => {
      const arrayBuffer = fileReader.result as ArrayBuffer;
      JSZip.loadAsync(arrayBuffer).then(zip => {
        this.nodes = this.createFileTree(zip.files);
        this.currentNode = this.nodes[0].parent;
      });
    };
    fileReader.readAsArrayBuffer(this.content);
  }

  createFileTree(data: {[key: string]: any}): FileNode[] {
    const root: FileNode = {name: "/", dir: true, date: "", size: 0};
    const nodes: {[key: string]: FileNode} = {"/": root};

    // Create nodes for each file/directory
    Object.keys(data).forEach(filePath => {
      const parts = filePath.split("/");
      let parent: FileNode = root;
      for (let i = 0; i < parts.length; i++) {
        const name = parts[i];

        if (name == "") {
          continue;
        }

        const isDir = i < parts.length - 1 || data[filePath].dir;
        const path = parts.slice(0, i + 1).join("/");
        const existingNode = nodes[path];
        if (existingNode) {
          parent = existingNode;
        } else {
          const size = data[filePath]._data ? data[filePath]._data.uncompressedSize || 0 : 0;
          const node: FileNode = {
            name,
            dir: isDir,
            date: data[filePath].date,
            parent,
            size
          };
          parent.children = parent.children || [];
          parent.children.push(node);

          parent.children = this.sortNodes(parent.children);

          nodes[path] = node;
          parent = node;
        }
      }
    });

    return root.children || [];
  }

  sortNodes(nodes: FileNode[]) {
    return nodes.sort((a, b) => {
      if (a.dir && !b.dir) {
        return -1;
      } else if (!a.dir && b.dir) {
        return 1;
      } else {
        return a.name.localeCompare(b.name);
      }
    });
  }

  onNodeClicked(node: FileNode) {
    if (!node.dir) {
      return;
    }

    this.currentNode = node;
  }

  back() {
    this.currentNode = this.currentNode.parent;
  }

  formatSize(node: FileNode) {
    let size = node.size;

    if (node.dir) {
      return " ";
    }

    let unit;
    const mb = 1024 * 1024;
    const kb = 1024;

    if (size > mb) {
      size = size / mb;
      unit = "MB";
    } else if (size > kb && size < mb) {
      size = size / kb;
      unit = "KB";
    } else {
      unit = "Bytes";
    }

    return `${size.toFixed(1)} ${unit}`;
  }
}

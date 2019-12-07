import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WsResponse
} from "@nestjs/websockets";
import {ChildProcess, fork} from "child_process";
import * as css from "css-tree";
import {promises} from "fs";
import {JSONSchema7} from "json-schema";
import * as multimatch from "multimatch";
import * as path from "path";
import * as request from "request-promise-native";
import {from, fromEvent, Subject, Observable} from "rxjs";
import {map, tap} from "rxjs/operators";
import {CollectionDiscovery, CollectionRegistry, ElementFlags, ElementSchema} from "./collection";
import {getCustomCodeInHead, updateCustomCodeInHead} from "./html";
import {collectPalettes, ColorPair, DefaultPalettes, updateRootPalette} from "./palette";
import {Project} from "./project";
import {SourceEngine} from "./source/engine";
import {Rule} from "./source/interface";
import {apply, chain, ignoreElements, zip} from "./source/rules/base";
import {getInstructionName} from "./source/rules/helper";
import {addNgForOf, ngForOf, NgForOfSchema, updateNgForOf} from "./source/rules/ngfor";
import {empty} from "./source/rules/page";
import {getRouterLink, getRoutes, upsertRouterLink} from "./source/rules/routing";
import {source, writeSource} from "./source/rules/source";
import {template} from "./source/rules/template";

@WebSocketGateway({namespace: "composer", transports: ["websocket"]})
export class ComposerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  dispose = new Subject();
  engine: SourceEngine;
  registry: CollectionRegistry;

  resolverMap: Map<string, (...args: any) => Promise<JSONSchema7>>;

  constructor(private project: Project) {}

  afterInit() {
    this.resolverMap = new Map<string, (...args: any) => Promise<JSONSchema7>>();
    this.resolverMap.set("Bucket", options => {
      //TODO(thesayyn): use service managed scripts to
      //resolve dynamic schemas
      return request.get(`${process.env.PUBLIC_HOST}/bucket/${options.source}`).then(JSON.parse);
    });
  }

  handleConnection(client: any) {
    console.log("connection", client.id);
  }

  handleDisconnect() {
    this.dispose.next();
  }

  @SubscribeMessage("ready")
  getReady(socket) {
    console.log("ready", socket.id);
    return this.project
      .initialized()
      .then(() => {
        this.engine = new SourceEngine(this.project.schematic._host);
        this.registry = new CollectionRegistry(new CollectionDiscovery(this.project.root));
        socket.emit("page", this.engine.execute(getRoutes));
        return "ready";
      })
      .catch(() => {
        return {
          palettes: DefaultPalettes,
          fonts: [
            {
              name: "Montser",
              src: "https://fonts.googleapis.com/css?family=Montserrat",
              family: "Montserrat"
            },
            {
              name: "Antiqua",
              src: "https://fonts.googleapis.com/css?family=Modern+Antiqua",
              family: "Modern Antiqua"
            },
            {
              name: "Karla",
              src: "https://fonts.googleapis.com/css?family=Karla",
              family: "Karla"
            },
            {
              name: "Raleway",
              src: "https://fonts.googleapis.com/css?family=Raleway",
              family: "Raleway"
            }
          ]
        };
      });
  }

  @SubscribeMessage("initialize")
  initialize(socket, options: InitializeOptions) {
    return this.project
      .initialize({
        colors: undefined,
        font: undefined,
        name: options.name
      })
      .then(() => this.getReady(socket));
  }

  @SubscribeMessage("new page")
  addPage(socket, options: CreatePageOptions) {
    console.log("new page", socket.id);
    this.engine.execute(empty(options.name, options.route));
    socket.emit("page", this.engine.execute(getRoutes));
  }

  @SubscribeMessage("add element")
  addElement(socket, [target, elementName]) {
    console.log("add element", socket.id, target, elementName);

    const rules: Rule<any>[] = [template.getRootIdentifier, template.get];
    target.ancestors.forEach(ancestor => {
      rules.push(template.getIdentifier(ancestor.index), template.get);
    });

    from(this.registry.getElement(elementName))
      .pipe(
        tap(element => {
          this.engine.execute(
            apply(
              source(target.path),
              chain(
                zip(rules),
                (templ: template.Template, ctx) => {
                  if (target.index) {
                    ctx.transforms.push(
                      ...template.addChildElement(
                        templ,
                        ctx,
                        target.index,
                        element.name,
                        element.$entrypoint && element.$entrypoint.importSpecifier,
                        element.$entrypoint && element.$entrypoint.moduleSpecifier
                      )
                    );
                  } else {
                    ctx.transforms.push(
                      ...template.addElementWithContainer(
                        templ,
                        ctx,
                        element.name,
                        element.$entrypoint && element.$entrypoint.importSpecifier,
                        element.$entrypoint && element.$entrypoint.moduleSpecifier
                      )
                    );
                  }
                  ctx.transforms.push(template.updateAllConstsAndVars());
                },
                writeSource(target.path)
              )
            )
          );
        })
      )
      .toPromise();
  }

  @SubscribeMessage("remove element")
  removeElement(socket, options: TargetOptions) {
    console.log("remove element", socket.id, options);

    const rules: Rule<any>[] = [template.getRootIdentifier, template.get];
    options.ancestors.forEach(ancestor => {
      rules.push(template.getIdentifier(ancestor.index), template.get);
    });

    this.engine.execute(
      apply(
        source(options.path),
        chain(
          zip(rules),
          (templ, ctx) => {
            ctx.transforms.push(
              template.removeInstruction(templ, options.index),
              template.removeInstructionProperties(templ, options.index),
              template.updateAllConstsAndVars()
            );
          },
          writeSource(options.path)
        )
      )
    );
  }

  @SubscribeMessage("move element")
  moveElement(socket, [target, to]) {
    const rules: Rule<any>[] = [template.getRootIdentifier, template.get];
    target.ancestors.forEach(ancestor => {
      rules.push(template.getIdentifier(ancestor.index), template.get);
    });

    this.engine.execute(
      apply(
        source(target.path),
        chain(
          zip(rules),
          (templ, ctx) => {
            ctx.transforms.push(template.moveInstruction(templ, target.index, to));
          },
          writeSource(target.path)
        )
      )
    );
  }

  @SubscribeMessage("element schema")
  elementSchema(socket, target: TargetOptions) {
    console.log("element schema", socket.id, target);
    const path = target.path;

    const rules: Rule<any, any>[] = [template.getRootIdentifier, template.get];

    const [ancestor] = target.ancestors;

    if (target.ancestors.length) {
      rules.push(
        ignoreElements(
          chain(
            (templ: template.Template) =>
              template.getInstructionProperty(templ, ancestor.index, "ngForOf"),
            ngForOf(),
            info => {
              this.registry.getService(info.importSpecifier, info.moduleSpecifier).then(service => {
                const schema: NgForOfSchema = {
                  name: service.name,
                  properties: service.methods[info.method].parameters
                };
                this.resolverMap
                  .get(service.name)(info.arguments)
                  .then(schema => {
                    socket.emit("context", schema);
                  });

                socket.emit("forof", {
                  schema,
                  arguments: info.arguments
                });
              });
            }
          )
        )
      );

      target.ancestors.forEach(ancestor =>
        rules.push(template.getIdentifier(ancestor.index), template.get)
      );
    }

    this.engine.execute(
      apply(
        source(path),
        chain(zip(rules), (templ, ctx) => {
          const instruction = template.getInstruction(templ, target.index);
          const name = getInstructionName(instruction);
          const properties = template.getInstructionProperties(instruction);

          const routerLink = getRouterLink(templ, target.index);

          if (routerLink) {
            socket.emit("routerlink", routerLink);
          }

          this.registry.getElement(name).then(schema => {
            socket.emit("element schema", {schema, properties});
          });
        })
      )
    );
  }

  @SubscribeMessage("add collection")
  addCollection(socket, spec) {
    return this.registry
      .fetchCollection(spec)
      .then(manifest => this.registry.installCollection(manifest))
      .catch(error => (error instanceof Error ? error.message : error))
      .then(() => this.getCollections());
  }

  @SubscribeMessage("collections")
  getCollections() {
    return this.registry.collections().then(data => ({event: "collections", data}));
  }

  @SubscribeMessage("services")
  getServices(socket) {
    this.registry.getServices().then(services => socket.emit("services", services));
  }

  @SubscribeMessage("elements")
  elements(socket, target?: TargetOptions) {
    console.log("elements");

    let elements: Promise<ElementSchema[]> = this.registry
      .getElements()
      .then(elements => elements.filter(e => !(e.flags & ElementFlags.Slotted)));

    console.log(target);

    if (target) {
      const rules: Rule<any>[] = [template.getRootIdentifier, template.get];
      target.ancestors.forEach(ancestor => {
        rules.push(template.getIdentifier(ancestor.index), template.get);
      });

      const name = this.engine.execute(
        apply(
          source(target.path),
          chain(zip(rules), templ =>
            getInstructionName(template.getInstruction(templ, target.index))
          )
        )
      );

      if (name != "div") {
        elements = this.registry.getElement(name).then(element =>
          this.registry.getElements().then(elements => {
            console.log(elements);
            return elements.filter(elem => multimatch(elem.name, element.slot));
          })
        );
      }
    }

    return elements.then(data => ({event: "elements", data}));
  }

  @SubscribeMessage("custom code")
  getCustomCode() {
    return getCustomCodeInHead(this.project.root).then(data => ({
      event: "custom code",
      data
    }));
  }

  @SubscribeMessage("update custom code")
  updateCustomCode(socket, code) {
    return updateCustomCodeInHead(this.project.root, code).then(() => this.getCustomCode());
  }

  @SubscribeMessage("update forof")
  updateNgForOf(socket, [target, args]) {
    console.log("update ngforof", socket.id, target);
    const mostCloser = target.ancestors.shift();

    const rules: Rule<any>[] = [template.getRootIdentifier, template.get];
    target.ancestors.forEach(ancestor => {
      rules.push(template.getIdentifier(ancestor.index), template.get);
    });

    this.engine.execute(
      apply(
        source(target.path),
        chain(
          zip(rules),
          chain(
            templ => template.getInstructionProperty(templ, mostCloser.index, "ngForOf"),
            ngForOf(),
            updateNgForOf(args),
            writeSource(target.path)
          )
        )
      )
    );
  }

  @SubscribeMessage("add forof")
  addForOf(socket, [target, service, args]) {
    console.debug("add forof", target);
    this.registry.getService(service).then(service => {
      this.engine.execute(
        apply(
          source(target.path),
          chain(
            template.getRootIdentifier,
            template.get,
            addNgForOf({
              arguments: args,
              importSpecifier: service.$entrypoint.importSpecifier,
              moduleSpecifier: service.$entrypoint.moduleSpecifier,
              method: "find",
              index: target.index
            }),
            (_, ctx) => ctx.transforms.push(template.updateAllConstsAndVars()),
            writeSource(target.path)
          )
        )
      );
    });
  }

  @SubscribeMessage("get services")
  getService(socket) {
    this.registry.getServices().then(services => socket.emit("services", services));
  }

  @SubscribeMessage("update element properties")
  updateProperties(socket, [target, properties]) {
    console.log("update element properties", socket.id, target, properties);
    try {
      const rules: Rule<any>[] = [template.getRootIdentifier, template.get];

      if (target.ancestors) {
        target.ancestors.forEach(ancestor => {
          rules.push(template.getIdentifier(ancestor.index), template.get);
        });
      }

      console.log(target);
      this.engine.execute(
        apply(
          source(target.path),
          chain(
            zip(rules),
            (templ, ctx) =>
              template.updateInstructionProperties(templ, ctx, target.index, properties),
            writeSource(target.path)
          )
        )
      );
    } catch (e) {
      console.log(e);
    }
  }

  @SubscribeMessage("palettes")
  getPalettes() {
    console.log("palettes");
    const stylePath = path.join(this.project.root, "src", "styles.css");
    return promises
      .readFile(stylePath)
      .then(fileContent => collectPalettes(css.parse(fileContent.toString())))
      .then(palettes => ({event: "palettes", data: palettes}));
  }

  @SubscribeMessage("update palette")
  updatePalette(socket, [target, palette]) {
    const stylePath = path.join(this.project.root, "src", "styles.css");

    return promises
      .readFile(stylePath)
      .then(scssFile => {
        const ast = css.parse(scssFile.toString());

        if (!target) {
          updateRootPalette(ast, palette);
        } else {
          const rules: Rule<any>[] = [template.getRootIdentifier, template.get];
          target.ancestors.forEach(ancestor => {
            rules.push(template.getIdentifier(ancestor.index), template.get);
          });

          this.engine.execute(
            apply(
              source(target.path),
              chain(
                zip(rules),
                (templ, ctx) => {
                  ctx.transforms.push(
                    template.setAttribute(templ, target.index, "palette", palette.selector)
                  );
                },
                writeSource(target.path)
              )
            )
          );
        }

        return css.generate(ast);
      })
      .then(css => promises.writeFile(stylePath, css));
  }

  @SubscribeMessage("update container styles")
  updateContainerStyles(socket, [target, style]) {
    console.log("update container styles");
    const rules: Rule<any>[] = [template.getRootIdentifier, template.get];
    target.ancestors.forEach(ancestor => {
      rules.push(template.getIdentifier(ancestor.index), template.get);
    });

    this.engine.execute(
      apply(
        source(target.path),
        chain(
          zip(rules),
          (templ, ctx) => {
            ctx.transforms.push(
              template.updateElementStyles(
                templ,
                target.index,
                `box-sizing:border-box; float:left; width: 100%; ${
                  style == "boxed" ? "padding: 0 10%;" : ""
                }`
              )
            );
          },
          writeSource(target.path)
        )
      )
    );
  }

  @SubscribeMessage("upsert routerlink")
  upsertRouterlink(socket, [target, segments]) {
    console.log("upsert routerlink", socket.id, target);

    const rules: Rule<any>[] = [template.getRootIdentifier, template.get];
    target.ancestors.forEach(ancestor => {
      rules.push(template.getIdentifier(ancestor.index), template.get);
    });

    this.engine.execute(
      apply(
        source(target.path),
        chain(
          zip(rules),
          (templ, ctx) => {
            ctx.transforms.push(...upsertRouterLink(templ, ctx, target.index, segments));
          },
          writeSource(target.path)
        )
      )
    );
  }

  @SubscribeMessage("viewport")
  viewport() {
    return;
  }

  private architect: ChildProcess;

  @SubscribeMessage("serve")
  serve(): Observable<WsResponse> {
    console.log("serve");
    if (!this.architect) {
      this.architect = fork(path.resolve(__dirname, "worker", "architect.js"), undefined, {
        cwd: this.project.root,
        stdio: "inherit"
      });
    }

    this.architect.send({
      type: "serve",
      root: this.project.root,
      publicHost: this.project.options.serverUrl
    });

    return fromEvent(this.architect, "message").pipe(map(([data]) => ({event: "progress", data})));
  }
}

export interface InitializeOptions {
  name: string;
  font: string;
  colors: ColorPair;
}

export interface CreatePageOptions {
  name: string;
  route: string;
}

export enum ViewType {
  Element = 1, // When user come over element
  Slot = 2, // When user come over child binding slot
  Container = 3 // When user come over an dynamic inserted view
}

export interface Ancestor {
  type: ViewType;
  index: string;
}

export interface TargetOptions {
  path: string;
  ancestors: Ancestor[];
  index: string;
}

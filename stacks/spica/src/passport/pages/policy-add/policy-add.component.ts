import {Component, OnInit} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {switchMap, tap, take, filter, map} from "rxjs/operators";
import {emptyPolicy, Policy} from "../../interfaces/policy";
import {Services} from "../../interfaces/service";
import {Statement} from "../../interfaces/statement";
import {PolicyService} from "../../services/policy.service";
import {merge} from "rxjs";
import {MatDialog} from "@angular/material/dialog";
import {PolicyResourceAddComponent} from "@spica-client/passport/components/policy-resource-add/policy-resource-add.component";

@Component({
  selector: "passport-policy-add",
  templateUrl: "./policy-add.component.html",
  styleUrls: ["./policy-add.component.scss"]
})
export class PolicyAddComponent implements OnInit {
  policy = {name: undefined, description: undefined, statements: []};
  originalPolicy: Policy = emptyPolicy();
  services: Services;

  constructor(
    private activatedRoute: ActivatedRoute,
    private policyService: PolicyService,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit() {
    this.services = this.policyService.getServices();

    merge(
      this.activatedRoute.queryParams.pipe(
        filter(params => params.template),
        map(params => JSON.parse(params.template))
      ),
      this.activatedRoute.params.pipe(
        filter(params => params.id),
        map(params => params.id),
        switchMap(id => this.policyService.findOne(id))
      )
    )
      .pipe(
        take(1),
        tap(policy => {
          this.originalPolicy = policy;
          this.policy.name = this.originalPolicy.name;
          this.policy.description = this.originalPolicy.description;
          this.originalPolicy.statement.forEach((statement: Statement) => {
            const existingStatement = this.policy.statements.findIndex(
              manuplatedStatement => statement.module == manuplatedStatement.module
            );
            if (existingStatement >= 0) {
              this.policy.statements[existingStatement].actions.push({
                action: statement.action,
                resource: statement.resource
              });
            } else {
              this.policy.statements.push({
                module: statement.module,
                actions: [
                  {
                    action: statement.action,
                    resource: statement.resource
                  }
                ]
              });
            }
          });
        })
      )
      .subscribe();
  }

  isServiceUsed(module: string) {
    return this.policy.statements.some(statement => module == statement.module);
  }

  getAction(module: string, action: string) {
    const statementIndex = this.policy.statements.findIndex(
      statement => statement.module == module
    );
    const actionIndex = this.policy.statements[statementIndex]["actions"].findIndex(
      actionInStatement => actionInStatement.action == action
    );
    return actionIndex >= 0
      ? this.policy.statements[statementIndex]["actions"][actionIndex]
      : false;
  }

  getResourceSelection(action) {
    if (action && action.resource instanceof Array) {
      return "include";
    } else if (action && action.resource instanceof Object) {
      return "exclude";
    } else {
      return undefined;
    }
  }

  toggleAction(module: string, action: string) {
    const statementIndex = this.policy.statements.findIndex(
      statement => statement.module == module
    );
    let actionIndex = this.policy.statements[statementIndex]["actions"].findIndex(
      actionInStatement => actionInStatement.action == action
    );
    if (actionIndex < 0) {
      this.policy.statements[statementIndex]["actions"].push({
        action: action,
        resource: [this.services[module][action].map(action => (action = "*")).join("/")]
      });
    } else {
      this.policy.statements[statementIndex]["actions"].splice(actionIndex, 1);
    }
  }

  isActionActive(module: string, action: string) {
    return this.getAction(module, action) ? true : false;
  }

  editResources(statement, action: string) {
    if (this.isActionActive(statement.module, action)) {
      this.dialog.open(PolicyResourceAddComponent, {
        width: "880px",
        maxWidth: "90%",
        maxHeight: "800px",
        data: {
          services: this.services,
          statement,
          action
        }
      });
    } else {
      this.toggleAction(statement.module, action);
    }
  }

  acceptsResource(statement, action: string) {
    return (
      this.services[statement.module] &&
      this.services[statement.module][action] &&
      this.services[statement.module][action].length > 0
    );
  }

  noResourceInserted() {
    let isResourceMissing = false;
    for (const statement of this.policy.statements) {
      for (const action of statement.actions) {
        if (this.acceptsResource(statement, action.action) && action.resource.length == 0) {
          isResourceMissing = true;
          break;
        }
      }
    }
    return isResourceMissing;
  }

  savePolicy() {
    const policy: Policy = {...this.originalPolicy, statement: []};
    this.policy["statements"].forEach(statement => {
      statement.actions.forEach(action =>
        policy["statement"].push({
          module: statement.module,
          action: action.action,
          resource: action.resource
        })
      );
    });
    (policy._id ? this.policyService.updatePolicy(policy) : this.policyService.createPolicy(policy))
      .toPromise()
      .then(() => this.router.navigate(["passport/policy"]));
  }

  addStatement() {
    this.policy.statements.push({
      actions: [],
      module: undefined
    });
  }

  removeStatement(index: number) {
    this.policy.statements.splice(index, 1);
  }

  onModuleChange(statement) {
    statement.actions = [];
  }
}

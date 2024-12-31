import {Component, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {switchMap, tap, take, filter, map} from "rxjs/operators";
import {emptyPolicy, Policy} from "../../interfaces/policy";
import {Services} from "../../interfaces/service";
import {Statement, DisplayedStatement} from "../../interfaces/statement";
import {PolicyService} from "../../services/policy.service";
import {merge} from "rxjs";
import {MatLegacyDialog as MatDialog} from "@angular/material/legacy-dialog";
import {PolicyResourceAddComponent} from "@spica-client/passport/components/policy-resource-add/policy-resource-add.component";

@Component({
  selector: "passport-policy-add",
  templateUrl: "./policy-add.component.html",
  styleUrls: ["./policy-add.component.scss"]
})
export class PolicyAddComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;

  displayedStatements: DisplayedStatement[] = [];
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
          this.prepareToShow(this.originalPolicy, this.displayedStatements);
        })
      )
      .subscribe();
  }

  prepareToShow(policy: Policy, statements: DisplayedStatement[]) {
    policy.statement.forEach((originalSt: Statement) => {
      const existingIndex = statements.findIndex(
        displayedSt => originalSt.module == displayedSt.module
      );

      if (existingIndex == -1) {
        statements.push({
          module: originalSt.module,
          actions: [
            {
              name: originalSt.action,
              resource: originalSt.resource
            }
          ]
        });
      } else {
        statements[existingIndex].actions.push({
          name: originalSt.action,
          resource: originalSt.resource
        });
      }
    });
  }

  isServiceUsed(module: string) {
    return this.displayedStatements.some(statement => module == statement.module);
  }

  getResource(statement: DisplayedStatement, action: string) {
    const actionIndex = statement.actions.findIndex(
      actionInStatement => actionInStatement.name == action
    );

    if (actionIndex == -1) {
      return false;
    }

    return statement.actions[actionIndex].resource;
  }

  toggleAction(statement: DisplayedStatement, action: string) {
    const actionIndex = statement.actions.findIndex(
      actionInStatement => actionInStatement.name == action
    );

    if (actionIndex == -1) {
      const newStatement: any = {
        name: action
      };

      const acceptResource = this.acceptsResource(statement, action);
      if (acceptResource) {
        newStatement.resource = {
          include: [],
          exclude: []
        };
      }

      statement.actions.push(newStatement);
    } else {
      statement.actions.splice(actionIndex, 1);
    }
  }

  isActionActive(statement: DisplayedStatement, action: string) {
    return statement.actions.findIndex(actionInStatement => actionInStatement.name == action) != -1;
  }

  editResources(statement: DisplayedStatement, action: string) {
    if (this.isActionActive(statement, action)) {
      const currentAction = statement.actions.find(
        actionInStatement => actionInStatement.name == action
      );

      this.dialog.open(PolicyResourceAddComponent, {
        width: "90%",
        maxWidth: "1200px",
        maxHeight: "800px",
        data: {
          services: this.services,
          statement,
          currentAction
        }
      });
    } else {
      this.toggleAction(statement, action);
    }
  }

  acceptsResource(statement: DisplayedStatement, action: string) {
    return (
      this.services[statement.module] &&
      this.services[statement.module].actions[action] &&
      this.services[statement.module].actions[action].length > 0
    );
  }

  noResourceInserted() {
    let isResourceMissing = false;
    for (const statement of this.displayedStatements) {
      for (const action of statement.actions) {
        if (this.acceptsResource(statement, action.name) && !action.resource.include.length) {
          isResourceMissing = true;
          break;
        }
      }
    }
    return isResourceMissing;
  }

  prepareToSave(statements: DisplayedStatement[]) {
    const originalStatements = [];

    statements.forEach(statement => {
      statement.actions.forEach(action =>
        originalStatements.push({
          module: statement.module,
          action: action.name,
          resource: action.resource
        })
      );
    });

    return originalStatements;
  }

  savePolicy() {
    const policy: Policy = this.originalPolicy;
    policy.statement = this.prepareToSave(this.displayedStatements);

    (policy._id ? this.policyService.updatePolicy(policy) : this.policyService.createPolicy(policy))
      .toPromise()
      .then(() => this.router.navigate(["passport/policy"]));
  }

  addStatement() {
    this.displayedStatements.push({
      actions: [],
      module: undefined
    });
  }

  removeStatement(index: number) {
    this.displayedStatements.splice(index, 1);
  }

  onModuleChange(statement: DisplayedStatement) {
    statement.actions = [];
  }
}

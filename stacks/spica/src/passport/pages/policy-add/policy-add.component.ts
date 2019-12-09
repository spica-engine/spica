import {Component, OnInit, ViewChild} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {parse as pathParse} from "path-to-regexp";
import {iif, of, Subject} from "rxjs";
import {filter, mergeMap, switchMap, takeUntil, tap} from "rxjs/operators";
import {emptyPolicy, EMPTY_POLICY, Policy} from "../../interfaces/policy";
import {Service} from "../../interfaces/service";
import {EMPTY_STATEMENT, Statement} from "../../interfaces/statement";
import {PolicyService} from "../../services/policy.service";

@Component({
  selector: "passport-policy-add",
  templateUrl: "./policy-add.component.html",
  styleUrls: ["./policy-add.component.scss"]
})
export class PolicyAddComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar;
  public policy: Policy = emptyPolicy();
  public nStatement: Statement = {...EMPTY_STATEMENT};
  public services: {[key: string]: Service};
  public args: any;
  private onDestroy: Subject<void> = new Subject<void>();

  _trackBy: (i) => any = i => i;

  constructor(
    private activatedRoute: ActivatedRoute,
    private policyService: PolicyService,
    private router: Router
  ) {}

  ngOnInit() {
    const createFromTemplate$ = this.activatedRoute.queryParams.pipe(
      filter(queryParams => queryParams.template),
      takeUntil(this.onDestroy),
      switchMap(queryParams => {
        const templatePolicy: Policy = (({name, description, statement}) => ({
          name,
          description,
          statement
        }))(JSON.parse(queryParams.template));
        return of(templatePolicy);
      })
    );

    const editExisted$ = this.activatedRoute.params.pipe(
      filter(params => params.id),
      takeUntil(this.onDestroy),
      switchMap(params => this.policyService.findOne(params.id))
    );

    this.policyService
      .getServices()
      .pipe(
        tap(services => {
          this.services = services
            .filter(s => !!s)
            .reduce((obj, item) => {
              obj[item.$resource] = item;
              obj[item.$resource].parsedArguments = this.parseResourceFormat(item.$arguments);
              return obj;
            }, {});
        }),
        switchMap(() => this.activatedRoute.params),
        mergeMap(params => iif(() => !params.id, createFromTemplate$, editExisted$))
      )
      .subscribe(policyData => {
        policyData.statement = this.normalizeStatement(policyData.statement);
        this.policy = {...EMPTY_POLICY, ...policyData};
      });
  }

  submitForm(): void {
    (this.policy._id
      ? this.policyService.updatePolicy(this.tidyUpStatements(this.policy))
      : this.policyService.createPolicy(this.tidyUpStatements(this.policy))
    )
      .toPromise()
      .then(() => this.router.navigate(["passport/policy"]));
  }

  addStatement(): void {
    this.policy.statement.push({
      service: undefined,
      effect: undefined,
      action: undefined,
      resource: []
    });
  }

  removeStatement(index): void {
    this.policy.statement.splice(index, 1);
  }

  addResource(statement: Statement): void {
    statement.resource.push(undefined);
  }

  removeResource(array, index): void {
    array.splice(index, 1);
  }

  recheckArgs(sName: string, index: number): void {
    this.policy.statement[index].resource = [];
    this.policy.statement[index].action = [];
    if (!this.services[sName].$arguments) {
      this.policy.statement[index].resource = null;
    }
  }

  private normalizeStatement(statementArr: Statement[]): Statement[] {
    return statementArr.map(statement => {
      statement.action = Array.isArray(statement.action) ? statement.action : [statement.action];

      if (statement.resource !== null) {
        statement.resource = Array.isArray(statement.resource)
          ? statement.resource
          : [statement.resource];
        statement.resource = statement.resource.map(resource => {
          return resource ? resource.split(statement.service + "/").pop() : "";
        });
      }

      statement.action.forEach(action => {
        const actionLastSegment = action.split(statement.service + ":").pop();
        if (actionLastSegment === "*") {
          statement.action = this.services[statement.service].actions;
        }
      });

      return statement;
    });
  }

  private tidyUpStatements(policy: Policy): Policy {
    const nStatement = policy.statement.map(statement => {
      const arrayEquality =
        Array.isArray(statement.action) &&
        statement.action.every(value => {
          return this.services[statement.service].actions.indexOf(value) >= 0;
        });

      const shrinkedAction = arrayEquality
        ? this.services[statement.service].$resource + ":*"
        : this.services[statement.service].$resource;

      let formattedResource = [];

      if (Array.isArray(statement.resource)) {
        formattedResource = statement.resource.map(resource => {
          if (resource !== "") {
            return statement.service + "/" + resource;
          }
          return resource;
        });
      }

      return {...statement, action: shrinkedAction, resource: formattedResource};
    });

    return {...policy, statement: nStatement};
  }

  private parseResourceFormat(args: string) {
    return args ? pathParse(args) : null;
  }
}

import {Component, OnInit} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {switchMap, tap, take, filter, map} from "rxjs/operators";
import {emptyPolicy, Policy} from "../../interfaces/policy";
import {Services} from "../../interfaces/service";
import {Statement} from "../../interfaces/statement";
import {PolicyService} from "../../services/policy.service";
import {merge} from "rxjs";

@Component({
  selector: "passport-policy-add",
  templateUrl: "./policy-add.component.html",
  styleUrls: ["./policy-add.component.scss"]
})
export class PolicyAddComponent implements OnInit {
  policy: Policy = emptyPolicy();
  services: Services;

  constructor(
    private activatedRoute: ActivatedRoute,
    private policyService: PolicyService,
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
        tap(policy => (this.policy = policy))
      )
      .subscribe();
  }

  onResourceSelection(statement: Statement, selection: "include" | "exclude") {
    if (selection == "include") {
      statement.resource = [];
    } else if (selection == "exclude") {
      statement.resource = {
        //put * for each params, and build resource like '*/*'
        include: this.services[statement.module][statement.action].map(_ => "*").join("/"),
        exclude: []
      };
    }
  }

  addInclude(resource: string, statement: Statement) {
    (statement.resource as string[]).push(resource);
  }

  addExclude(resource: string, statement: Statement) {
    (statement.resource as {include: string; exclude: string[]}).exclude.push(resource);
  }

  removeIncluded(resourceIndex: number, statement: Statement) {
    (statement.resource as string[]).splice(resourceIndex, 1);
  }

  removeExcluded(resourceIndex: number, statement: Statement) {
    (statement.resource as {include: string; exclude: string[]}).exclude.splice(resourceIndex, 1);
  }

  getResourceSelection(statement: Statement) {
    if (statement.resource instanceof Array) {
      return "include";
    } else if (statement.resource instanceof Object) {
      return "exclude";
    } else {
      return undefined;
    }
  }

  onActionChange(statement: Statement) {
    if (this.acceptsResource(statement)) {
      statement.resource = [];
    } else {
      delete statement.resource;
    }
  }

  acceptsResource(statement: Statement) {
    return (
      this.services[statement.module] &&
      this.services[statement.module][statement.action] &&
      this.services[statement.module][statement.action].length > 0
    );
  }

  noResourceInserted() {
    return this.policy.statement
      .map(
        statement => this.acceptsResource(statement) && (statement.resource as string[]).length == 0
      )
      .some(invalid => invalid);
  }

  savePolicy() {
    (this.policy._id
      ? this.policyService.updatePolicy(this.policy)
      : this.policyService.createPolicy(this.policy)
    )
      .toPromise()
      .then(() => this.router.navigate(["passport/policy"]));
  }

  addStatement() {
    this.policy.statement.push({
      action: undefined,
      module: undefined
    });
  }

  removeStatement(index: number) {
    this.policy.statement.splice(index, 1);
  }
}

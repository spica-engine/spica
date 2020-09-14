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

  onResourceSelection(statement: Statement, selection: "only_include" | "include_exclude") {
    if (selection == "only_include") {
      statement.resource = [];
    } else if (selection == "include_exclude") {
      statement.resource = {
        //put * for each param, and build resource like '*/*'
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
      return "only_include";
    } else if (statement.resource instanceof Object) {
      return "include_exclude";
    } else {
      return undefined;
    }
  }

  noResourceInserted() {
    return this.policy.statement
      .map(
        statement =>
          this.getResourceSelection(statement) == "only_include" &&
          (statement.resource as string[]).length == 0
      )
      .some(invalid => invalid);
  }

  savePolicy() {
    console.log(this.policy);
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
      resource: [],
      module: undefined
    });
  }

  removeStatement(index: number) {
    this.policy.statement.splice(index, 1);
  }
}

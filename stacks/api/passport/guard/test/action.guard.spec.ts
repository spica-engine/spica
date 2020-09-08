import {ActionGuard, PolicyResolver} from "@spica-server/passport/guard";
import { CanActivate, ExecutionContext } from "@nestjs/common";

describe("ActionGuard", () => {

    function createGuardAndRequest(options: {
        policies: any[], 
        actions:  string | string[],
        path: string,
        params: {[k: string]: string}
    }): {guard: () => Promise<boolean>, request: any} {
        const type = ActionGuard(options.actions);
        const resolver: PolicyResolver = async () => options.policies;
        const guard = new type(resolver);
        const request = {
            route: {
                path: options.path
            },
            params: options.params
        };
        const ctx = {
            switchToHttp: () => ({
                getRequest: () => request
            })
        } 
        return {
            guard: () => {
                return guard.canActivate(ctx as ExecutionContext) as Promise<boolean>;
            },
            request
        };
    }

   
    it("should generate excluded resources correctly", async () => {
        const {guard, request} = createGuardAndRequest({
            actions: "bucket:data:index",
            path: "/bucket/:id/data",
            params: {
                id: "test"
            },
            policies: []
        });

        const result = await guard();

        expect(result).toBe(false);
    })
})
import {
  ApikeySynchronizer,
  BucketDataSynchronizer,
  BucketSynchronizer,
  EnvironmentVariableSynchronizer,
  FunctionDependencySynchronizer,
  FunctionIndexSynchronizer,
  FunctionSynchronizer,
  PolicySynchronizer,
  ResourceGroupComparisor
} from "@spica/cli/src/commands/project/sync";

describe("Synchronize", () => {
  describe("ResourceGroupComparisor", () => {
    it("should get insert object", () => {
      const sourceObjects = [{_id: "1"}];
      const targetObjects = [];

      const decider = new ResourceGroupComparisor(sourceObjects, targetObjects);

      expect(decider.insertions()).toEqual([{_id: "1"}]);
    });

    it("should get update objects", () => {
      const sourceObjects = [{_id: "1", test: "a"}];
      const targetObjects = [{_id: "1", test: "b"}];

      const decider = new ResourceGroupComparisor(sourceObjects, targetObjects);

      expect(decider.updations()).toEqual([{_id: "1", test: "a"}]);
    });

    it("should not get any update object if they are same", () => {
      const sourceObjects = [{_id: "1", test: "a"}];
      const targetObjects = [{_id: "1", test: "a"}];

      const decider = new ResourceGroupComparisor(sourceObjects, targetObjects);

      expect(decider.updations()).toEqual([]);
    });

    it("should get delete objects", () => {
      const sourceObjects = [];
      const targetObjects = [{_id: "2"}];

      const decider = new ResourceGroupComparisor(sourceObjects, targetObjects);

      expect(decider.deletions()).toEqual([{_id: "2"}]);
    });

    it("should get all of them correctly", () => {
      const sourceObjects = [
        // insert
        {_id: "1", test: "a"},
        // update
        {_id: "2", test: "b"},
        // not update
        {_id: "3", test: "c"}
      ];

      const targetObjects = [
        // update
        {_id: "2", test: "z"},
        // not update
        {_id: "3", test: "c"},
        // delete
        {_id: "4", test: "d"}
      ];

      const decider = new ResourceGroupComparisor(sourceObjects, targetObjects);

      expect(decider.insertions()).toEqual([{_id: "1", test: "a"}]);
      expect(decider.updations()).toEqual([{_id: "2", test: "b"}]);
      expect(decider.deletions()).toEqual([{_id: "4", test: "d"}]);
    });

    it("should not get any insert, update, delete object", () => {
      const sourceObjects = [];
      const targetObjects = [];

      const decider = new ResourceGroupComparisor(sourceObjects, targetObjects);

      expect(decider.insertions()).toEqual([]);
      expect(decider.updations()).toEqual([]);
      expect(decider.deletions()).toEqual([]);
    });
  });

  describe("CoreModules", () => {
    describe("Bucket and Function", () => {
      const sourceObjects = [
        {_id: "1", prop: "dont_update_me"},
        {_id: "2", prop: "update_me"},
        {_id: "3", prop: "insert_me"}
      ];
      const targetObjects = [
        {_id: "1", prop: "dont_update_me"},
        {_id: "2", prop: "update_me_pls"},
        {_id: "4", prop: "delete_me"}
      ];
      const sourceService = {
        get: jest.fn().mockImplementation(url => {
          if (!url.includes("/")) {
            return Promise.resolve(sourceObjects);
          }
          const id = url.split("/")[1];
          return Promise.resolve(sourceObjects.find(b => b._id == id));
        }),

        put: jest.fn().mockImplementation(() => Promise.resolve()),
        post: jest.fn().mockImplementation(() => Promise.resolve()),
        delete: jest.fn().mockImplementation(() => Promise.resolve())
      };

      const targetService = {
        get: jest.fn().mockImplementation(url => {
          if (!url.includes("/")) {
            return Promise.resolve(targetObjects);
          }
          const id = url.split("/")[1];
          return Promise.resolve(targetObjects.find(b => b._id == id));
        }),

        put: jest.fn().mockImplementation(() => Promise.resolve()),
        post: jest.fn().mockImplementation(() => Promise.resolve()),
        delete: jest.fn().mockImplementation(() => Promise.resolve())
      };

      beforeEach(() => {
        sourceService.get.mockClear();
        sourceService.put.mockClear();
        sourceService.post.mockClear();
        sourceService.delete.mockClear();

        targetService.get.mockClear();
        targetService.put.mockClear();
        targetService.post.mockClear();
        targetService.delete.mockClear();
      });

      describe("BucketSynchronizer", () => {
        const synchronizer = new BucketSynchronizer(sourceService as any, targetService as any, {
          bucketIds: undefined
        });

        it("should analyze buckets", async () => {
          const {insertions, updations, deletions} = await synchronizer.analyze();
          expect(insertions).toEqual([{_id: "3", prop: "insert_me"}]);
          expect(updations).toEqual([{_id: "2", prop: "update_me"}]);
          expect(deletions).toEqual([{_id: "4", prop: "delete_me"}]);

          expect(synchronizer.insertions).toEqual([{_id: "3", prop: "insert_me"}]);
          expect(synchronizer.updations).toEqual([{_id: "2", prop: "update_me"}]);
          expect(synchronizer.deletions).toEqual([{_id: "4", prop: "delete_me"}]);

          expect(sourceService.get).toHaveBeenCalledWith("bucket");
          expect(sourceService.put).not.toHaveBeenCalled();
          expect(sourceService.post).not.toHaveBeenCalled();

          expect(targetService.get).toHaveBeenCalledWith("bucket");
          expect(targetService.put).not.toHaveBeenCalled();
          expect(targetService.post).not.toHaveBeenCalled();
        });

        it("should synchronize buckets", async () => {
          await synchronizer.analyze();
          await synchronizer.synchronize();

          expect(sourceService.put).not.toHaveBeenCalled();
          expect(sourceService.post).not.toHaveBeenCalled();
          expect(sourceService.delete).not.toHaveBeenCalled();

          expect(targetService.put).toHaveBeenCalledWith("bucket/2", {
            _id: "2",
            prop: "update_me"
          });
          expect(targetService.post).toHaveBeenCalledWith("bucket", {
            _id: "3",
            prop: "insert_me"
          });
          expect(targetService.delete).toHaveBeenCalledWith("bucket/4");
        });

        describe("with selected bucket IDs", () => {
          const synchronizer = new BucketSynchronizer(sourceService as any, targetService as any, {
            bucketIds: ["1", "2"]
          });

          it("should analyze buckets", async () => {
            const {insertions, updations, deletions} = await synchronizer.analyze();
            expect(insertions).toEqual([]);
            expect(updations).toEqual([{_id: "2", prop: "update_me"}]);
            expect(deletions).toEqual([]);

            expect(synchronizer.insertions).toEqual([]);
            expect(synchronizer.updations).toEqual([{_id: "2", prop: "update_me"}]);
            expect(synchronizer.deletions).toEqual([]);

            expect(sourceService.get).toHaveBeenCalledWith("bucket");
            expect(sourceService.put).not.toHaveBeenCalled();
            expect(sourceService.post).not.toHaveBeenCalled();

            expect(targetService.get).toHaveBeenCalledWith("bucket");
            expect(targetService.put).not.toHaveBeenCalled();
            expect(targetService.post).not.toHaveBeenCalled();
          });

          it("should synchronize buckets", async () => {
            await synchronizer.analyze();
            await synchronizer.synchronize();

            expect(sourceService.put).not.toHaveBeenCalled();
            expect(sourceService.post).not.toHaveBeenCalled();
            expect(sourceService.delete).not.toHaveBeenCalled();

            expect(targetService.put).toHaveBeenCalledWith("bucket/2", {
              _id: "2",
              prop: "update_me"
            });
            expect(targetService.post).not.toHaveBeenCalledWith();
            expect(targetService.delete).not.toHaveBeenCalledWith();
          });
        });
      });

      describe("FunctionSynchronizer", () => {

        const synchronizer = new FunctionSynchronizer(sourceService as any, targetService as any, {
          syncFnEnv: true,
          functionIds: undefined
        });

        it("should analyze function", async () => {
          const {insertions, updations, deletions} = await synchronizer.analyze();
          expect(insertions).toEqual([{_id: "3", prop: "insert_me"}]);
          expect(updations).toEqual([{_id: "2", prop: "update_me"}]);
          expect(deletions).toEqual([{_id: "4", prop: "delete_me"}]);

          expect(synchronizer.insertions).toEqual([{_id: "3", prop: "insert_me"}]);
          expect(synchronizer.updations).toEqual([{_id: "2", prop: "update_me"}]);
          expect(synchronizer.deletions).toEqual([{_id: "4", prop: "delete_me"}]);

          expect(sourceService.get).toHaveBeenCalledWith("function");
          expect(sourceService.put).not.toHaveBeenCalled();
          expect(sourceService.post).not.toHaveBeenCalled();

          expect(targetService.get).toHaveBeenCalledWith("function");
          expect(targetService.put).not.toHaveBeenCalled();
          expect(targetService.post).not.toHaveBeenCalled();
        });

        it("should synchronize functions", async () => {
          await synchronizer.analyze();
          await synchronizer.synchronize();

          expect(sourceService.put).not.toHaveBeenCalled();
          expect(sourceService.post).not.toHaveBeenCalled();
          expect(sourceService.delete).not.toHaveBeenCalled();

          expect(targetService.put).toHaveBeenCalledWith("function/2", {
            _id: "2",
            prop: "update_me"
          });
          expect(targetService.post).toHaveBeenCalledWith("function", {
            _id: "3",
            prop: "insert_me"
          });
          expect(targetService.delete).toHaveBeenCalledWith("function/4");
        });

        describe("with selected function IDs", () => {
          const synchronizer = new FunctionSynchronizer(
            sourceService as any,
            targetService as any,
            {syncFnEnv: true, functionIds: ["1", "2"]}
          );

          it("should analyze function", async () => {
            const {insertions, updations, deletions} = await synchronizer.analyze();
            expect(insertions).toEqual([]);
            expect(updations).toEqual([{_id: "2", prop: "update_me"}]);
            expect(deletions).toEqual([]);

            expect(synchronizer.insertions).toEqual([]);
            expect(synchronizer.updations).toEqual([{_id: "2", prop: "update_me"}]);
            expect(synchronizer.deletions).toEqual([]);

            expect(sourceService.get).toHaveBeenCalledWith("function");
            expect(sourceService.put).not.toHaveBeenCalled();
            expect(sourceService.post).not.toHaveBeenCalled();

            expect(targetService.get).toHaveBeenCalledWith("function");
            expect(targetService.put).not.toHaveBeenCalled();
            expect(targetService.post).not.toHaveBeenCalled();
          });

          it("should synchronize functions", async () => {
            await synchronizer.analyze();
            await synchronizer.synchronize();

            expect(sourceService.put).not.toHaveBeenCalled();
            expect(sourceService.post).not.toHaveBeenCalled();
            expect(sourceService.delete).not.toHaveBeenCalled();

            expect(targetService.put).toHaveBeenCalledWith("function/2", {
              _id: "2",
              prop: "update_me"
            });
            expect(targetService.post).not.toHaveBeenCalledWith();
            expect(targetService.delete).not.toHaveBeenCalledWith();
          });
        });
      });
    });

    describe("ApikeySynchronizer", () => {
      const moduleUrl = "passport/apikey";
      const sourceObjects = [
        {_id: "1", name: "dont_update_me", policies: []},
        {_id: "2", name: "update_me", policies: ["new_policy_id"]},
        {_id: "3", name: "insert_me", policies: ["brand_new_policy_id"]}
      ];
      const targetObjects = [
        {_id: "1", name: "dont_update_me", policies: []},
        {_id: "2", name: "update_me_pls", policies: ["old_policy_id"]},
        {_id: "4", name: "delete_me"}
      ];
      const sourceService = {
        get: jest.fn().mockImplementation(url => {
          if (url == moduleUrl) {
            return Promise.resolve({meta: {total: sourceObjects.length}, data: sourceObjects});
          }
          const id = url.split("/")[2];
          return Promise.resolve(sourceObjects.find(b => b._id == id));
        }),

        put: jest.fn().mockImplementation(() => Promise.resolve()),
        post: jest.fn().mockImplementation(() => Promise.resolve()),
        delete: jest.fn().mockImplementation(() => Promise.resolve())
      };

      const targetService = {
        get: jest.fn().mockImplementation(url => {
          if (url == moduleUrl) {
            return Promise.resolve({meta: {total: targetObjects.length}, data: targetObjects});
          }
          const id = url.split("/")[2];
          return Promise.resolve(targetObjects.find(b => b._id == id));
        }),

        put: jest.fn().mockImplementation(apikey => Promise.resolve(apikey)),
        post: jest.fn().mockImplementation(apikey => Promise.resolve(apikey)),
        delete: jest.fn().mockImplementation(() => Promise.resolve())
      };

      beforeEach(() => {
        sourceService.get.mockClear();
        sourceService.put.mockClear();
        sourceService.post.mockClear();
        sourceService.delete.mockClear();

        targetService.get.mockClear();
        targetService.put.mockClear();
        targetService.post.mockClear();
        targetService.delete.mockClear();
      });

      const synchronizer = new ApikeySynchronizer(sourceService as any, targetService as any, {
        apikeyIds: undefined
      });

      it("should analyze apikeys", async () => {
        const result = await synchronizer.analyze();

        const expecteds = {
          insertions: [{_id: "3", name: "insert_me", policies: ["brand_new_policy_id"]}],
          updations: [{_id: "2", name: "update_me", policies: ["new_policy_id"]}],
          deletions: [{_id: "4", name: "delete_me"}]
        };
        expect(result).toEqual(expecteds);

        expect(synchronizer.insertions).toEqual(expecteds.insertions);
        expect(synchronizer.updations).toEqual(expecteds.updations);
        expect(synchronizer.deletions).toEqual(expecteds.deletions);

        expect(sourceService.get).toHaveBeenCalledWith("passport/apikey");
        expect(sourceService.put).not.toHaveBeenCalled();
        expect(sourceService.post).not.toHaveBeenCalled();

        expect(targetService.get).toHaveBeenCalledWith("passport/apikey");
        expect(targetService.put).not.toHaveBeenCalled();
        expect(targetService.post).not.toHaveBeenCalled();
      });

      it("should synchronize apikeys", async () => {
        await synchronizer.analyze();
        await synchronizer.synchronize();

        expect(sourceService.put).not.toHaveBeenCalled();
        expect(sourceService.post).not.toHaveBeenCalled();
        expect(sourceService.delete).not.toHaveBeenCalled();

        expect(targetService.post).toHaveBeenCalledTimes(2);
        expect(targetService.post.mock.calls).toEqual([
          [
            "passport/apikey",
            {
              _id: "3",
              name: "insert_me"
            }
          ],
          [
            "passport/apikey",
            {
              _id: "2",
              name: "update_me"
            }
          ]
        ]);

        expect(targetService.put).toHaveBeenCalledTimes(2);
        expect(targetService.put.mock.calls).toEqual([
          ["passport/apikey/3/policy/brand_new_policy_id"],
          ["passport/apikey/2/policy/new_policy_id"]
        ]);

        expect(targetService.delete).toHaveBeenCalledTimes(2);
        expect(targetService.delete.mock.calls).toEqual([
          ["passport/apikey/2"],
          ["passport/apikey/4"]
        ]);
      });

      describe("with selected apikey IDs", () => {
        const synchronizer = new ApikeySynchronizer(sourceService as any, targetService as any, {
          apikeyIds: ["1", "2"]
        });

        it("should analyze apikeys", async () => {
          const result = await synchronizer.analyze();

          const expecteds = {
            insertions: [],
            updations: [{_id: "2", name: "update_me", policies: ["new_policy_id"]}],
            deletions: []
          };
          expect(result).toEqual(expecteds);

          expect(synchronizer.insertions).toEqual(expecteds.insertions);
          expect(synchronizer.updations).toEqual(expecteds.updations);
          expect(synchronizer.deletions).toEqual(expecteds.deletions);

          expect(sourceService.get).toHaveBeenCalledWith("passport/apikey");
          expect(sourceService.put).not.toHaveBeenCalled();
          expect(sourceService.post).not.toHaveBeenCalled();

          expect(targetService.get).toHaveBeenCalledWith("passport/apikey");
          expect(targetService.put).not.toHaveBeenCalled();
          expect(targetService.post).not.toHaveBeenCalled();
        });

        it("should synchronize apikeys", async () => {
          await synchronizer.analyze();
          await synchronizer.synchronize();

          expect(sourceService.put).not.toHaveBeenCalled();
          expect(sourceService.post).not.toHaveBeenCalled();
          expect(sourceService.delete).not.toHaveBeenCalled();

          expect(targetService.post).toHaveBeenCalledTimes(1);
          expect(targetService.post.mock.calls).toEqual([
            [
              "passport/apikey",
              {
                _id: "2",
                name: "update_me"
              }
            ]
          ]);

          expect(targetService.put).toHaveBeenCalledTimes(1);
          expect(targetService.put.mock.calls).toEqual([
            ["passport/apikey/2/policy/new_policy_id"]
          ]);

          expect(targetService.delete).toHaveBeenCalledTimes(1);
          expect(targetService.delete.mock.calls).toEqual([["passport/apikey/2"]]);
        });
      });
    });

    describe("PolicySynchronizer", () => {
      const moduleUrl = "passport/policy";
      const sourceObjects = [
        {_id: "1", name: "dont_update_me", statements: []},
        {_id: "2", name: "update_me", statements: []},
        {_id: "3", name: "insert_me", statements: []}
      ];
      const targetObjects = [
        {_id: "1", name: "dont_update_me", statements: []},
        {_id: "2", name: "update_me_pls", statements: []},
        {_id: "4", name: "delete_me"}
      ];
      const sourceService = {
        get: jest.fn().mockImplementation(url => {
          if (url == moduleUrl) {
            return Promise.resolve({meta: {total: sourceObjects.length}, data: sourceObjects});
          }
          const id = url.split("/")[2];
          return Promise.resolve(sourceObjects.find(b => b._id == id));
        }),

        put: jest.fn().mockImplementation(() => Promise.resolve()),
        post: jest.fn().mockImplementation(() => Promise.resolve()),
        delete: jest.fn().mockImplementation(() => Promise.resolve())
      };

      const targetService = {
        get: jest.fn().mockImplementation(url => {
          if (url == moduleUrl) {
            return Promise.resolve({meta: {total: targetObjects.length}, data: targetObjects});
          }
          const id = url.split("/")[2];
          return Promise.resolve(targetObjects.find(b => b._id == id));
        }),

        put: jest.fn().mockImplementation(policy => Promise.resolve(policy)),
        post: jest.fn().mockImplementation(policy => Promise.resolve(policy)),
        delete: jest.fn().mockImplementation(() => Promise.resolve())
      };

      beforeEach(() => {
        sourceService.get.mockClear();
        sourceService.put.mockClear();
        sourceService.post.mockClear();
        sourceService.delete.mockClear();

        targetService.get.mockClear();
        targetService.put.mockClear();
        targetService.post.mockClear();
        targetService.delete.mockClear();
      });

      const synchronizer = new PolicySynchronizer(sourceService as any, targetService as any, {
        policyIds: undefined
      });

      it("should analyze policies", async () => {
        const result = await synchronizer.analyze();

        const expecteds = {
          insertions: [{_id: "3", name: "insert_me", statements: []}],
          updations: [{_id: "2", name: "update_me", statements: []}],
          deletions: [{_id: "4", name: "delete_me"}]
        };
        expect(result).toEqual(expecteds);

        expect(synchronizer.insertions).toEqual(expecteds.insertions);
        expect(synchronizer.updations).toEqual(expecteds.updations);
        expect(synchronizer.deletions).toEqual(expecteds.deletions);

        expect(sourceService.get).toHaveBeenCalledWith("passport/policy");
        expect(sourceService.put).not.toHaveBeenCalled();
        expect(sourceService.post).not.toHaveBeenCalled();

        expect(targetService.get).toHaveBeenCalledWith("passport/policy");
        expect(targetService.put).not.toHaveBeenCalled();
        expect(targetService.post).not.toHaveBeenCalled();
      });

      it("should synchronize policies", async () => {
        await synchronizer.analyze();
        await synchronizer.synchronize();

        expect(sourceService.put).not.toHaveBeenCalled();
        expect(sourceService.post).not.toHaveBeenCalled();
        expect(sourceService.delete).not.toHaveBeenCalled();

        expect(targetService.put).toHaveBeenCalledWith("passport/policy/2", {
          _id: "2",
          name: "update_me",
          statements: []
        });
        expect(targetService.post).toHaveBeenCalledWith("passport/policy", {
          _id: "3",
          name: "insert_me",
          statements: []
        });
        expect(targetService.delete).toHaveBeenCalledWith("passport/policy/4");
      });

      describe("with selected policy IDs", () => {
        const synchronizer = new PolicySynchronizer(sourceService as any, targetService as any, {
          policyIds: ["1", "2"]
        });

        it("should analyze policies", async () => {
          const result = await synchronizer.analyze();

          const expecteds = {
            insertions: [],
            updations: [{_id: "2", name: "update_me", statements: []}],
            deletions: []
          };
          expect(result).toEqual(expecteds);

          expect(synchronizer.insertions).toEqual(expecteds.insertions);
          expect(synchronizer.updations).toEqual(expecteds.updations);
          expect(synchronizer.deletions).toEqual(expecteds.deletions);

          expect(sourceService.get).toHaveBeenCalledWith("passport/policy");
          expect(sourceService.put).not.toHaveBeenCalled();
          expect(sourceService.post).not.toHaveBeenCalled();

          expect(targetService.get).toHaveBeenCalledWith("passport/policy");
          expect(targetService.put).not.toHaveBeenCalled();
          expect(targetService.post).not.toHaveBeenCalled();
        });

        it("should synchronize policies", async () => {
          await synchronizer.analyze();
          await synchronizer.synchronize();

          expect(sourceService.put).not.toHaveBeenCalled();
          expect(sourceService.post).not.toHaveBeenCalled();
          expect(sourceService.delete).not.toHaveBeenCalled();

          expect(targetService.put).toHaveBeenCalledWith("passport/policy/2", {
            _id: "2",
            name: "update_me",
            statements: []
          });
          expect(targetService.post).not.toHaveBeenCalledWith();
          expect(targetService.delete).not.toHaveBeenCalledWith();
        });
      });
    });

    describe("EnvironmentVariableSynchronizer", () => {
      const sourceObjects = [
        {_id: "1", key: "dont_update_me", value: "val"},
        {_id: "2", key: "update_me", value: "val_2"},
        {_id: "3", key: "insert_me", value: "new_val"}
      ];
      const targetObjects = [
        {_id: "1", key: "dont_update_me", value: "val"},
        {_id: "2", key: "update_me", value: "updated_val_2"},
        {_id: "4", key: "delete_me", value: "val"}
      ];

      const sourceService = {
        get: jest.fn().mockImplementation(url => {
          if (!url.includes("/")) {
            return Promise.resolve(sourceObjects);
          }
          const id = url.split("/")[1];
          return Promise.resolve(sourceObjects.find(b => b._id == id));
        }),

        put: jest.fn().mockImplementation(() => Promise.resolve()),
        post: jest.fn().mockImplementation(() => Promise.resolve()),
        delete: jest.fn().mockImplementation(() => Promise.resolve())
      };

      const targetService = {
        get: jest.fn().mockImplementation(url => {
          if (!url.includes("/")) {
            return Promise.resolve(targetObjects);
          }
          const id = url.split("/")[1];
          return Promise.resolve(targetObjects.find(b => b._id == id));
        }),

        put: jest.fn().mockImplementation(() => Promise.resolve()),
        post: jest.fn().mockImplementation(() => Promise.resolve()),
        delete: jest.fn().mockImplementation(() => Promise.resolve())
      };

      beforeEach(() => {
        sourceService.get.mockClear();
        sourceService.put.mockClear();
        sourceService.post.mockClear();
        sourceService.delete.mockClear();

        targetService.get.mockClear();
        targetService.put.mockClear();
        targetService.post.mockClear();
        targetService.delete.mockClear();
      });

      const synchronizer = new EnvironmentVariableSynchronizer(
        sourceService as any,
        targetService as any,
        {
          envVarIds: undefined
        }
      );

      it("should analyze env vars", async () => {
        const {insertions, updations, deletions} = await synchronizer.analyze();
        expect(insertions).toEqual([{_id: "3", key: "insert_me", value: "new_val"}]);
        expect(updations).toEqual([{_id: "2", key: "update_me", value: "val_2"}]);
        expect(deletions).toEqual([{_id: "4", key: "delete_me", value: "val"}]);

        expect(synchronizer.insertions).toEqual([{_id: "3", key: "insert_me", value: "new_val"}]);
        expect(synchronizer.updations).toEqual([{_id: "2", key: "update_me", value: "val_2"}]);
        expect(synchronizer.deletions).toEqual([{_id: "4", key: "delete_me", value: "val"}]);

        expect(sourceService.get).toHaveBeenCalledWith("env-var");
        expect(sourceService.put).not.toHaveBeenCalled();
        expect(sourceService.post).not.toHaveBeenCalled();

        expect(targetService.get).toHaveBeenCalledWith("env-var");
        expect(targetService.put).not.toHaveBeenCalled();
        expect(targetService.post).not.toHaveBeenCalled();
      });

      it("should synchronize env vars", async () => {
        await synchronizer.analyze();
        await synchronizer.synchronize();

        expect(sourceService.put).not.toHaveBeenCalled();
        expect(sourceService.post).not.toHaveBeenCalled();
        expect(sourceService.delete).not.toHaveBeenCalled();

        expect(targetService.put).toHaveBeenCalledWith("env-var/2", {
          _id: "2",
          key: "update_me",
          value: "val_2"
        });
        expect(targetService.post).toHaveBeenCalledWith("env-var", {
          _id: "3",
          key: "insert_me",
          value: "new_val"
        });
        expect(targetService.delete).toHaveBeenCalledWith("env-var/4");
      });

      describe("with selected env vars IDs", () => {
        const synchronizer = new EnvironmentVariableSynchronizer(
          sourceService as any,
          targetService as any,
          {
            envVarIds: ["1", "2"]
          }
        );

        it("should analyze env vars", async () => {
          const {insertions, updations, deletions} = await synchronizer.analyze();
          expect(insertions).toEqual([]);
          expect(updations).toEqual([{_id: "2", key: "update_me", value: "val_2"}]);
          expect(deletions).toEqual([]);

          expect(synchronizer.insertions).toEqual([]);
          expect(synchronizer.updations).toEqual([{_id: "2", key: "update_me", value: "val_2"}]);
          expect(synchronizer.deletions).toEqual([]);

          expect(sourceService.get).toHaveBeenCalledWith("env-var");
          expect(sourceService.put).not.toHaveBeenCalled();
          expect(sourceService.post).not.toHaveBeenCalled();

          expect(targetService.get).toHaveBeenCalledWith("env-var");
          expect(targetService.put).not.toHaveBeenCalled();
          expect(targetService.post).not.toHaveBeenCalled();
        });

        it("should synchronize env vars", async () => {
          await synchronizer.analyze();
          await synchronizer.synchronize();

          expect(sourceService.put).not.toHaveBeenCalled();
          expect(sourceService.post).not.toHaveBeenCalled();
          expect(sourceService.delete).not.toHaveBeenCalled();

          expect(targetService.put).toHaveBeenCalledWith("env-var/2", {
            _id: "2",
            key: "update_me",
            value: "val_2"
          });
          expect(targetService.post).not.toHaveBeenCalledWith();
          expect(targetService.delete).not.toHaveBeenCalledWith();
        });
      });
    });
  });

  describe("SubModules", () => {
    describe("FunctionDependecy", () => {
      const sourceObjects = [
        {name: "database", version: "^1"},
        {name: "bucket", version: "^2"},
        {name: "storage", version: "^1"}
      ];
      const targetObjects = [
        {name: "database", version: "^1"},
        {name: "bucket", version: "^1.1"},
        {name: "identity", version: "^1"}
      ];

      const sourceService = {
        get: jest.fn().mockImplementation(() => {
          return Promise.resolve(sourceObjects);
        }),
        post: jest.fn().mockImplementation(() => Promise.resolve()),
        delete: jest.fn().mockImplementation(() => Promise.resolve())
      };

      const targetService = {
        get: jest.fn().mockImplementation(() => {
          return Promise.resolve(targetObjects);
        }),
        post: jest.fn().mockImplementation(() => Promise.resolve()),
        delete: jest.fn().mockImplementation(() => Promise.resolve())
      };

      const synchronizer = new FunctionDependencySynchronizer(
        sourceService as any,
        targetService as any,
        {_id: "1", name: "fn1"}
      );

      beforeEach(() => {
        sourceService.get.mockClear();
        sourceService.post.mockClear();
        sourceService.delete.mockClear();

        targetService.get.mockClear();
        targetService.post.mockClear();
        targetService.delete.mockClear();
      });

      it("should analyze dependencies", async () => {
        const {insertions, updations, deletions} = await synchronizer.analyze();

        expect(insertions).toEqual([{name: "storage", version: "^1"}]);
        expect(updations).toEqual([{name: "bucket", version: "^2"}]);
        expect(deletions).toEqual([{name: "identity", version: "^1"}]);

        expect(synchronizer.insertions).toEqual([{name: "storage", version: "^1"}]);
        expect(synchronizer.updations).toEqual([{name: "bucket", version: "^2"}]);
        expect(synchronizer.deletions).toEqual([{name: "identity", version: "^1"}]);

        expect(sourceService.get).toHaveBeenCalledWith("function/1/dependencies");
        expect(sourceService.post).not.toHaveBeenCalled();
        expect(sourceService.delete).not.toHaveBeenCalled();

        expect(targetService.get).toHaveBeenCalledWith("function/1/dependencies");
        expect(sourceService.post).not.toHaveBeenCalled();
        expect(targetService.post).not.toHaveBeenCalled();
      });

      it("should synchronize dependencies", async () => {
        await synchronizer.analyze();
        await synchronizer.synchronize();

        expect(sourceService.post).not.toHaveBeenCalled();
        expect(sourceService.delete).not.toHaveBeenCalled();

        // there is no put endpoint for dependencies
        expect(targetService.post).toHaveBeenCalledWith("function/1/dependencies", {
          name: ["storage@1", "bucket@2"]
        });
        expect(targetService.delete).toHaveBeenCalledWith("function/1/dependencies/identity");
      });
    });
    describe("FunctionIndex", () => {
      const sourceFns = [
        {_id: "1", name: "fn1"},
        {_id: "2", name: "fn2"},
        {_id: "3", name: "fn3"}
      ];
      const sourceObjects = [
        {
          _id: "1",
          index: "console.log(1)"
        },
        {
          _id: "2",
          index: "console.log('update')"
        },
        {
          _id: "3",
          index: "console.log(3)"
        }
      ];

      const targetObjects = [
        {
          _id: "1",
          index: "console.log(1)"
        },
        {
          _id: "2",
          index: "console.log(2)"
        }
      ];

      const sourceService = {
        get: jest.fn().mockImplementation(url => {
          if (url == "function") {
            return Promise.resolve(sourceFns);
          }
          const id = url.split("/")[1];
          const fn = sourceObjects.filter(f => f._id == id);
          if (!fn.length) {
            return Promise.reject({statusCode: 404});
          }
          return Promise.resolve(fn[0]);
        }),
        post: jest.fn().mockImplementation(() => Promise.resolve()),
        delete: jest.fn().mockImplementation(() => Promise.resolve())
      };

      const targetService = {
        get: jest.fn().mockImplementation(url => {
          const id = url.split("/")[1];
          const fn = targetObjects.filter(f => f._id == id);
          if (!fn.length) {
            return Promise.reject({statusCode: 404});
          }
          return Promise.resolve(fn[0]);
        }),
        post: jest.fn().mockImplementation(() => Promise.resolve()),
        delete: jest.fn().mockImplementation(() => Promise.resolve())
      };

      const synchronizer = new FunctionIndexSynchronizer(
        sourceService as any,
        targetService as any
      );

      beforeEach(() => {
        sourceService.get.mockClear();
        sourceService.post.mockClear();
        sourceService.delete.mockClear();

        targetService.get.mockClear();
        targetService.post.mockClear();
        targetService.delete.mockClear();
      });

      it("should analyze indexes", async () => {
        const {insertions, updations, deletions} = await synchronizer.analyze();

        const expectedinsertions = [
          {
            _id: "3",
            name: "fn3",
            index: "console.log(3)"
          }
        ];

        const expectedupdations = [
          {
            _id: "2",
            name: "fn2",
            index: "console.log('update')"
          }
        ];

        expect(insertions).toEqual(expectedinsertions);
        expect(updations).toEqual(expectedupdations);
        expect(deletions).toEqual([]);

        expect(synchronizer.insertions).toEqual(expectedinsertions);
        expect(synchronizer.updations).toEqual(expectedupdations);
        expect(synchronizer.deletions).toEqual([]);

        expect(sourceService.get).toHaveBeenCalledTimes(4);
        expect(sourceService.get.mock.calls).toEqual([
          ["function"],
          ["function/1/index"],
          ["function/2/index"],
          ["function/3/index"]
        ]);
        expect(sourceService.post).not.toHaveBeenCalled();
        expect(sourceService.delete).not.toHaveBeenCalled();

        expect(targetService.get).toHaveBeenCalledTimes(3);
        expect(targetService.get.mock.calls).toEqual([
          ["function/1/index"],
          ["function/2/index"],
          ["function/3/index"]
        ]);
        expect(targetService.post).not.toHaveBeenCalled();
        expect(targetService.delete).not.toHaveBeenCalled();
      });

      it("should synchronize indexes", async () => {
        await synchronizer.analyze();
        await synchronizer.synchronize();

        expect(sourceService.post).not.toHaveBeenCalled();
        expect(sourceService.delete).not.toHaveBeenCalled();

        expect(targetService.post.mock.calls).toEqual([
          [
            "function/3/index",
            {
              index: "console.log(3)"
            }
          ],
          [
            "function/2/index",
            {
              index: "console.log('update')"
            }
          ]
        ]);

        expect(targetService.delete).not.toHaveBeenCalled();
      });
    });

    describe("Bucket Data", () => {
      const sourceObjects = [
        // put
        {_id: "dataid2", title: "updated_title2", description: "updated_description2"},
        // no-op
        {_id: "dataid3", title: "title3", description: "description3"},
        // post
        {_id: "dataid4", title: "added_title4", description: "added_description4"}
      ];
      const targetObjects = [
        // delete
        {_id: "dataid1", title: "title1", description: "description1"},
        {_id: "dataid2", title: "title2", description: "description2"},
        {_id: "dataid3", title: "title3", description: "description3"}
      ];

      const sourceService = {
        get: jest.fn().mockImplementation(() => {
          return Promise.resolve(sourceObjects);
        }),
        post: jest.fn().mockImplementation(() => Promise.resolve()),
        put: jest.fn().mockImplementation(() => Promise.resolve()),
        delete: jest.fn().mockImplementation(() => Promise.resolve())
      };

      const targetService = {
        get: jest.fn().mockImplementation(() => {
          return Promise.resolve(targetObjects);
        }),
        post: jest.fn().mockImplementation(() => Promise.resolve()),
        put: jest.fn().mockImplementation(() => Promise.resolve()),
        delete: jest.fn().mockImplementation(() => Promise.resolve())
      };

      const synchronizer = new BucketDataSynchronizer(sourceService as any, targetService as any, {
        _id: "bucket_id",
        title: "title1",
        primary: "title"
      });

      beforeEach(() => {
        sourceService.get.mockClear();
        sourceService.put.mockClear();
        sourceService.post.mockClear();
        sourceService.delete.mockClear();

        targetService.get.mockClear();
        targetService.put.mockClear();
        targetService.post.mockClear();
        targetService.delete.mockClear();
      });

      it("should analyze bucket-data", async () => {
        const {insertions, updations, deletions} = await synchronizer.analyze();

        const expectations = {
          insertions: [{_id: "dataid4", title: "added_title4", description: "added_description4"}],
          updations: [
            {_id: "dataid2", title: "updated_title2", description: "updated_description2"}
          ],
          deletions: [{_id: "dataid1", title: "title1", description: "description1"}]
        };

        expect(insertions).toEqual(expectations.insertions);
        expect(updations).toEqual(expectations.updations);
        expect(deletions).toEqual(expectations.deletions);

        expect(synchronizer.insertions).toEqual(expectations.insertions);
        expect(synchronizer.updations).toEqual(expectations.updations);
        expect(synchronizer.deletions).toEqual(expectations.deletions);

        expect(sourceService.get).toHaveBeenCalledWith("bucket/bucket_id/data", {
          params: {localize: false}
        });
        expect(sourceService.post).not.toHaveBeenCalled();
        expect(sourceService.put).not.toHaveBeenCalled();
        expect(sourceService.delete).not.toHaveBeenCalled();

        expect(targetService.get).toHaveBeenCalledWith("bucket/bucket_id/data", {
          params: {localize: false}
        });
        expect(sourceService.post).not.toHaveBeenCalled();
        expect(sourceService.put).not.toHaveBeenCalled();
        expect(sourceService.delete).not.toHaveBeenCalled();
      });

      it("should synchronize bucket-data", async () => {
        await synchronizer.analyze();
        await synchronizer.synchronize();

        expect(sourceService.post).not.toHaveBeenCalled();
        expect(sourceService.put).not.toHaveBeenCalled();
        expect(sourceService.delete).not.toHaveBeenCalled();

        expect(targetService.post).toHaveBeenCalledWith("bucket/bucket_id/data", {
          _id: "dataid4",
          title: "added_title4",
          description: "added_description4"
        });
        expect(targetService.put).toHaveBeenCalledWith("bucket/bucket_id/data/dataid2", {
          _id: "dataid2",
          title: "updated_title2",
          description: "updated_description2"
        });

        expect(targetService.delete).toHaveBeenCalledWith("bucket/bucket_id/data/dataid1");
      });
    });
  });
});

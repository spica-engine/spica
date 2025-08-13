import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {StorageService} from "@spica-server/storage";
import {Default} from "@spica-server/storage/src/strategy/default";
import {Strategy} from "@spica-server/storage/src/strategy/strategy";
import {StorageObject, STORAGE_OPTIONS} from "@spica-server/interface/storage";

describe("Storage Service", () => {
  let module: TestingModule;

  let storageService: StorageService;
  let storageObject: StorageObject<Buffer>;
  let strategyInstance: Strategy;
  let storageObjectId: ObjectId = new ObjectId("56cb91bdc3464f14678934ca");

  const resourceFilter = {$match: {}};

  beforeEach(async () => {
    storageObject = {
      _id: storageObjectId,
      name: "name",
      url: "url",
      content: {
        data: Buffer.from("abc"),
        type: "type",
        size: 10
      }
    };
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.standalone()],
      providers: [
        StorageService,
        {
          provide: Strategy,
          useValue: new Default(process.env.TEST_TMPDIR, "http://insteadof", 0)
        },
        {
          provide: STORAGE_OPTIONS,
          useValue: {totalSizeLimit: 10}
        }
      ]
    }).compile();
    storageService = module.get(StorageService);
    strategyInstance = module.get(Strategy);
  });

  afterEach(() => {
    storageService.deleteMany({});
    module.close();
  });

  it("should add storage objects", async () => {
    await expect(
      storageService.insert(
        Array.from(new Array(3), (val, index) => ({
          name: "name" + index,
          content: {
            data: Buffer.from("123"),
            type: index.toString()
          }
        }))
      )
    ).resolves.not.toThrow();

    return await expect(
      storageService.getAll(resourceFilter, undefined, true, 30, 0, {_id: -1}).then(result => {
        Array.from(result.data).forEach((val, index) => {
          expect(val.name).toBe("name" + (result.data.length - 1 - index));
          expect(val.content["data"]).toBe(undefined);
          expect(val.content.type).toBe((result.data.length - 1 - index).toString());
        });
        return result;
      })
    );
  });

  it("should not insert storage object with an already existing name", async () => {
    await storageService
      .insert([
        {
          name: "my_obj",
          content: {
            data: Buffer.from("123"),
            type: "0"
          }
        },
        {
          name: "my_obj",
          content: {
            data: Buffer.from("1234"),
            type: "1"
          }
        }
      ])
      .catch(error => {
        expect(error.response.statusCode).toBe(400);
        expect(error.response.message).toBe("An object with this name already exists.");
      });
  });

  it("should revert storage insert if one of objects failed", async () => {
    const storageObjects = [
      {
        _id: "successId",
        name: "name1",
        content: {
          data: Buffer.from("abc1"),
          type: "type1",
          size: 10
        }
      },
      {
        _id: "failId",
        name: "name2",
        content: {
          data: Buffer.from("abc2"),
          type: "type2",
          size: 20
        }
      },
      {
        _id: "thirdId",
        name: "name3",
        content: {
          data: Buffer.from("abc3"),
          type: "type3",
          size: 30
        }
      }
    ];

    const originalWrite = strategyInstance.write.bind(strategyInstance);
    jest.spyOn(strategyInstance, "write").mockImplementation((id: string, data: Buffer) => {
      if (id === "name2") {
        return Promise.reject("Upload failed for Item");
      }
      return originalWrite(id, data);
    });

    await expect(storageService.insert(storageObjects)).rejects.toThrow(
      "Error: Failed to write object name2 to storage. Reason: Upload failed for Item"
    );

    const insertedObjects = await storageService.find();
    expect(insertedObjects).toEqual([]);

    const objectPromises = storageObjects.map(storageObject =>
      strategyInstance.read(storageObject._id).catch(e => e.code)
    );
    const result = await Promise.all(objectPromises);
    expect(result).toEqual(["ENOENT", "ENOENT", "ENOENT"]);
  });

  it("should update storage object", async () => {
    await expect(storageService.insert([storageObject])).resolves.not.toThrow();

    const updatedData = {
      _id: storageObjectId,
      name: "new name",
      url: "new_url",
      content: {
        data: Buffer.from("cba"),
        type: "newtype",
        size: 10
      }
    };
    await expect(storageService.update(storageObjectId, updatedData)).resolves.not.toThrow();

    return await expect(
      storageService.get(storageObjectId).then(result => {
        expect(result).toEqual({
          _id: storageObjectId,
          name: "new name",
          url: "new_url",
          content: {
            data: Buffer.from("cba"),
            type: "newtype",
            size: 10
          }
        });
        return result;
      })
    ).resolves.not.toThrow();
  });

  it("should delete single storage object", async () => {
    await expect(storageService.insert([storageObject])).resolves.not.toThrow();
    await expect(storageService.delete(storageObjectId)).resolves.not.toThrow();
    return await expect(storageService.get(storageObjectId)).resolves.toBeNull();
  });

  describe("filter", () => {
    beforeEach(async () => {
      const storageObjects = [
        {
          name: "object1",
          content: {data: Buffer.from(""), type: "type1"}
        },
        {
          name: "object2",
          content: {data: Buffer.from(""), type: "type2"}
        }
      ];
      await storageService.insertMany(storageObjects);
    });

    it("should filter by name", async () => {
      const res = await storageService.getAll(resourceFilter, {name: "object1"}, false, 0, 0, {});
      expect(res.map(r => r.name)).toEqual(["object1"]);
    });

    it("should filter by content type", async () => {
      const res = await storageService.getAll(
        resourceFilter,
        {"content.type": "type1"},
        false,
        0,
        0,
        {}
      );
      expect(res.map(r => r.content.type)).toEqual(["type1"]);
    });
  });

  it("should filter, limit skip and sort and not paginate ", async () => {
    const storageObjects = [
      {
        name: "object1",
        content: {data: Buffer.from(""), type: "type1"}
      },
      {
        name: "object2",
        content: {data: Buffer.from(""), type: "type2"}
      },
      {
        name: "object3",
        content: {data: Buffer.from(""), type: "type3"}
      },
      {
        name: "won't_pass_filter",
        content: {data: Buffer.from(""), type: "type4"}
      }
    ];
    await storageService.insertMany(storageObjects);
    const res = await storageService.getAll(
      resourceFilter,
      {name: {$regex: "^object"}},
      false,
      2,
      1,
      {
        name: -1
      }
    );
    expect(res.map(r => r.name)).toEqual(["object2", "object1"]);
  });

  describe("sorts", () => {
    let storageObjects: StorageObject<Buffer>[];
    beforeEach(async () => {
      storageObjects = Array.from(new Array(3), (val, index) => ({
        name: "name" + (2 - index),
        content: {
          data: Buffer.from(""),
          type: ""
        }
      }));
      await storageService.insertMany(storageObjects);
    });

    it("should sort storage objects descend by name", async () => {
      return await expect(
        storageService.getAll(resourceFilter, undefined, true, 3, 0, {name: -1}).then(result => {
          expect(result.data[0].name).toBe("name2");
          expect(result.data[1].name).toBe("name1");
          expect(result.data[2].name).toBe("name0");
          return result;
        })
      ).resolves.not.toThrow();
    });

    it("should sort storage objects ascend by name", async () => {
      return await expect(
        storageService.getAll(resourceFilter, undefined, true, 3, 0, {name: 1}).then(result => {
          expect(result.data[0].name).toBe("name0");
          expect(result.data[1].name).toBe("name1");
          expect(result.data[2].name).toBe("name2");
          return result;
        })
      ).resolves.not.toThrow();
    });

    it("should sort storage objects descend by date", async () => {
      return await expect(
        storageService.getAll(resourceFilter, undefined, true, 3, 0, {_id: -1}).then(result => {
          expect(result.data[0].name).toBe("name0");
          expect(result.data[1].name).toBe("name1");
          expect(result.data[2].name).toBe("name2");
          return result;
        })
      ).resolves.not.toThrow();
    });

    it("should sort storage objects ascend by date", async () => {
      return await expect(
        storageService.getAll(resourceFilter, undefined, true, 3, 0, {_id: 1}).then(result => {
          expect(result.data[0].name).toBe("name2");
          expect(result.data[1].name).toBe("name1");
          expect(result.data[2].name).toBe("name0");
          return result;
        })
      ).resolves.not.toThrow();
    });
  });

  describe("storage size limit", () => {
    const MB = Math.pow(10, 6); // 1mb = 10^6 byte
    let storageObjects = [];

    it("should skip validation if total size limit was not provided", async () => {
      module = await Test.createTestingModule({
        imports: [DatabaseTestingModule.standalone()],
        providers: [
          StorageService,
          {
            provide: Strategy,
            useValue: new Default(process.env.TEST_TMPDIR, "http://insteadof", 0)
          },
          {
            provide: STORAGE_OPTIONS,
            useValue: {}
          }
        ]
      }).compile();
      storageService = module.get(StorageService);

      const [insertedObj] = await storageService.insert([
        {
          _id: new ObjectId(),
          name: "name",
          url: "url",
          content: {
            data: Buffer.from(""),
            type: "text/plain",
            size: 100 * MB
          }
        }
      ]);

      expect(insertedObj.content.size).toEqual(100 * MB);
    });

    beforeEach(async () => {
      storageObjects = [
        {
          _id: new ObjectId(),
          name: "name",
          url: "url",
          content: {
            data: Buffer.from(""),
            type: "text/plain",
            size: 4.5 * MB
          }
        },
        {
          _id: new ObjectId(),
          name: "name2",
          url: "url2",
          content: {
            data: Buffer.from(""),
            type: "text/plain",
            size: 4.5 * MB
          }
        }
      ];
      await storageService.insertMany(storageObjects);
    });

    describe("insert", () => {
      it("should insert if it won't exceed the limit", async () => {
        const storageObject = {
          _id: new ObjectId(),
          name: "name3",
          url: "url",
          content: {
            data: Buffer.from(""),
            type: "text/plain",
            size: 1 * MB
          }
        };

        const [insertedObj] = await storageService.insert([storageObject]);
        expect(insertedObj._id).toEqual(storageObject._id);
      });

      it("should not insert if it exceed the limit", async () => {
        const storageObject = {
          _id: new ObjectId(),
          name: "name3",
          url: "url",
          content: {
            data: Buffer.from(""),
            type: "text/plain",
            size: 1.1 * MB
          }
        };

        await storageService.insertMany([storageObject]).catch(e => {
          expect(e).toEqual(new Error("Total storage object size limit exceeded"));
        });
      });
    });

    describe("update", () => {
      it("should update if it won't exceed the limit", async () => {
        storageObjects[0].content.size = 5.5 * MB;

        const updatedObj = await storageService.update(storageObjects[0]._id, storageObjects[0]);
        expect(updatedObj.content.size).toEqual(5.5 * MB);
      });

      it("should not update if it exceed the limit", async () => {
        storageObjects[0].content.size = 5.6 * MB;

        await storageService.update(storageObjects[0]._id, storageObjects[0]).catch(e => {
          expect(e).toEqual(new Error("Total storage object size limit exceeded"));
        });
      });
    });

    describe("browse", () => {
      beforeEach(async () => {
        await storageService.deleteMany({});

        jest.spyOn(strategyInstance, "write").mockResolvedValue(undefined);
        jest.spyOn(strategyInstance, "writeStream").mockResolvedValue(undefined);

        const testFiles = [
          // Root level files
          {name: "root-file1.txt", content: {data: Buffer.from("root1"), type: "text/plain"}},
          {name: "root-file2.txt", content: {data: Buffer.from("root2"), type: "text/plain"}},

          // Root level folders
          {
            name: "photos/",
            content: {data: Buffer.from(""), type: "application/octet-stream", size: 0}
          },
          {
            name: "documents/",
            content: {data: Buffer.from(""), type: "application/octet-stream", size: 0}
          },

          // Photos directory structure
          {
            name: "photos/vacation1.jpg",
            content: {data: Buffer.from("photo1"), type: "image/jpeg"}
          },
          {
            name: "photos/vacation2.jpg",
            content: {data: Buffer.from("photo2"), type: "image/jpeg"}
          },
          {name: "photos/family.jpg", content: {data: Buffer.from("family"), type: "image/jpeg"}},

          // Photos subdirectories (as folder files)
          {
            name: "photos/dogs/",
            content: {data: Buffer.from(""), type: "application/octet-stream", size: 0}
          },
          {
            name: "photos/cats/",
            content: {data: Buffer.from(""), type: "application/octet-stream", size: 0}
          },

          // Photos subdirectory files
          {name: "photos/dogs/buddy.jpg", content: {data: Buffer.from("dog1"), type: "image/jpeg"}},
          {name: "photos/dogs/max.jpg", content: {data: Buffer.from("dog2"), type: "image/jpeg"}},
          {
            name: "photos/cats/whiskers.jpg",
            content: {data: Buffer.from("cat1"), type: "image/jpeg"}
          },

          // Nested deeper folder
          {
            name: "photos/dogs/puppies/",
            content: {data: Buffer.from(""), type: "application/octet-stream", size: 0}
          },

          // Nested deeper file
          {
            name: "photos/dogs/puppies/small.jpg",
            content: {data: Buffer.from("puppy"), type: "image/jpeg"}
          },

          // Documents directory files
          {
            name: "documents/report.pdf",
            content: {data: Buffer.from("report"), type: "application/pdf"}
          },
          {name: "documents/draft.txt", content: {data: Buffer.from("draft"), type: "text/plain"}},

          // Documents subdirectory (as folder file)
          {
            name: "documents/work/",
            content: {data: Buffer.from(""), type: "application/octet-stream", size: 0}
          },

          // Documents subdirectory files
          {
            name: "documents/work/project.docx",
            content: {
              data: Buffer.from("project"),
              type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            }
          }
        ];

        await storageService.insertMany(testFiles);
      });

      describe("browse filter", () => {
        it("should work with wildcard * to match root files", async () => {
          const wildcardResourceFilter = {include: ["*"], exclude: []};

          const result = await storageService.browse(wildcardResourceFilter, "", {}, 20, 0, {
            name: 1
          });
          const names = result.map(r => r.name).sort();
          expect(names).toEqual(["documents/", "photos/", "root-file1.txt", "root-file2.txt"]);
        });

        it("should work with ** to match all files (including nested)", async () => {
          const allFilesResourceFilter = {include: ["**"], exclude: []};

          const result = await storageService.browse(allFilesResourceFilter, "", {}, 20, 0, {
            name: 1
          });
          const names = result.map(r => r.name).sort();
          expect(names).toEqual(["documents/", "photos/", "root-file1.txt", "root-file2.txt"]);
        });

        it("should work with include pattern using /* (single level)", async () => {
          const photosOnlyResourceFilter = {include: ["photos/*"], exclude: []};

          const result = await storageService.browse(photosOnlyResourceFilter, "photos", {}, 10, 0);
          const names = result.map(r => r.name).sort();
          expect(names).toEqual([
            "photos/cats/",
            "photos/dogs/",
            "photos/family.jpg",
            "photos/vacation1.jpg",
            "photos/vacation2.jpg"
          ]);
        });

        it("should work with include pattern using /** (all nested levels)", async () => {
          const photosAllResourceFilter = {include: ["photos/**"], exclude: []};

          const result = await storageService.browse(photosAllResourceFilter, "photos", {}, 20, 0);
          const names = result.map(r => r.name).sort();
          expect(names).toEqual([
            "photos/cats/",
            "photos/dogs/",
            "photos/family.jpg",
            "photos/vacation1.jpg",
            "photos/vacation2.jpg"
          ]);
        });

        it("shouldn't get docs from documents since policy is restrictive", async () => {
          const documentsOnlyResourceFilter = {include: ["*"], exclude: []};
          const result = await storageService.browse(
            documentsOnlyResourceFilter,
            "documents",
            {},
            10,
            0,
            {name: 1}
          );
          const names = result.map(r => r.name);
          expect(names).toEqual([]);
        });

        it("should respect path-based directory browsing", async () => {
          const allowAllResourceFilter = {include: ["**"], exclude: []};

          const documentsResult = await storageService.browse(
            allowAllResourceFilter,
            "documents",
            {},
            10,
            0
          );
          const documentsNames = documentsResult.map(r => r.name).sort();
          expect(documentsNames).toEqual([
            "documents/draft.txt",
            "documents/report.pdf",
            "documents/work/"
          ]);

          const workResult = await storageService.browse(
            allowAllResourceFilter,
            "documents/work",
            {},
            10,
            0
          );
          const workNames = workResult.map(r => r.name);
          expect(workNames).toEqual(["documents/work/project.docx"]);
        });

        it("should work with exact file matching", async () => {
          const exactFileResourceFilter = {include: ["photos/family.jpg"], exclude: []};

          const result = await storageService.browse(exactFileResourceFilter, "", {}, 10, 0);
          const names = result.map(r => r.name);
          expect(names).toEqual(["photos/"]);

          const photosResult = await storageService.browse(
            exactFileResourceFilter,
            "photos",
            {},
            10,
            0
          );
          const photosNames = photosResult.map(r => r.name);
          expect(photosNames).toEqual(["photos/family.jpg"]);
        });
      });

      describe("user filter", () => {
        it("should apply policies and also filter by content type", async () => {
          const photosResourceFilter = {include: ["photos/*"], exclude: []};

          const contentResult = await storageService.browse(
            photosResourceFilter,
            "photos",
            {"content.type": "image/jpeg"},
            10,
            0
          );
          expect(contentResult.map(r => r.name).sort()).toEqual([
            "photos/family.jpg",
            "photos/vacation1.jpg",
            "photos/vacation2.jpg"
          ]);
        });

        it("should apply policies and also filter by name regex", async () => {
          const photosResourceFilter = {include: ["photos/*"], exclude: []};

          const nameResult = await storageService.browse(
            photosResourceFilter,
            "photos",
            {name: {$regex: "vacation"}},
            10,
            0
          );
          expect(nameResult.map(r => r.name).sort()).toEqual([
            "photos/vacation1.jpg",
            "photos/vacation2.jpg"
          ]);
        });
      });

      describe("limit, skip and sort", () => {
        it("should apply limit", async () => {
          const photosResourceFilter = {include: ["photos/*"], exclude: []};

          const limitResult = await storageService.browse(photosResourceFilter, "photos", {}, 0, 0);
          console.log(limitResult);
          expect(limitResult.map(r => r.name)).toEqual([
            "photos/vacation1.jpg",
            "photos/vacation2.jpg"
          ]);
        });

        it("should apply skip", async () => {
          const rootResourceFilter = {include: ["*"], exclude: []};

          const skipResult = await storageService.browse(rootResourceFilter, "", {}, 0, 1);
          expect(skipResult.map(r => r.name)).toEqual(["root-file2.txt", "photos/", "documents/"]);
        });

        it("should apply sorting", async () => {
          const photosResourceFilter = {include: ["photos/*"], exclude: []};

          const resultAsc = await storageService.browse(photosResourceFilter, "photos", {}, 10, 0, {
            name: 1
          });
          expect(resultAsc.map(r => r.name)).toEqual([
            "photos/cats/",
            "photos/dogs/",
            "photos/family.jpg",
            "photos/vacation1.jpg",
            "photos/vacation2.jpg"
          ]);

          const resultDesc = await storageService.browse(
            photosResourceFilter,
            "photos",
            {},
            10,
            0,
            {
              name: -1
            }
          );
          expect(resultDesc.map(r => r.name)).toEqual([
            "photos/vacation2.jpg",
            "photos/vacation1.jpg",
            "photos/family.jpg",
            "photos/dogs/",
            "photos/cats/"
          ]);
        });

        it("should apply limit, skip and sort together", async () => {
          const photosResourceFilter = {include: ["photos/*"], exclude: []};

          const result = await storageService.browse(photosResourceFilter, "photos", {}, 2, 1, {
            name: -1
          });
          expect(result.map(r => r.name)).toEqual(["photos/vacation1.jpg", "photos/family.jpg"]);
        });
      });
    });
  });
});

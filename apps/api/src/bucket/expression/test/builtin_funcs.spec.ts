import {
  validateArgumentsLength,
  validateArgumentsOrder,
  LiteralValidation,
  PropertyAccesChainValidation,
  ArrayValidation,
  createInQuery,
  has,
  unixTime,
  now,
  some,
  every,
  equal,
  regex,
  length
} from "../src/builtin_funcs";
import {parser} from "../src/parser";
import {wrapExpressionByMode} from "../src/convert";

jest.useFakeTimers();

describe("macros", () => {
  describe("validation", () => {
    const fnName = "macro";

    it("should throw error about arguments exact length", () => {
      const args = [];
      const exactLength = 1;

      expect(() => validateArgumentsLength(fnName, args, exactLength)).toThrow(
        new TypeError(`Function 'macro' accepts exactly 1 argument(s) but found 0.`)
      );
    });

    it("should throw error about arguments min length", () => {
      const args = ["test"];
      const minLength = 2;

      expect(() => validateArgumentsLength(fnName, args, undefined, minLength)).toThrow(
        new TypeError(`Function 'macro' accepts minimum 2 argument(s) but found 1.`)
      );
    });

    it("should throw error about arguments max length", () => {
      const args = ["test", "test2"];
      const maxLength = 1;

      expect(() => validateArgumentsLength(fnName, args, undefined, undefined, maxLength)).toThrow(
        new TypeError(`Function 'macro' accepts maximum 1 argument(s) but found 2.`)
      );
    });

    it("should throw errors about arguments order", () => {
      const args = [
        {
          kind: "literal"
        },
        {
          kind: "operator",
          type: "select"
        },
        [
          {
            kind: "literal"
          }
        ]
      ];
      const validators = [ArrayValidation, LiteralValidation, PropertyAccesChainValidation];

      expect(() => validateArgumentsOrder(fnName, args, validators)).toThrow(
        new TypeError(
          `Function 'macro' arg[0] must be array.
Function 'macro' arg[1] must be literal.
Function 'macro' arg[2] must be property access chain.`
        )
      );
    });
  });

  describe("helpers", () => {
    const values = ["18", "35"];
    const field = "ages";
    const operator = "$or";

    const expectedExpr = [
      {
        $eq: [
          {
            $in: [
              "18",
              {
                $ifNull: [field, []]
              }
            ]
          },
          true
        ]
      },
      {
        $eq: [
          {
            $in: [
              "35",
              {
                $ifNull: [field, []]
              }
            ]
          },
          true
        ]
      }
    ];

    it("should create in query for mode: match", () => {
      const query = createInQuery(values, field, operator, "match");

      expect(query).toEqual({
        [operator]: expectedExpr.map(expr => ({$expr: expr}))
      });
    });

    it("should create in query for mode: project", () => {
      const query = createInQuery(values, field, operator, "project");

      expect(query).toEqual({
        [operator]: expectedExpr
      });
    });
  });

  describe("functions", () => {
    const time = new Date("2000-01-01T00:00:00.000Z");

    describe("has", () => {
      const tree = parser.parse("document.title");

      describe("compile", () => {
        const context: any = {
          arguments: [tree],
          target: "default"
        };

        const hasFn = has(context, "match");

        it("should return true", () => {
          const request = {
            document: {
              title: "here i am"
            }
          };

          const result = hasFn(request);

          expect(result).toEqual(true);
        });
        it("should return false", () => {
          const request = {
            document: {
              description: "not me"
            }
          };

          const result = hasFn(request);

          expect(result).toEqual(false);
        });
      });

      describe("convert", () => {
        const context: any = {
          arguments: [tree],
          target: "aggregation"
        };

        const expectedExpr = {$gt: ["$title", null]};

        it("should return aggregation for mode: match", () => {
          const hasFn = has(context, "match");
          const result = hasFn({});
          expect(result).toEqual({$expr: expectedExpr});
        });

        it("should return aggregation for mode: project", () => {
          const hasFn = has(context, "project");
          const result = hasFn({});
          expect(result).toEqual(expectedExpr);
        });
      });
    });

    describe("unix time", () => {
      const tree = parser.parse("document.created_at");

      describe("compile", () => {
        const context: any = {
          arguments: [tree],
          target: "default"
        };

        const unixTimeFn = unixTime(context, "match");

        it("should return unixtime stamp", () => {
          const request = {
            document: {
              created_at: time.toString()
            }
          };

          const result = unixTimeFn(request);

          expect(result).toEqual(time.getTime() / 1000);
        });
      });

      describe("convert", () => {
        const context: any = {
          arguments: [tree],
          target: "aggregation"
        };

        const unixTimeFn = unixTime(context, "match");

        it("should return aggregation", () => {
          const request = {};

          const result = unixTimeFn(request);

          expect(result).toEqual({
            $divide: [
              {
                $toLong: "$created_at"
              },
              1000
            ]
          });
        });
      });
    });

    describe("now", () => {
      describe("compile", () => {
        const context: any = {
          arguments: [],
          target: "default"
        };

        const nowFn = now(context, "match");

        it("should return unixtime stamp of now", () => {
          jest.setSystemTime(time);
          const request = {};

          const result = nowFn(request);

          expect(result).toEqual(time.getTime() / 1000);
        });
      });

      describe("convert", () => {
        const context: any = {
          arguments: [],
          target: "aggregation"
        };

        const nowFn = now(context, "match");

        it("should return aggregation", () => {
          jest.setSystemTime(time);
          const request = {};

          const result = nowFn(request);

          expect(result).toEqual({
            $divide: [
              {
                $toLong: time.getTime()
              },
              1000
            ]
          });
        });
      });
    });

    describe("some", () => {
      const target = parser.parse("document.tags");
      const compare = parser.parse("['nodejs','angular']");

      describe("compile", () => {
        const context: any = {
          arguments: [target, compare],
          target: "default"
        };

        const someFn = some(context, "match");

        it("should return true", () => {
          const request = {
            document: {
              tags: ["nodejs", "firebase"]
            }
          };

          const result = someFn(request);

          expect(result).toEqual(true);
        });
        it("should return false", () => {
          const request = {
            document: {
              tags: ["docker", "firebase"]
            }
          };

          const result = someFn(request);

          expect(result).toEqual(false);
        });

        describe("nested arrays", () => {
          const target = parser.parse("document.tags");
          const compare = parser.parse("[['nodejs','express'],['angular']]");

          const context: any = {
            arguments: [target, compare],
            target: "default"
          };

          const someFn = some(context, "match");

          it("should return true", () => {
            const request = {
              document: {
                tags: [["nodejs", "express"], ["firebase"]]
              }
            };

            const result = someFn(request);

            expect(result).toEqual(true);
          });

          it("should return false", () => {
            const request = {
              document: {
                // it should contain exact ['nodejs','express'] or ['angular']
                tags: [["nodejs", "express", "angular"]]
              }
            };

            const result = someFn(request);

            expect(result).toEqual(false);
          });
        });
      });

      describe("convert", () => {
        const context: any = {
          arguments: [target, compare],
          target: "aggregation"
        };

        const someFn = some(context, "match");

        it("should return aggregation", () => {
          const request = {};

          const result = someFn(request);

          expect(result).toEqual({
            $or: [
              {
                $expr: {
                  $eq: [
                    {
                      $in: [
                        "nodejs",
                        {
                          $ifNull: ["$tags", []]
                        }
                      ]
                    },
                    true
                  ]
                }
              },
              {
                $expr: {
                  $eq: [
                    {
                      $in: [
                        "angular",
                        {
                          $ifNull: ["$tags", []]
                        }
                      ]
                    },
                    true
                  ]
                }
              }
            ]
          });
        });
      });
    });

    describe("every", () => {
      const target = parser.parse("document.tags");
      const compare = parser.parse("['nodejs','angular']");

      describe("compile", () => {
        const context: any = {
          arguments: [target, compare],
          target: "default"
        };

        const everyFn = every(context, "match");

        it("should return true", () => {
          const request = {
            document: {
              tags: ["nodejs", "angular", "firebase"]
            }
          };

          const result = everyFn(request);

          expect(result).toEqual(true);
        });
        it("should return false", () => {
          const request = {
            document: {
              tags: ["nodejs", "firebase"]
            }
          };

          const result = everyFn(request);

          expect(result).toEqual(false);
        });

        describe("nested arrays", () => {
          const target = parser.parse("document.tags");
          const compare = parser.parse("[['nodejs','express'],['angular']]");

          const context: any = {
            arguments: [target, compare],
            target: "default"
          };

          const everyFn = every(context, "match");

          it("should return true", () => {
            const request = {
              document: {
                tags: [["nodejs", "express"], ["angular"], ["docker"]]
              }
            };

            const result = everyFn(request);

            expect(result).toEqual(true);
          });

          it("should return false", () => {
            const request = {
              document: {
                // it does not contain exact ['angular']
                tags: [["nodejs", "express", "angular"]]
              }
            };

            const result = everyFn(request);

            expect(result).toEqual(false);
          });
        });
      });

      describe("convert", () => {
        const context: any = {
          arguments: [target, compare],
          target: "aggregation"
        };

        const everyFn = every(context, "match");

        it("should return aggregation", () => {
          const request = {};

          const result = everyFn(request);

          expect(result).toEqual({
            $and: [
              {
                $expr: {
                  $eq: [
                    {
                      $in: [
                        "nodejs",
                        {
                          $ifNull: ["$tags", []]
                        }
                      ]
                    },
                    true
                  ]
                }
              },
              {
                $expr: {
                  $eq: [
                    {
                      $in: [
                        "angular",
                        {
                          $ifNull: ["$tags", []]
                        }
                      ]
                    },
                    true
                  ]
                }
              }
            ]
          });
        });
      });
    });

    describe("equal", () => {
      const target = parser.parse("document.tags");
      const compare = parser.parse("['nodejs','angular']");

      describe("compile", () => {
        const context: any = {
          arguments: [target, compare],
          target: "default"
        };

        const equalFn = equal(context, "match");

        it("should return true", () => {
          const request = {
            document: {
              tags: ["angular", "nodejs"]
            }
          };

          const result = equalFn(request);

          expect(result).toEqual(true);
        });
        it("should return false", () => {
          const request = {
            document: {
              tags: ["nodejs", "angular", "firebase"]
            }
          };

          const result = equalFn(request);

          expect(result).toEqual(false);
        });

        describe("nested arrays", () => {
          const target = parser.parse("document.tags");
          const compare = parser.parse("[['nodejs','express'],['angular']]");

          const context: any = {
            arguments: [target, compare],
            target: "default"
          };

          const equalFn = equal(context, "match");

          it("should return true", () => {
            const request = {
              document: {
                // order of items is not necessary
                tags: [["angular"], ["nodejs", "express"]]
              }
            };

            const result = equalFn(request);

            expect(result).toEqual(true);
          });

          it("should return false", () => {
            const request = {
              document: {
                // it has extra item ['docker']
                tags: [["nodejs", "express"], ["angular"], ["docker"]]
              }
            };

            const result = equalFn(request);

            expect(result).toEqual(false);
          });
        });
      });

      describe("convert", () => {
        const context: any = {
          arguments: [target, compare],
          target: "aggregation"
        };

        const expected = {
          $and: [
            {
              $eq: [
                {
                  $size: {
                    $ifNull: ["$tags", []]
                  }
                },
                2
              ]
            },
            {
              $eq: [
                {
                  $setDifference: ["$tags", ["nodejs", "angular"]]
                },
                []
              ]
            }
          ]
        };

        it("should return aggregation for mode: match", () => {
          const fn = equal(context, "match");
          const result = fn({});
          expect(result).toEqual({$expr: expected});
        });

        it("should return aggregation for mode: project", () => {
          const fn = equal(context, "project");
          const result = fn({});
          expect(result).toEqual(expected);
        });
      });
    });

    describe("regex", () => {
      const target = parser.parse("document.name");
      const regexSt = parser.parse("'^jo'");
      const tags = parser.parse("'i'");

      describe("compile", () => {
        const context: any = {
          arguments: [target, regexSt, tags],
          target: "default"
        };

        const regexFn = regex(context, "match");

        it("should return true", () => {
          const request = {
            document: {
              name: "John"
            }
          };

          const result = regexFn(request);

          expect(result).toEqual(true);
        });
        it("should return false", () => {
          const request = {
            document: {
              name: "Jesica"
            }
          };

          const result = regexFn(request);

          expect(result).toEqual(false);
        });
      });

      describe("convert", () => {
        const context: any = {
          arguments: [target, regexSt, tags],
          target: "aggregation"
        };

        const expectedExpr = {
          $eq: [
            {
              $regexMatch: {
                input: "$name",
                regex: "^jo",
                options: "i"
              }
            },
            true
          ]
        };

        it("should return aggregation for mode: match", () => {
          const regexFn = regex(context, "match");
          const result = regexFn({});
          expect(result).toEqual({$expr: expectedExpr});
        });

        it("should return aggregation for mode: project", () => {
          const regexFn = regex(context, "project");
          const result = regexFn({});
          expect(result).toEqual(expectedExpr);
        });
      });
    });

    describe("length", () => {
      const target = parser.parse("document.tags");
      describe("compile", () => {
        const context: any = {
          arguments: [target],
          target: "default"
        };

        const lengthFn = length(context, "match");

        it("should return length of array", () => {
          const request = {
            document: {
              tags: ["nodejs", "firebase"]
            }
          };

          const result = lengthFn(request);

          expect(result).toEqual(2);
        });

        it("should return length of string", () => {
          const request = {
            document: {
              tags: "ten length"
            }
          };

          const result = lengthFn(request);

          expect(result).toEqual(10);
        });

        it("should return -1 if target is not iterable", () => {
          const request = {
            document: {
              tags: 123
            }
          };

          const result = lengthFn(request);

          expect(result).toEqual(-1);
        });
      });

      describe("convert", () => {
        const context: any = {
          arguments: [target],
          target: "aggregation"
        };

        const lengthFn = length(context, "match");

        it("should return aggregation", () => {
          const request = {};

          const result = lengthFn(request);
          expect(result).toEqual({
            $size: "$tags"
          });
        });
      });
    });
  });
  describe("wrapExpressionByMode", () => {
    const expression = {someField: 123};

    it('should wrap expression in $expr when mode is "match"', () => {
      const result = wrapExpressionByMode(expression, "match");
      expect(result).toEqual({$expr: expression});
    });

    it('should return expression as-is when mode is "project"', () => {
      const result = wrapExpressionByMode(expression, "project");
      expect(result).toBe(expression);
    });

    it("should throw error for unknown mode", () => {
      expect(() => wrapExpressionByMode(expression, "unknown" as any)).toThrow(
        "Unknown mode received."
      );
    });
  });
});

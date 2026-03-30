import {decryptDocumentFields} from "@spica-server/bucket/common";
import {encrypt} from "@spica-server/core/schema";
import {Bucket} from "@spica-server/interface/bucket";
import {RelationType} from "@spica-server/interface/bucket/common";

describe("Decrypt Relations", () => {
  const ENCRYPTION_SECRET = "01234567890123456789012345678901";

  function createSchemaResolver(schemas: Map<string, Bucket>) {
    return (bucketId: string): Bucket => {
      const schema = schemas.get(bucketId);
      if (!schema) {
        throw new Error(`Schema not found for bucket ${bucketId}`);
      }
      return schema;
    };
  }

  describe("One-to-One Relations", () => {
    it("should decrypt encrypted fields in one-to-one related documents", () => {
      const userSchema = {
        properties: {
          name: {type: "string"},
          ssn: {type: "encrypted"}
        }
      } as unknown as Bucket;

      const postSchema = {
        properties: {
          title: {type: "string"},
          author: {
            type: "relation",
            relationType: "onetoone",
            bucketId: "user_bucket_id"
          }
        }
      } as unknown as Bucket;

      const encryptedSSN = encrypt("123-45-6789", ENCRYPTION_SECRET);

      const documentWithRelation = {
        _id: "post1",
        title: "My Post",
        author: {
          _id: "user1",
          name: "John Doe",
          ssn: encryptedSSN
        }
      };

      const schemas = new Map<string, Bucket>();
      schemas.set("user_bucket_id", userSchema);
      const schemaResolver = createSchemaResolver(schemas);

      const decrypted = decryptDocumentFields(
        documentWithRelation,
        postSchema,
        ENCRYPTION_SECRET,
        schemaResolver,
        "post1"
      );

      expect(decrypted.title).toBe("My Post");
      expect(decrypted.author.name).toBe("John Doe");
      expect(decrypted.author.ssn).toBe("123-45-6789");
    });

    it("should handle null or undefined one-to-one relations gracefully", () => {
      const userSchema = {
        properties: {
          name: {type: "string"},
          secret: {type: "encrypted"}
        }
      } as unknown as Bucket;

      const postSchema = {
        properties: {
          title: {type: "string"},
          author: {
            type: "relation",
            relationType: "onetoone",
            bucketId: "user_bucket_id"
          }
        }
      } as unknown as Bucket;

      const schemas = new Map<string, Bucket>();
      schemas.set("user_bucket_id", userSchema);

      const documentWithNullRelation = {
        _id: "post1",
        title: "My Post",
        author: null
      };

      const decrypted = decryptDocumentFields(
        documentWithNullRelation,
        postSchema,
        ENCRYPTION_SECRET,
        createSchemaResolver(schemas),
        "post1"
      );

      expect(decrypted.author).toBe(null);
    });
  });

  describe("One-to-Many Relations", () => {
    it("should decrypt encrypted fields in one-to-many related documents", () => {
      const commentSchema = {
        properties: {
          text: {type: "string"},
          email: {type: "encrypted"}
        }
      } as unknown as Bucket;

      const postSchema = {
        properties: {
          title: {type: "string"},
          comments: {
            type: "relation",
            relationType: "onetomany",
            bucketId: "comment_bucket_id"
          }
        }
      } as unknown as Bucket;

      const encryptedEmail1 = encrypt("john@example.com", ENCRYPTION_SECRET);
      const encryptedEmail2 = encrypt("jane@example.com", ENCRYPTION_SECRET);

      const documentWithRelations = {
        _id: "post1",
        title: "My Post",
        comments: [
          {
            _id: "comment1",
            text: "Great post!",
            email: encryptedEmail1
          },
          {
            _id: "comment2",
            text: "Thanks for sharing",
            email: encryptedEmail2
          }
        ]
      };

      const schemas = new Map<string, Bucket>();
      schemas.set("comment_bucket_id", commentSchema);

      const decrypted = decryptDocumentFields(
        documentWithRelations,
        postSchema,
        ENCRYPTION_SECRET,
        createSchemaResolver(schemas),
        "post1"
      );

      expect(decrypted.comments).toHaveLength(2);
      expect(decrypted.comments[0].text).toBe("Great post!");
      expect(decrypted.comments[0].email).toBe("john@example.com");
      expect(decrypted.comments[1].text).toBe("Thanks for sharing");
      expect(decrypted.comments[1].email).toBe("jane@example.com");
    });

    it("should handle empty arrays in one-to-many relations", () => {
      const commentSchema = {
        properties: {
          text: {type: "string"},
          email: {type: "encrypted"}
        }
      } as unknown as Bucket;

      const postSchema = {
        properties: {
          title: {type: "string"},
          comments: {
            type: "relation",
            relationType: "onetomany",
            bucketId: "comment_bucket_id"
          }
        }
      } as unknown as Bucket;

      const schemas = new Map<string, Bucket>();
      schemas.set("comment_bucket_id", commentSchema);

      const documentWithEmptyRelations = {
        _id: "post1",
        title: "My Post",
        comments: []
      };

      const decrypted = decryptDocumentFields(
        documentWithEmptyRelations,
        postSchema,
        ENCRYPTION_SECRET,
        createSchemaResolver(schemas),
        "post1"
      );

      expect(decrypted.comments).toEqual([]);
    });
  });

  describe("Nested Relations", () => {
    it("should decrypt encrypted fields in nested relations (relation -> relation)", () => {
      const walletSchema = {
        properties: {
          brand: {type: "string"},
          card_number: {type: "encrypted"}
        }
      } as unknown as Bucket;

      const userSchema = {
        properties: {
          name: {type: "string"},
          ssn: {type: "encrypted"},
          wallets: {
            type: "relation",
            relationType: "onetomany",
            bucketId: "wallet_bucket_id"
          }
        }
      } as unknown as Bucket;

      const postSchema = {
        properties: {
          title: {type: "string"},
          author: {
            type: "relation",
            relationType: "onetoone",
            bucketId: "user_bucket_id"
          }
        }
      } as unknown as Bucket;

      const encryptedSSN = encrypt("123-45-6789", ENCRYPTION_SECRET);
      const encryptedCard1 = encrypt("4111-1111-1111-1111", ENCRYPTION_SECRET);
      const encryptedCard2 = encrypt("5500-0000-0000-0004", ENCRYPTION_SECRET);

      const documentWithNestedRelations = {
        _id: "post1",
        title: "My Post",
        author: {
          _id: "user1",
          name: "John Doe",
          ssn: encryptedSSN,
          wallets: [
            {
              _id: "wallet1",
              brand: "Visa",
              card_number: encryptedCard1
            },
            {
              _id: "wallet2",
              brand: "MasterCard",
              card_number: encryptedCard2
            }
          ]
        }
      };

      const schemas = new Map<string, Bucket>();
      schemas.set("user_bucket_id", userSchema);
      schemas.set("wallet_bucket_id", walletSchema);

      const decrypted = decryptDocumentFields(
        documentWithNestedRelations,
        postSchema,
        ENCRYPTION_SECRET,
        createSchemaResolver(schemas),
        "post1"
      );

      expect(decrypted.author.name).toBe("John Doe");
      expect(decrypted.author.ssn).toBe("123-45-6789");
      expect(decrypted.author.wallets).toHaveLength(2);
      expect(decrypted.author.wallets[0].brand).toBe("Visa");
      expect(decrypted.author.wallets[0].card_number).toBe("4111-1111-1111-1111");
      expect(decrypted.author.wallets[1].brand).toBe("MasterCard");
      expect(decrypted.author.wallets[1].card_number).toBe("5500-0000-0000-0004");
    });
  });

  describe("Mixed Scenarios", () => {
    it("should decrypt both direct and relational encrypted fields", () => {
      const userSchema = {
        properties: {
          name: {type: "string"},
          email: {type: "encrypted"}
        }
      } as unknown as Bucket;

      const postSchema = {
        properties: {
          title: {type: "string"},
          draft_content: {type: "encrypted"},
          author: {
            type: "relation",
            relationType: "onetoone",
            bucketId: "user_bucket_id"
          }
        }
      } as unknown as Bucket;

      const encryptedDraft = encrypt("This is a secret draft", ENCRYPTION_SECRET);
      const encryptedEmail = encrypt("author@example.com", ENCRYPTION_SECRET);

      const document = {
        _id: "post1",
        title: "My Post",
        draft_content: encryptedDraft,
        author: {
          _id: "user1",
          name: "John Doe",
          email: encryptedEmail
        }
      };

      const schemas = new Map<string, Bucket>();
      schemas.set("user_bucket_id", userSchema);

      const decrypted = decryptDocumentFields(
        document,
        postSchema,
        ENCRYPTION_SECRET,
        createSchemaResolver(schemas),
        "post1"
      );

      expect(decrypted.draft_content).toBe("This is a secret draft");
      expect(decrypted.author.email).toBe("author@example.com");
    });

    it("should handle relations with nested objects containing encrypted fields", () => {
      const userSchema = {
        properties: {
          name: {type: "string"},
          credentials: {
            type: "object",
            properties: {
              username: {type: "string"},
              api_key: {type: "encrypted"}
            }
          }
        }
      } as unknown as Bucket;

      const postSchema = {
        properties: {
          title: {type: "string"},
          author: {
            type: "relation",
            relationType: "onetoone",
            bucketId: "user_bucket_id"
          }
        }
      } as unknown as Bucket;

      const encryptedApiKey = encrypt("secret-api-key-12345", ENCRYPTION_SECRET);

      const document = {
        _id: "post1",
        title: "My Post",
        author: {
          _id: "user1",
          name: "John Doe",
          credentials: {
            username: "johndoe",
            api_key: encryptedApiKey
          }
        }
      };

      const schemas = new Map<string, Bucket>();
      schemas.set("user_bucket_id", userSchema);

      const decrypted = decryptDocumentFields(
        document,
        postSchema,
        ENCRYPTION_SECRET,
        createSchemaResolver(schemas),
        "post1"
      );

      expect(decrypted.author.credentials.username).toBe("johndoe");
      expect(decrypted.author.credentials.api_key).toBe("secret-api-key-12345");
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing related schema gracefully", () => {
      const postSchema = {
        properties: {
          title: {type: "string"},
          author: {
            type: "relation",
            relationType: "onetoone",
            bucketId: "user_bucket_id"
          }
        }
      } as unknown as Bucket;

      const document = {
        _id: "post1",
        title: "My Post",
        author: {
          _id: "user1",
          name: "John Doe",
          ssn: encrypt("123-45-6789", ENCRYPTION_SECRET)
        }
      };

      const schemas = new Map<string, Bucket>();
      // Not providing the user_bucket_id schema

      const decrypted = decryptDocumentFields(
        document,
        postSchema,
        ENCRYPTION_SECRET,
        createSchemaResolver(schemas),
        "post1"
      );

      // Should not throw an error, just skip decryption of related fields
      expect(decrypted.title).toBe("My Post");
      expect(typeof decrypted.author.ssn).toBe("object");
    });

    it("should support RelationType enum values", () => {
      const userSchema = {
        properties: {
          name: {type: "string"},
          secret: {type: "encrypted"}
        }
      } as unknown as Bucket;

      const postSchema = {
        properties: {
          title: {type: "string"},
          author: {
            type: "relation",
            relationType: RelationType.One,
            bucketId: "user_bucket_id"
          }
        }
      } as unknown as Bucket;

      const encryptedSecret = encrypt("my-secret", ENCRYPTION_SECRET);

      const document = {
        _id: "post1",
        title: "My Post",
        author: {
          _id: "user1",
          name: "John Doe",
          secret: encryptedSecret
        }
      };

      const schemas = new Map<string, Bucket>();
      schemas.set("user_bucket_id", userSchema);

      const decrypted = decryptDocumentFields(
        document,
        postSchema,
        ENCRYPTION_SECRET,
        createSchemaResolver(schemas),
        "post1"
      );

      expect(decrypted.author.secret).toBe("my-secret");
    });

    it("should handle invalid encrypted data in relations without crashing", () => {
      const userSchema = {
        properties: {
          name: {type: "string"},
          secret: {type: "encrypted"}
        }
      } as unknown as Bucket;

      const postSchema = {
        properties: {
          title: {type: "string"},
          author: {
            type: "relation",
            relationType: "onetoone",
            bucketId: "user_bucket_id"
          }
        }
      } as unknown as Bucket;

      const document = {
        _id: "post1",
        title: "My Post",
        author: {
          _id: "user1",
          name: "John Doe",
          secret: {
            encrypted: "invalid-data",
            iv: "invalid-iv",
            authTag: "invalid-tag"
          }
        }
      };

      const schemas = new Map<string, Bucket>();
      schemas.set("user_bucket_id", userSchema);

      expect(() => {
        decryptDocumentFields(
          document,
          postSchema,
          ENCRYPTION_SECRET,
          createSchemaResolver(schemas),
          "post1"
        );
      }).toThrow(/Decryption failed for document/);
    });
  });
});
